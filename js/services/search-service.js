// Global search used by the dashboard search bar. Searches Farmers, Buyers
// (by name/phone) and Purchases/Sales (by invoice number) in parallel, and
// returns a small number of top matches per category.
import { supabase } from './supabase-client.js';

const RESULT_LIMIT = 5;

async function searchFarmers(term) {
    const { data, error } = await supabase
        .from('farmers')
        .select('id, name, phone, village')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(RESULT_LIMIT);
    if (error) throw error;
    return data.map(f => ({
        type: 'farmer', id: f.id, title: f.name,
        subtitle: [f.phone, f.village].filter(Boolean).join(' · '),
        url: `farmer-profile.html?id=${f.id}`
    }));
}

async function searchBuyers(term) {
    const { data, error } = await supabase
        .from('buyers')
        .select('id, name, phone, buyer_type')
        .or(`name.ilike.%${term}%,phone.ilike.%${term}%`)
        .limit(RESULT_LIMIT);
    if (error) throw error;
    return data.map(b => ({
        type: 'buyer', id: b.id, title: b.name,
        subtitle: [b.phone, b.buyer_type].filter(Boolean).join(' · '),
        url: `buyer-profile.html?id=${b.id}`
    }));
}

async function searchPurchases(term) {
    const { data, error } = await supabase
        .from('purchases')
        .select('id, invoice_no, purchase_date, farmers(name)')
        .ilike('invoice_no', `%${term}%`)
        .limit(RESULT_LIMIT);
    if (error) throw error;
    return data.map(p => ({
        type: 'purchase', id: p.id, title: p.invoice_no,
        subtitle: p.farmers?.name || '',
        url: `purchases.html?search=${encodeURIComponent(p.invoice_no)}`
    }));
}

async function searchSales(term) {
    const { data, error } = await supabase
        .from('sales')
        .select('id, invoice_no, sale_date, buyers(name)')
        .ilike('invoice_no', `%${term}%`)
        .limit(RESULT_LIMIT);
    if (error) throw error;
    return data.map(s => ({
        type: 'sale', id: s.id, title: s.invoice_no,
        subtitle: s.buyers?.name || '',
        url: `sales.html?search=${encodeURIComponent(s.invoice_no)}`
    }));
}

/**
 * Runs a global search. Returns { farmers, buyers, purchases, sales } -
 * each an array of { type, id, title, subtitle, url }.
 */
export async function globalSearch(term) {
    if (!term || term.trim().length < 2) {
        return { farmers: [], buyers: [], purchases: [], sales: [] };
    }

    const [farmers, buyers, purchases, sales] = await Promise.all([
        searchFarmers(term),
        searchBuyers(term),
        searchPurchases(term),
        searchSales(term)
    ]);

    return { farmers, buyers, purchases, sales };
}
