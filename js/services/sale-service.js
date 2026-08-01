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
// Uses a true moving weighted average across the full stock movement history:
// - purchase_in blends new cost into existing stock value
// - any "out" movement (sale/damage/transfer) reduces quantity, cost/kg stays the same
// - if stock hits zero (within tolerance), average resets to 0 so the next purchase starts fresh
export async function getAverageCostPerMaund(warehouseId, varietyId) {
    // 1. Get all movements, oldest first
    const { data: movements, error: movementsError } = await supabase
        .from('stock_movements')
        .select('weight_kg, reference_purchase_id, movement_type, created_at')
        .eq('warehouse_id', warehouseId)
        .eq('paddy_variety_id', varietyId)
        .order('created_at', { ascending: true });

    if (movementsError) throw movementsError;
    if (!movements.length) return 0;

    // 2. Fetch cost info for all referenced purchases in one go
    const purchaseIds = movements
        .filter(m => m.reference_purchase_id)
        .map(m => m.reference_purchase_id);

    let purchaseCostMap = {};
    if (purchaseIds.length) {
        const { data: purchases, error: purchasesError } = await supabase
            .from('purchases')
            .select('id, net_cost, maund')
            .in('id', purchaseIds);

        if (purchasesError) throw purchasesError;
        
        
        purchases.forEach(p => {
            const weightKgOfPurchase = Number(p.maund) * 40; // convert maund back to kg
            purchaseCostMap[p.id] = weightKgOfPurchase > 0 ? Number(p.net_cost) / weightKgOfPurchase : 0; // true cost per KG
        });


        
    }

    // 3. Walk through the movements maintaining a true moving weighted average
    const ZERO_TOLERANCE_KG = 0.01;
    let currentStockKg = 0;
    let currentAvgCostPerKg = 0;

    for (const m of movements) {
        const weightKg = Number(m.weight_kg);

        if (weightKg > 0) {
            // Incoming stock (purchase, transfer in)
            let costPerKg = 0;
            if (m.movement_type === 'purchase_in' && m.reference_purchase_id) {
                costPerKg = purchaseCostMap[m.reference_purchase_id] || 0;
            }

            const existingValue = currentStockKg * currentAvgCostPerKg;
            const incomingValue = weightKg * costPerKg;
            const newStockKg = currentStockKg + weightKg;

            currentAvgCostPerKg = newStockKg > 0 ? (existingValue + incomingValue) / newStockKg : 0;
            currentStockKg = newStockKg;
        } else {
            // Outgoing stock (sale, damage, transfer out) — cost per kg unchanged, quantity reduces
            currentStockKg += weightKg; // weightKg is negative here

            if (currentStockKg <= ZERO_TOLERANCE_KG) {
                currentStockKg = 0;
                currentAvgCostPerKg = 0; // reset — next purchase starts a fresh cycle
            }
        }
    }

    // Convert cost-per-kg back to cost-per-maund (40kg = 1 maund)
    return currentAvgCostPerKg * 40;
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
    const { data, error } = await supabase
        .from('sales')
        .delete()
        .eq('id', id)
        .select();

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('কোনো সারি মুছা যায়নি — permission (RLS) সমস্যা অথবা ভুল id।');
    }
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
