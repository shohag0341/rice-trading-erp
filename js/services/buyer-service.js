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




// ---------- Recent payment history + delete/reverse ----------
export async function getBuyerPaymentsList(buyerId) {
    const { data, error } = await supabase
        .from('buyer_payments')
        .select('*, sales(invoice_no)')
        .eq('buyer_id', buyerId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) throw error;
    return data;
}

export async function deleteBuyerPayment(paymentId, saleId, amount) {
    // 1. Delete the payment record
    const { error: deleteError } = await supabase
        .from('buyer_payments')
        .delete()
        .eq('id', paymentId);

    if (deleteError) throw deleteError;

    // 2. Reverse the amount from the sale's amount_received and recalculate status
    const { data: sale, error: fetchError } = await supabase
        .from('sales')
        .select('gross_amount, amount_received')
        .eq('id', saleId)
        .single();

    if (fetchError) throw fetchError;

    const newAmountReceived = Math.max(0, Number(sale.amount_received) - Number(amount));
    const newStatus = newAmountReceived >= Number(sale.gross_amount) ? 'paid'
        : newAmountReceived > 0 ? 'partial' : 'due';

    const { error: updateError } = await supabase
        .from('sales')
        .update({ amount_received: newAmountReceived, payment_status: newStatus })
        .eq('id', saleId);

    if (updateError) throw updateError;
}






export async function getBuyersWithDue() {
    const { data: sales, error } = await supabase
        .from('sales')
        .select('buyer_id, gross_amount, amount_received, buyers(name)');

    if (error) throw error;

    const totals = {};
    sales.forEach(s => {
        if (!s.buyer_id) return;
        if (!totals[s.buyer_id]) {
            totals[s.buyer_id] = { id: s.buyer_id, name: s.buyers?.name || '-', outstanding_balance: 0 };
        }
        totals[s.buyer_id].outstanding_balance += Number(s.gross_amount) - Number(s.amount_received);
    });

    return Object.values(totals)
        .filter(b => b.outstanding_balance > 0.5)
        .sort((a, b) => b.outstanding_balance - a.outstanding_balance);
}


