// Fetches data from the dashboard/analytics views created in the database
import { supabase } from './supabase-client.js';

export async function getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];

    const [purchaseRes, salesRes] = await Promise.all([
        supabase.from('daily_purchase_summary').select('*').eq('purchase_date', today).maybeSingle(),
        supabase.from('daily_sales_summary').select('*').eq('sale_date', today).maybeSingle()
    ]);

    return {
        purchase: purchaseRes.data || { total_net_cost: 0, total_maund: 0 },
        sales: salesRes.data || { total_net_amount: 0, total_profit: 0, total_maund: 0 }
    };
}

export async function getCashBalance() {
    const { data, error } = await supabase.from('cash_flow_summary').select('*').maybeSingle();
    if (error) throw error;
    return data;
}

export async function getCurrentStockTotal() {
    const { data, error } = await supabase.from('current_stock').select('current_maund');
    if (error) throw error;
    return data.reduce((sum, row) => sum + Number(row.current_maund || 0), 0);
}

export async function getMonthlyTrend() {
    const { data, error } = await supabase.from('monthly_trend').select('*').order('month', { ascending: true });
    if (error) throw error;
    return data;
}

export async function getTopFarmers(limit = 5) {
    const { data, error } = await supabase.from('top_farmers').select('*').limit(limit);
    if (error) throw error;
    return data;
}

export async function getTopBuyers(limit = 5) {
    const { data, error } = await supabase.from('top_buyers').select('*').limit(limit);
    if (error) throw error;
    return data;
}

export async function getWarehouseUtilization() {
    const { data, error } = await supabase.from('warehouse_utilization').select('*');
    if (error) throw error;
    return data;
}
