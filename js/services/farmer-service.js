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



// ---------- Profile page specific functions ----------

export async function getFarmerBalance(farmerId) {
    const { data, error } = await supabase
        .from('farmer_outstanding_balance')
        .select('*')
        .eq('farmer_id', farmerId)
        .maybeSingle();

    if (error) throw error;
    return data || { total_purchased: 0, total_paid: 0, outstanding_balance: 0 };
}

export async function getFarmerTotals(farmerId) {
    const { data, error } = await supabase
        .from('purchases')
        .select('gross_amount, amount_paid')
        .eq('farmer_id', farmerId);

    if (error) throw error;

    const totalPurchased = data.reduce((sum, p) => sum + Number(p.gross_amount), 0);
    const totalPaid = data.reduce((sum, p) => sum + Number(p.amount_paid), 0);

    return {
        total_purchased: totalPurchased,
        total_paid: totalPaid,
        outstanding_balance: totalPurchased - totalPaid,
        transaction_count: data.length
    };
}

export async function recordFarmerPayment(purchaseId, farmerId, amount, paymentMethod, userId) {
    // 1. Insert the payment record
    const { error: paymentError } = await supabase
        .from('farmer_payments')
        .insert([{
            purchase_id: purchaseId,
            farmer_id: farmerId,
            amount,
            payment_method: paymentMethod,
            created_by: userId
        }]);

    if (paymentError) throw paymentError;

    // 2. Update the purchase's amount_paid and payment_status
    const { data: purchase, error: fetchError } = await supabase
        .from('purchases')
        .select('gross_amount, amount_paid')
        .eq('id', purchaseId)
        .single();

    if (fetchError) throw fetchError;

    const newAmountPaid = Number(purchase.amount_paid) + Number(amount);
    const newStatus = newAmountPaid >= Number(purchase.gross_amount) ? 'paid'
        : newAmountPaid > 0 ? 'partial' : 'due';

    const { error: updateError } = await supabase
        .from('purchases')
        .update({ amount_paid: newAmountPaid, payment_status: newStatus })
        .eq('id', purchaseId);

    if (updateError) throw updateError;
}





// ---------- Recent payment history + delete/reverse ----------
export async function getFarmerPaymentsList(farmerId) {
    const { data, error } = await supabase
        .from('farmer_payments')
        .select('*, purchases(invoice_no)')
        .eq('farmer_id', farmerId)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) throw error;
    return data;
}

export async function deleteFarmerPayment(paymentId, purchaseId, amount) {
    // 1. Delete the payment record
    const { error: deleteError } = await supabase
        .from('farmer_payments')
        .delete()
        .eq('id', paymentId);

    if (deleteError) throw deleteError;

    // 2. Reverse the amount from the purchase's amount_paid and recalculate status
    const { data: purchase, error: fetchError } = await supabase
        .from('purchases')
        .select('gross_amount, amount_paid')
        .eq('id', purchaseId)
        .single();

    if (fetchError) throw fetchError;

    const newAmountPaid = Math.max(0, Number(purchase.amount_paid) - Number(amount));
    const newStatus = newAmountPaid >= Number(purchase.gross_amount) ? 'paid'
        : newAmountPaid > 0 ? 'partial' : 'due';

    const { error: updateError } = await supabase
        .from('purchases')
        .update({ amount_paid: newAmountPaid, payment_status: newStatus })
        .eq('id', purchaseId);

    if (updateError) throw updateError;
}
