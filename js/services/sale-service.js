// Handles all database operations for sales
import { supabase } from './supabase-client.js';

// ---------- Dropdown data ----------
export async function getBuyersForDropdown() {
    const { data, error } = await supabase
        .from('buyers')
        .select('id, name, buyer_type')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
}

// ---------- Get average purchase cost per maund for a warehouse + variety combo ----------



export async function getAverageCostPerMaund(warehouseId, varietyId) {
    // 1. Get the full movement history for this warehouse+variety, oldest first
    const { data: movements, error: movementsError } = await supabase
        .from('stock_movements')
        .select('weight_kg, reference_purchase_id, movement_type, created_at')
        .eq('warehouse_id', warehouseId)
        .eq('paddy_variety_id', varietyId)
        .order('created_at', { ascending: true });

    if (movementsError) throw movementsError;
    if (!movements.length) return 0;

    // 2. Walk through the history to find where the current "cycle" began
    //    A cycle resets every time running stock touches zero (within a small tolerance).
    const ZERO_TOLERANCE_KG = 0.01;
    let runningStock = 0;
    let cycleStartIndex = 0;

    movements.forEach((m, idx) => {
        runningStock += Number(m.weight_kg);
        if (runningStock <= ZERO_TOLERANCE_KG) {
            cycleStartIndex = idx + 1;
        }
    });

    const currentCycleMovements = movements.slice(cycleStartIndex);

    // 3. Only the purchase_in movements within the current cycle count toward the average
    const purchaseIds = currentCycleMovements
        .filter(m => m.movement_type === 'purchase_in' && m.reference_purchase_id)
        .map(m => m.reference_purchase_id);

    if (!purchaseIds.length) return 0;

    const { data: purchases, error: purchasesError } = await supabase
        .from('purchases')
        .select('net_cost, maund')
        .in('id', purchaseIds);

    if (purchasesError) throw purchasesError;

    const totalMaund = purchases.reduce((sum, p) => sum + Number(p.maund), 0);
    const totalCost = purchases.reduce((sum, p) => sum + Number(p.net_cost), 0);

    return totalMaund > 0 ? totalCost / totalMaund : 0;
}





// ---------- Get current available stock for a warehouse + variety combo ----------
export async function getAvailableStock(warehouseId, varietyId) {
    const { data, error } = await supabase
        .from('current_stock')
        .select('current_maund, current_weight_kg')
        .eq('warehouse_id', warehouseId)
        .eq('paddy_variety_id', varietyId)
        .maybeSingle();

    if (error) throw error;
    return data || { current_maund: 0, current_weight_kg: 0 };
}

// ---------- Sales ----------
export async function getAllSales(searchTerm = '') {
    let query = supabase
        .from('sales')
        .select(`
            *,
            buyers(name, buyer_type, phone),
            warehouses(name),
            paddy_varieties(name)
        `)
        .order('sale_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.ilike('invoice_no', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getSaleById(id) {
    const { data, error } = await supabase
        .from('sales')
        .select(`*, buyers(name, buyer_type, phone), warehouses(name), paddy_varieties(name)`)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createSale(saleData, userId) {
    const { data, error } = await supabase
        .from('sales')
        .insert([{ ...saleData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateSale(id, saleData) {
    const { data, error } = await supabase
        .from('sales')
        .update(saleData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteSale(id) {
    const { error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// ---------- Payments ----------
export async function addBuyerPayment(paymentData, userId) {
    const { data, error } = await supabase
        .from('buyer_payments')
        .insert([{ ...paymentData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ---------- Invoice number generator ----------
export async function generateSaleInvoiceNumber() {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');

    const { count, error } = await supabase
        .from('sales')
        .select('*', { count: 'exact', head: true })
        .eq('sale_date', today.toISOString().split('T')[0]);

    if (error) throw error;

    const sequence = String((count || 0) + 1).padStart(3, '0');
    return `SAL-${datePart}-${sequence}`;
      }
