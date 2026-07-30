// Handles all database operations for warehouses
import { supabase } from './supabase-client.js';

export async function getAllWarehouses(searchTerm = '') {
    let query = supabase
        .from('warehouses')
        .select('*')
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.or(`name.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%,manager_name.ilike.%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function getWarehouseById(id) {
    const { data, error } = await supabase
        .from('warehouses')
        .select('*')
        .eq('id', id)
        .single();

    if (error) throw error;
    return data;
}

export async function createWarehouse(warehouseData, userId) {
    const { data, error } = await supabase
        .from('warehouses')
        .insert([{ ...warehouseData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateWarehouse(id, warehouseData) {
    const { data, error } = await supabase
        .from('warehouses')
        .update(warehouseData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteWarehouse(id) {
    const { error } = await supabase
        .from('warehouses')
        .delete()
        .eq('id', id);

    if (error) throw error;
}

// Get utilization data (used_maund, utilization_percent) from the view we created earlier
export async function getWarehouseUtilizationMap() {
    const { data, error } = await supabase
        .from('warehouse_utilization')
        .select('*');

    if (error) throw error;

    const map = {};
    data.forEach(w => { map[w.warehouse_id] = w; });
    return map;
}
