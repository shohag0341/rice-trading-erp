// Handles all database operations for buyers
import { supabase } from './supabase-client.js';

export async function getAllBuyers(searchTerm = '') {
    let query = supabase
        .from('buyers')
        .select('*')
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getBuyerById(id) {
    const { data, error } = await supabase
        .from('buyers')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createBuyer(buyerData, userId) {
    const { data, error } = await supabase
        .from('buyers')
        .insert([{ ...buyerData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateBuyer(id, buyerData) {
    const { data, error } = await supabase
        .from('buyers')
        .update(buyerData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteBuyer(id) {
    const { error } = await supabase
        .from('buyers')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

export async function getBuyerSalesHistory(buyerId) {
    const { data, error } = await supabase
        .from('sales')
        .select('*, paddy_varieties(name), warehouses(name)')
        .eq('buyer_id', buyerId)
        .order('sale_date', { ascending: false });

    if (error) throw error;
    return data;
           }
