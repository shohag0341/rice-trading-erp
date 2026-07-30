// Handles all database operations for farmers
import { supabase } from './supabase-client.js';

export async function getAllFarmers(searchTerm = '') {
    let query = supabase
        .from('farmers')
        .select('*')
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,village.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getFarmerById(id) {
    const { data, error } = await supabase
        .from('farmers')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createFarmer(farmerData, userId) {
    const { data, error } = await supabase
        .from('farmers')
        .insert([{ ...farmerData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateFarmer(id, farmerData) {
    const { data, error } = await supabase
        .from('farmers')
        .update(farmerData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteFarmer(id) {
    const { error } = await supabase
        .from('farmers')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getFarmerPurchaseHistory(farmerId) {
    const { data, error } = await supabase
        .from('purchases')
        .select('*, paddy_varieties(name), warehouses(name)')
        .eq('farmer_id', farmerId)
        .order('purchase_date', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getFarmerPaymentHistory(farmerId) {
    const { data, error } = await supabase
        .from('farmer_payments')
        .select('*')
        .eq('farmer_id', farmerId)
        .order('payment_date', { ascending: false });

    if (error) throw error;
    return data;
                }
