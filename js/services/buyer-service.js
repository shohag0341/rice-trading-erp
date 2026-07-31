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







// ---------- Profile page specific functions ----------

export async function getBuyerTotals(buyerId) {
    const { data, error } = await supabase
        .from('sales')
        .select('gross_amount, amount_received')
        .eq('buyer_id', buyerId);

    if (error) throw error;

    const totalSold = data.reduce((sum, s) => sum + Number(s.gross_amount), 0);
    const totalReceived = data.reduce((sum, s) => sum + Number(s.amount_received), 0);

    return {
        total_sold: totalSold,
        total_received: totalReceived,
        outstanding_balance: totalSold - totalReceived,
        transaction_count: data.length
    };
}

export async function recordBuyerPayment(saleId, buyerId, amount, paymentMethod, userId) {
    // 1. Insert the payment record
    const { error: paymentError } = await supabase
        .from('buyer_payments')
        .insert([{
            sale_id: saleId,
            buyer_id: buyerId,
            amount,
            payment_method: paymentMethod,
            created_by: userId
        }]);

    if (paymentError) throw paymentError;

    // 2. Update the sale's amount_received and payment_status
    const { data: sale, error: fetchError } = await supabase
        .from('sales')
        .select('gross_amount, amount_received')
        .eq('id', saleId)
        .single();

    if (fetchError) throw fetchError;

    const newAmountReceived = Number(sale.amount_received) + Number(amount);
    const newStatus = newAmountReceived >= Number(sale.gross_amount) ? 'paid'
        : newAmountReceived > 0 ? 'partial' : 'due';

    const { error: updateError } = await supabase
        .from('sales')
        .update({ amount_received: newAmountReceived, payment_status: newStatus })
        .eq('id', saleId);

    if (updateError) throw updateError;
}





