// Handles all database operations for purchases
import { supabase } from './supabase-client.js';

// ---------- Dropdown data ----------
export async function getFarmersForDropdown() {
    const { data, error } = await supabase
        .from('farmers')
        .select('id, name, village')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
}

export async function getWarehousesForDropdown() {
    const { data, error } = await supabase
        .from('warehouses')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
}

export async function getPaddyVarietiesForDropdown() {
    const { data, error } = await supabase
        .from('paddy_varieties')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

    if (error) throw error;
    return data;
}

// ---------- Purchases ----------
export async function getAllPurchases(searchTerm = '') {
    let query = supabase
        .from('purchases')
        .select(`
            *,
            farmers(name, village, phone),
            warehouses(name),
            paddy_varieties(name)
        `)
        .order('purchase_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.ilike('invoice_no', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getPurchaseById(id) {
    const { data, error } = await supabase
        .from('purchases')
        .select(`*, farmers(name, village, phone), warehouses(name), paddy_varieties(name)`)
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createPurchase(purchaseData, userId) {
    const { data, error } = await supabase
        .from('purchases')
        .insert([{ ...purchaseData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updatePurchase(id, purchaseData) {
    const { data, error } = await supabase
        .from('purchases')
        .update(purchaseData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}



    
export async function deletePurchase(id) {
    // 1. Delete the linked stock_movements entry first (reverses the stock addition)
    const { error: movementError } = await supabase
        .from('stock_movements')
        .delete()
        .eq('reference_purchase_id', id);

    if (movementError) throw movementError;

    // 2. Now delete the purchase itself
    const { data, error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', id)
        .select();

    if (error) throw error;
    if (!data || data.length === 0) {
        throw new Error('কোনো সারি মুছা যায়নি — permission (RLS) সমস্যা অথবা ভুল id।');
    }
}

// ---------- Payments ----------
export async function addFarmerPayment(paymentData, userId) {
    const { data, error } = await supabase
        .from('farmer_payments')
        .insert([{ ...paymentData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

// ---------- Invoice number generator ----------
export async function generateInvoiceNumber() {
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');

    const { count, error } = await supabase
        .from('purchases')
        .select('*', { count: 'exact', head: true })
        .eq('purchase_date', today.toISOString().split('T')[0]);

    if (error) throw error;

    const sequence = String((count || 0) + 1).padStart(3, '0');
    return `PUR-${datePart}-${sequence}`;
}





export async function createPaddyVariety(name) {
    const { data, error } = await supabase
        .from('paddy_varieties')
        .insert([{ name: name.trim() }])
        .select()
        .single();

    if (error) throw error;
    return data;
}
