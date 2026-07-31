// Handles cash adjustment (out/in) operations
import { supabase } from './supabase-client.js';

export async function getAllCashAdjustments() {
    const { data, error } = await supabase
        .from('cash_adjustments')
        .select('*')
        .order('adjustment_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (error) throw error;
    return data;
}

export async function createCashAdjustment(adjustmentData, userId) {
    const { data, error } = await supabase
        .from('cash_adjustments')
        .insert([{ ...adjustmentData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteCashAdjustment(id) {
    const { error } = await supabase
        .from('cash_adjustments')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
