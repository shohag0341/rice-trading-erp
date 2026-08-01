// Handles analytics calculations
import { supabase } from './supabase-client.js';

// ---------- Date-range based summary (avg prices, profit per maund, turnover) ----------
export async function getAnalyticsSummary(startDate, endDate) {
    const [purchasesRes, salesRes] = await Promise.all([
        supabase.from('purchases').select('maund, price_per_maund, gross_amount')
            .gte('purchase_date', startDate).lte('purchase_date', endDate),
        supabase.from('sales').select('maund, selling_price_per_maund, gross_amount, net_profit')
            .gte('sale_date', startDate).lte('sale_date', endDate)
    ]);

    if (purchasesRes.error) throw purchasesRes.error;
    if (salesRes.error) throw salesRes.error;

    const purchases = purchasesRes.data;
    const sales = salesRes.data;

    const totalPurchaseMaund = purchases.reduce((s, p) => s + Number(p.maund), 0);
    const totalPurchaseAmount = purchases.reduce((s, p) => s + Number(p.gross_amount), 0);
    const avgPurchasePrice = totalPurchaseMaund > 0 ? totalPurchaseAmount / totalPurchaseMaund : 0;

    const totalSalesMaund = sales.reduce((s, x) => s + Number(x.maund), 0);
    const totalSalesAmount = sales.reduce((s, x) => s + Number(x.gross_amount), 0);
    const avgSellingPrice = totalSalesMaund > 0 ? totalSalesAmount / totalSalesMaund : 0;

    const totalProfit = sales.reduce((s, x) => s + Number(x.net_profit), 0);
    const profitPerMaund = totalSalesMaund > 0 ? totalProfit / totalSalesMaund : 0;

    // Simple inventory turnover: how much of what was purchased has been sold (in this period)
    const inventoryTurnover = totalPurchaseMaund > 0 ? (totalSalesMaund / totalPurchaseMaund) * 100 : 0;

    return {
        avgPurchasePrice, avgSellingPrice, profitPerMaund,
        totalPurchaseMaund, totalSalesMaund, inventoryTurnover, totalProfit
    };
}

// ---------- All-time "Best" leaderboards (reuse existing views) ----------
export async function getBestVillage() {
    const { data, error } = await supabase.from('village_profitability').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getBestFarmer() {
    const { data, error } = await supabase.from('top_farmers').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getBestBuyer() {
    const { data, error } = await supabase.from('top_buyers').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

export async function getBestVariety() {
    const { data, error } = await supabase.from('variety_profitability').select('*').limit(1).maybeSingle();
    if (error) throw error;
    return data;
}

// ---------- Top 5 lists for each category ----------
export async function getTopVillages(limit = 5) {
    const { data, error } = await supabase.from('village_profitability').select('*').limit(limit);
    if (error) throw error;
    return data;
}

export async function getTopVarieties(limit = 5) {
    const { data, error } = await supabase.from('variety_profitability').select('*').limit(limit);
    if (error) throw error;
    return data;
}
