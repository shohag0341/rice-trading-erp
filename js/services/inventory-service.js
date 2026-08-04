// Handles inventory-related database operations
import { supabase } from './supabase-client.js';

// ---------- Current stock, grouped by warehouse ----------
export async function getCurrentStockByWarehouse() {
    const { data, error } = await supabase
        .from('current_stock')
        .select('*')
        .order('warehouse_name');

    if (error) throw error;

    // Group rows by warehouse
    const grouped = {};
    data.forEach(row => {
        if (!grouped[row.warehouse_id]) {
            grouped[row.warehouse_id] = {
                warehouse_id: row.warehouse_id,
                warehouse_name: row.warehouse_name,
                total_maund: 0,
                varieties: []
            };
        }
        if (Number(row.current_maund) > 0) {
            grouped[row.warehouse_id].varieties.push({
                variety_id: row.paddy_variety_id,
                variety_name: row.variety_name,
                maund: Number(row.current_maund)
            });
        }
        grouped[row.warehouse_id].total_maund += Number(row.current_maund);
    });

    return Object.values(grouped);
}

// ---------- Stock movement history (ledger) ----------
export async function getStockMovements(filters = {}) {
    let query = supabase
        .from('stock_movements')
        .select('*, warehouses(name), paddy_varieties(name)')
        .order('created_at', { ascending: false })
        .limit(100);

    if (filters.warehouseId) query = query.eq('warehouse_id', filters.warehouseId);
    if (filters.movementType) query = query.eq('movement_type', filters.movementType);

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

// ---------- Stock adjustments (loss/damage or gain/surplus) ----------
export async function getDamagedStock() {
    const { data, error } = await supabase
        .from('damaged_stock')
        .select('*, warehouses(name), paddy_varieties(name)')
        .order('damage_date', { ascending: false });

    if (error) throw error;
    return data;
}

export async function createDamagedStock(damageData, userId) {
    const isGain = damageData.adjustment_type === 'gain';

    // 1. Record the adjustment
    const { data, error } = await supabase
        .from('damaged_stock')
        .insert([{ ...damageData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;

    // 2. Also create a stock movement so current_stock reflects the change.
    //    Loss -> negative weight, movement_type 'damage' (kept for backward compatibility with existing data)
    //    Gain -> positive weight, movement_type 'adjustment'
    const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
            warehouse_id: damageData.warehouse_id,
            paddy_variety_id: damageData.paddy_variety_id,
            movement_type: isGain ? 'adjustment' : 'damage',
            weight_kg: isGain ? damageData.weight_kg : -damageData.weight_kg,
            remarks: damageData.reason,
            created_by: userId
        }]);

    if (movementError) throw movementError;

    return data;
}

// ---------- Get available stock for a specific warehouse + variety (used for loss validation) ----------
export async function getStockForWarehouseVariety(warehouseId, varietyId) {
    const { data, error } = await supabase
        .from('current_stock')
        .select('current_maund, current_weight_kg')
        .eq('warehouse_id', warehouseId)
        .eq('paddy_variety_id', varietyId)
        .maybeSingle();

    if (error) throw error;
    return data || { current_maund: 0, current_weight_kg: 0 };
}

// ---------- Delete a stock adjustment record (also reverses the stock movement) ----------
export async function deleteDamagedStock(damageId, warehouseId, varietyId, weightKg, adjustmentType) {
    // 1. Delete the damaged_stock record
    const { error: deleteError } = await supabase
        .from('damaged_stock')
        .delete()
        .eq('id', damageId);

    if (deleteError) throw deleteError;

    // 2. Find and delete the matching stock_movements entry to reverse the change
    const isGain = adjustmentType === 'gain';
    const movementType = isGain ? 'adjustment' : 'damage';
    const movementWeight = isGain ? weightKg : -weightKg;

    const { data: movements, error: findError } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('warehouse_id', warehouseId)
        .eq('paddy_variety_id', varietyId)
        .eq('movement_type', movementType)
        .eq('weight_kg', movementWeight)
        .order('created_at', { ascending: false })
        .limit(1);

    if (findError) throw findError;

    if (movements && movements.length > 0) {
        const { error: movementDeleteError } = await supabase
            .from('stock_movements')
            .delete()
            .eq('id', movements[0].id);

        if (movementDeleteError) throw movementDeleteError;
    }
}


// ---------- Total value of Loss adjustments in a date range (for P&L deduction) ----------
export async function getInventoryLossesForPeriod(startDate, endDate) {
    const { data, error } = await supabase
        .from('damaged_stock')
        .select('estimated_loss')
        .eq('adjustment_type', 'loss')
        .gte('damage_date', startDate)
        .lte('damage_date', endDate);

    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.estimated_loss || 0), 0);
}
