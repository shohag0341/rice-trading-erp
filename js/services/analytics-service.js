// Handles analytics calculations
import { supabase } from './supabase-client.js';

// ---------- Date-range based summary (avg prices, profit per maund, turnover) ----------




export async function getAnalyticsSummary(startDate, endDate) {
    const [purchasesRes, salesRes, lossesRes] = await Promise.all([
        supabase.from('purchases').select('maund, price_per_maund, gross_amount')
            .gte('purchase_date', startDate).lte('purchase_date', endDate),
        supabase.from('sales').select('maund, selling_price_per_maund, gross_amount, net_profit')
            .gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('damaged_stock').select('estimated_loss')
            .eq('adjustment_type', 'loss')
            .gte('damage_date', startDate).lte('damage_date', endDate)
    ]);

    if (purchasesRes.error) throw purchasesRes.error;
    if (salesRes.error) throw salesRes.error;
    if (lossesRes.error) throw lossesRes.error;

    const purchases = purchasesRes.data;
    const sales = salesRes.data;
    const totalInventoryLoss = lossesRes.data.reduce((s, l) => s + Number(l.estimated_loss || 0), 0);

    const totalPurchaseMaund = purchases.reduce((s, p) => s + Number(p.maund), 0);
    const totalPurchaseAmount = purchases.reduce((s, p) => s + Number(p.gross_amount), 0);
    const avgPurchasePrice = totalPurchaseMaund > 0 ? totalPurchaseAmount / totalPurchaseMaund : 0;

    const totalSalesMaund = sales.reduce((s, x) => s + Number(x.maund), 0);
    const totalSalesAmount = sales.reduce((s, x) => s + Number(x.gross_amount), 0);
    const avgSellingPrice = totalSalesMaund > 0 ? totalSalesAmount / totalSalesMaund : 0;

    const totalProfit = sales.reduce((s, x) => s + Number(x.net_profit), 0) - totalInventoryLoss;
    const profitPerMaund = totalSalesMaund > 0 ? totalProfit / totalSalesMaund : 0;

    // Simple inventory turnover: how much of what was purchased has been sold (in this period)
    const inventoryTurnover = totalPurchaseMaund > 0 ? (totalSalesMaund / totalPurchaseMaund) * 100 : 0;

    return {
        avgPurchasePrice, avgSellingPrice, profitPerMaund,
        totalPurchaseMaund, totalSalesMaund, inventoryTurnover, totalProfit, totalInventoryLoss
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





// ---------- Variety-wise breakdown, filtered by date range ----------

    export async function getVarietyBreakdown(startDate, endDate) {
    const [purchasesRes, salesRes, varietiesRes, lossesRes] = await Promise.all([
        supabase.from('purchases')
            .select('paddy_variety_id, maund, price_per_maund, gross_amount, paddy_varieties(name)')
            .gte('purchase_date', startDate).lte('purchase_date', endDate),
        supabase.from('sales')
            .select('paddy_variety_id, maund, selling_price_per_maund, gross_amount, net_profit, paddy_varieties(name)')
            .gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('paddy_varieties').select('id, name').eq('is_active', true),
        supabase.from('damaged_stock').select('paddy_variety_id, estimated_loss')
            .eq('adjustment_type', 'loss')
            .gte('damage_date', startDate).lte('damage_date', endDate)
    ]);

    if (purchasesRes.error) throw purchasesRes.error;
    if (salesRes.error) throw salesRes.error;
    if (varietiesRes.error) throw varietiesRes.error;
    if (lossesRes.error) throw lossesRes.error;

    const purchases = purchasesRes.data;
    const sales = salesRes.data;
    const varieties = varietiesRes.data;
    const losses = lossesRes.data;

    // Build a breakdown per variety
    const breakdown = varieties.map(v => {
        const varietyPurchases = purchases.filter(p => p.paddy_variety_id === v.id);
        const varietySales = sales.filter(s => s.paddy_variety_id === v.id);
        const varietyLoss = losses
            .filter(l => l.paddy_variety_id === v.id)
            .reduce((s, l) => s + Number(l.estimated_loss || 0), 0);

        const purchaseMaund = varietyPurchases.reduce((s, p) => s + Number(p.maund), 0);
        const purchaseAmount = varietyPurchases.reduce((s, p) => s + Number(p.gross_amount), 0);
        const avgPurchasePrice = purchaseMaund > 0 ? purchaseAmount / purchaseMaund : 0;

        const salesMaund = varietySales.reduce((s, x) => s + Number(x.maund), 0);
        const salesAmount = varietySales.reduce((s, x) => s + Number(x.gross_amount), 0);
        const avgSellingPrice = salesMaund > 0 ? salesAmount / salesMaund : 0;

        const totalProfit = varietySales.reduce((s, x) => s + Number(x.net_profit), 0) - varietyLoss;
        const profitPerMaund = salesMaund > 0 ? totalProfit / salesMaund : 0;

        return {
            variety_name: v.name,
            purchaseMaund, avgPurchasePrice,
            salesMaund, avgSellingPrice,
            totalProfit, profitPerMaund
        };
    });


    

    // Only show varieties that had some activity in this period
    return breakdown.filter(b => b.purchaseMaund > 0 || b.salesMaund > 0);
}
