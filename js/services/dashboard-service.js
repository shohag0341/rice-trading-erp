// Fetches data from the dashboard/analytics views created in the database
import { supabase } from './supabase-client.js';
import { getAverageCostPerMaund } from './sale-service.js';
import { getInventoryLossesForPeriod, getInventoryGainsForPeriod } from './inventory-service.js';




export async function getTodaySummary() {
    const today = new Date().toISOString().split('T')[0];

    const [purchaseRes, salesRes, todaysLoss, todaysGain] = await Promise.all([
        supabase.from('daily_purchase_summary').select('*').eq('purchase_date', today).maybeSingle(),
        supabase.from('daily_sales_summary').select('*').eq('sale_date', today).maybeSingle(),
        getInventoryLossesForPeriod(today, today),
        getInventoryGainsForPeriod(today, today)
    ]);

    const sales = salesRes.data || { total_net_amount: 0, total_profit: 0, total_maund: 0 };
    // A Loss is an immediate expense (reduces profit); a Gain is immediate "Other Income"
    // (increases profit) - symmetric treatment, matching the Reports P&L page.
    sales.total_profit = Number(sales.total_profit || 0) - todaysLoss + todaysGain;

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

// ---------- Trend chart data (Purchase / Sales / Profit), bucketed by week,
// month, year, or across all-time (bucketed by month). Computed client-side from
// raw rows so any time grouping can be produced without a matching DB view.
// Profit per bucket = that bucket's sale net_profit total, adjusted by Inventory
// Loss/Gain in the same period - the same treatment used everywhere else in the
// app (Today's Profit, Sales Report, P&L).
export async function getTrendData(granularity = 'monthly') {
    const today = new Date();
    let startDate = null;

    if (granularity === 'weekly') {
        const d = new Date(today);
        d.setDate(d.getDate() - 7 * 11); // last 12 weeks
        startDate = d.toISOString().split('T')[0];
    } else if (granularity === 'monthly') {
        const d = new Date(today.getFullYear(), today.getMonth() - 11, 1); // last 12 months
        startDate = d.toISOString().split('T')[0];
    } else if (granularity === 'yearly') {
        const d = new Date(today.getFullYear() - 4, 0, 1); // last 5 years
        startDate = d.toISOString().split('T')[0];
    }
    // 'alltime' -> startDate stays null (no lower bound), bucketed by month

    let purchaseQuery = supabase.from('purchases').select('purchase_date, net_cost');
    let salesQuery = supabase.from('sales').select('sale_date, net_amount, net_profit');
    let lossQuery = supabase.from('damaged_stock').select('damage_date, estimated_loss').eq('adjustment_type', 'loss');
    let gainQuery = supabase.from('damaged_stock').select('damage_date, estimated_loss').eq('adjustment_type', 'gain');

    if (startDate) {
        purchaseQuery = purchaseQuery.gte('purchase_date', startDate);
        salesQuery = salesQuery.gte('sale_date', startDate);
        lossQuery = lossQuery.gte('damage_date', startDate);
        gainQuery = gainQuery.gte('damage_date', startDate);
    }

    const [purchaseRes, salesRes, lossRes, gainRes] = await Promise.all([purchaseQuery, salesQuery, lossQuery, gainQuery]);
    if (purchaseRes.error) throw purchaseRes.error;
    if (salesRes.error) throw salesRes.error;
    if (lossRes.error) throw lossRes.error;
    if (gainRes.error) throw gainRes.error;

    const bucketKey = (dateStr) => {
        const d = new Date(dateStr);
        if (granularity === 'weekly') {
            const weekStart = new Date(d);
            weekStart.setDate(d.getDate() - d.getDay()); // Sunday-start week
            return weekStart.toISOString().split('T')[0];
        }
        if (granularity === 'yearly') {
            return `${d.getFullYear()}`;
        }
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; // monthly & alltime
    };

    const buckets = new Map();
    const ensure = (key) => {
        if (!buckets.has(key)) buckets.set(key, { key, purchase: 0, sales: 0, profit: 0 });
        return buckets.get(key);
    };

    purchaseRes.data.forEach(p => { ensure(bucketKey(p.purchase_date)).purchase += Number(p.net_cost); });
    salesRes.data.forEach(s => {
        const b = ensure(bucketKey(s.sale_date));
        b.sales += Number(s.net_amount);
        b.profit += Number(s.net_profit);
    });
    lossRes.data.forEach(l => { ensure(bucketKey(l.damage_date)).profit -= Number(l.estimated_loss || 0); });
    gainRes.data.forEach(g => { ensure(bucketKey(g.damage_date)).profit += Number(g.estimated_loss || 0); });

    return Array.from(buckets.keys()).sort().map(k => buckets.get(k));
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
// kgPerMaund: the business's real KG-per-Maund conversion factor (from Business Settings).
// Must be passed in by the caller - without it, this silently falls back to 40 and can
// disagree with the rest of the app if the business uses a different conversion factor.
export async function getTotalStockValue(kgPerMaund = 40) {
    const { data, error } = await supabase
        .from('current_stock')
        .select('warehouse_id, paddy_variety_id, current_maund');

    if (error) throw error;

    const stockedRows = data.filter(row => Number(row.current_maund) > 0);

    const costs = await Promise.all(
        stockedRows.map(row => getAverageCostPerMaund(row.warehouse_id, row.paddy_variety_id, kgPerMaund).catch(() => 0))
    );

    return stockedRows.reduce((sum, row, i) => sum + (Number(row.current_maund) * costs[i]), 0);
}
