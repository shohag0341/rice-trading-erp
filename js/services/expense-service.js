// Handles all database operations for expenses
import { supabase } from './supabase-client.js';

export async function getAllExpenses(searchTerm = '') {
    let query = supabase
        .from('expenses')
        .select('*, warehouses(name)')
        .order('expense_date', { ascending: false })
        .order('created_at', { ascending: false });

    if (searchTerm) {
        query = query.ilike('description', `%${searchTerm}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function createExpense(expenseData, userId) {
    const { data, error } = await supabase
        .from('expenses')
        .insert([{ ...expenseData, created_by: userId }])
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function updateExpense(id, expenseData) {
    const { data, error } = await supabase
        .from('expenses')
        .update(expenseData)
        .eq('id', id)
        .select()
        .single();

    if (error) throw error;
    return data;
}

export async function deleteExpense(id) {
    const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

    if (error) throw error;
}
