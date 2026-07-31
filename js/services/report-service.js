// Handles fetching filtered report data for Purchases, Sales, Expenses, Profit
import { supabase } from './supabase-client.js';

export async function getPurchaseReport(startDate, endDate) {
    const { data, error } = await supabase
        .from('purchases')
        .select('*, farmers(name, village), warehouses(name), paddy_varieties(name)')
        .gte('purchase_date', startDate)
        .lte('purchase_date', endDate)
        .order('purchase_date', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getSalesReport(startDate, endDate) {
    const { data, error } = await supabase
        .from('sales')
        .select('*, buyers(name, buyer_type), warehouses(name), paddy_varieties(name)')
        .gte('sale_date', startDate)
        .lte('sale_date', endDate)
        .order('sale_date', { ascending: false });

    if (error) throw error;
    return data;
}

export async function getExpenseReport(startDate, endDate) {
    const { data, error } = await supabase
        .from('expenses')
        .select('*, warehouses(name)')
        .gte('expense_date', startDate)
        .lte('expense_date', endDate)
        .order('expense_date', { ascending: false });

    if (error) throw error;
    return data;
}

// Profit report combines sales (revenue) and purchases+expenses (cost) for the period
export async function getProfitReport(startDate, endDate) {
    const [sales, expenses] = await Promise.all([
        getSalesReport(startDate, endDate),
        getExpenseReport(startDate, endDate)
    ]);

    const totalRevenue = sales.reduce((sum, s) => sum + Number(s.net_amount), 0);
    const totalCogs = sales.reduce((sum, s) => sum + (Number(s.maund) * Number(s.avg_cost_per_maund)), 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const grossProfit = totalRevenue - totalCogs;
    const netProfit = grossProfit - totalExpenses;

    return { sales, expenses, totalRevenue, totalCogs, totalExpenses, grossProfit, netProfit };
}

// Utility: get ISO date string ranges for quick filters
export function getDateRange(rangeType) {
    const today = new Date();
    const format = (d) => d.toISOString().split('T')[0];

    switch (rangeType) {
        case 'today':
            return { start: format(today), end: format(today) };

        case 'week': {
            const start = new Date(today);
            start.setDate(today.getDate() - today.getDay());
            return { start: format(start), end: format(today) };
        }

        case 'month': {
            const start = new Date(today.getFullYear(), today.getMonth(), 1);
            return { start: format(start), end: format(today) };
        }

        case 'year': {
            const start = new Date(today.getFullYear(), 0, 1);
            return { start: format(start), end: format(today) };
        }

        default:
            return { start: format(today), end: format(today) };
    }
}
