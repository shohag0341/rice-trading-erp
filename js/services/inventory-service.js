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

// ---------- Damaged stock ----------
export async function getDamagedStock() {
    const { data, error } = await supabase
        .from('damaged_stock')
        .select('*, warehouses(name), paddy_varieties(name)')
        .order('damage_date', { ascending: false });

    if (error) throw error;
    return data;
}

export async function createDamagedStock(damageData, userId) {
    // 1. Record the damage
    const { data, error } = await supabase
        .from('damaged_stock')
        .insert([{ ...damageData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;

    // 2. Also create a negative stock movement so current_stock reflects the loss
    const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
            warehouse_id: damageData.warehouse_id,
            paddy_variety_id: damageData.paddy_variety_id,
            movement_type: 'damage',
            weight_kg: -damageData.weight_kg,
            remarks: damageData.reason,
            created_by: userId
        }]);

    if (movementError) throw movementError;

    return data;
}






// ---------- Get available stock for a specific warehouse + variety (used for damage validation) ----------
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
