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
    //    reference_damage_id links this movement back to the damaged_stock row above, so
    //    getAverageCostPerMaund() can use its Estimated Value as the real cost of this stock
    //    instead of defaulting to ৳0.
    const { error: movementError } = await supabase
        .from('stock_movements')
        .insert([{
            warehouse_id: damageData.warehouse_id,
            paddy_variety_id: damageData.paddy_variety_id,
            movement_type: isGain ? 'adjustment' : 'damage',
            weight_kg: isGain ? damageData.weight_kg : -damageData.weight_kg,
            reference_damage_id: data.id,
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

// ---------- Update only the memo reference price/value on an existing Gain record ----------
// Scoped deliberately narrow: never touches warehouse, variety, weight, date, or the
// real estimated_loss (which drives actual cost/profit math) - only the informational
// reference_price_per_maund and its derived reference_value.
export async function updateDamagedStockReference(damageId, referencePricePerMaund, referenceValue) {
    const { error } = await supabase
        .from('damaged_stock')
        .update({
            reference_price_per_maund: referencePricePerMaund,
            reference_value: referenceValue
        })
        .eq('id', damageId);

    if (error) throw error;
}

// ---------- Delete a stock adjustment record (also reverses the stock movement) ----------
export async function deleteDamagedStock(damageId, warehouseId, varietyId, weightKg, adjustmentType) {
    // 1. Find the linked stock_movements row first, via reference_damage_id (reliable for
    //    records created after this link was added). Falls back to the old heuristic match
    //    (warehouse+variety+type+weight, most recent) for older records that predate it.
    const isGain = adjustmentType === 'gain';
    const movementType = isGain ? 'adjustment' : 'damage';
    const movementWeight = isGain ? weightKg : -weightKg;

    const { data: linkedMovements, error: linkedFindError } = await supabase
        .from('stock_movements')
        .select('id')
        .eq('reference_damage_id', damageId);

    if (linkedFindError) throw linkedFindError;

    let movementIdsToDelete = (linkedMovements || []).map(m => m.id);

    if (!movementIdsToDelete.length) {
        const { data: fallbackMovements, error: fallbackFindError } = await supabase
            .from('stock_movements')
            .select('id')
            .eq('warehouse_id', warehouseId)
            .eq('paddy_variety_id', varietyId)
            .eq('movement_type', movementType)
            .eq('weight_kg', movementWeight)
            .order('created_at', { ascending: false })
            .limit(1);

        if (fallbackFindError) throw fallbackFindError;
        movementIdsToDelete = (fallbackMovements || []).map(m => m.id);
    }

    // 2. Delete the damaged_stock record
    const { error: deleteError } = await supabase
        .from('damaged_stock')
        .delete()
        .eq('id', damageId);

    if (deleteError) throw deleteError;

    // 3. Delete the matching stock_movements entry to reverse the change
    if (movementIdsToDelete.length) {
        const { error: movementDeleteError } = await supabase
            .from('stock_movements')
            .delete()
            .in('id', movementIdsToDelete);

        if (movementDeleteError) throw movementDeleteError;
    }
}


// ---------- Total value of Loss or Gain adjustments in a date range (for P&L) ----------
async function getInventoryAdjustmentTotalForPeriod(adjustmentType, startDate, endDate) {
    const { data, error } = await supabase
        .from('damaged_stock')
        .select('estimated_loss')
        .eq('adjustment_type', adjustmentType)
        .gte('damage_date', startDate)
        .lte('damage_date', endDate);

    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.estimated_loss || 0), 0);
}

// Total value of Loss adjustments - subtracted from profit (a real loss/expense)
export async function getInventoryLossesForPeriod(startDate, endDate) {
    return getInventoryAdjustmentTotalForPeriod('loss', startDate, endDate);
}

// Total value of Gain adjustments - added to profit as immediate "Other Income",
// mirroring how a Loss is immediately recognized as an expense. Without this, a
// Gain's value only ever affects the average cost basis used for future COGS -
// if that basis happens to equal the eventual selling price, the Gain's value
// never surfaces as recognized profit anywhere.
export async function getInventoryGainsForPeriod(startDate, endDate) {
    return getInventoryAdjustmentTotalForPeriod('gain', startDate, endDate);
}

// Memo total: for Gains recorded at ৳0 (a genuinely free find), the profit isn't
// recognized here - it's already flowing through into whichever future Sale
// consumes that stock (lower average cost -> lower COGS -> higher Sale profit).
// This never affects any cost/profit calculation - it's purely a reference figure
// so that value isn't invisible from the P&L period it was actually found in.
export async function getFreeGainMemoValueForPeriod(startDate, endDate) {
    const { data, error } = await supabase
        .from('damaged_stock')
        .select('reference_value')
        .eq('adjustment_type', 'gain')
        .eq('estimated_loss', 0)
        .gte('damage_date', startDate)
        .lte('damage_date', endDate);

    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.reference_value || 0), 0);
}
