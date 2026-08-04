// Fetches data from the dashboard/analytics views created in the database
import { supabase } from './supabase-client.js';
import { getAverageCostPerMaund } from './sale-service.js';
import { getInventoryLossesForPeriod } from './inventory-service.js';




export async function getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];

    const [purchaseRes, salesRes, todaysLoss] = await Promise.all([
        supabase.from('daily_purchase_summary').select('*').eq('purchase_date', today).maybeSingle(),
        supabase.from('daily_sales_summary').select('*').eq('sale_date', today).maybeSingle(),
        getInventoryLossesForPeriod(today, today)
    ]);

    const sales = salesRes.data || { total_net_amount: 0, total_profit: 0, total_maund: 0 };
    sales.total_profit = Number(sales.total_profit || 0) - todaysLoss;

    return {
        purchase: purchaseRes.data || { total_net_cost: 0, total_maund: 0 },
        sales
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


// ---------- Total value of all current stock (quantity × avg cost, per warehouse+variety) ----------
export async function getTotalStockValue() {
    const { data, error } = await supabase
        .from('current_stock')
        .select('warehouse_id, paddy_variety_id, current_maund');

    if (error) throw error;

    const stockedRows = data.filter(row => Number(row.current_maund) > 0);

    const costs = await Promise.all(
        stockedRows.map(row => getAverageCostPerMaund(row.warehouse_id, row.paddy_variety_id).catch(() => 0))
    );

    return stockedRows.reduce((sum, row, i) => sum + (Number(row.current_maund) * costs[i]), 0);
}
