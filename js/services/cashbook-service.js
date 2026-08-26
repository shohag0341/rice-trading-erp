// Builds a chronological Cash Book: every cash-affecting transaction
// (Purchases, Sales, Expenses, Cash Adjustments) merged into one list with a
// running balance (Balance Before -> Amount -> Balance After).
//
// This mirrors the exact same formula as the cash_flow_summary DB view
// (Opening Balance + Sales Received - Purchases Paid - Expenses
//  - Purchase-side costs - Sales-side costs - Cash Out + Cash In),
// so the closing balance always agrees with the Dashboard's Cash Balance card.
import { supabase } from './supabase-client.js';
import { getBusinessSettings } from './settings-service.js';

// Net cash-balance change contributed by every record dated strictly before `date`.
async function getBalanceCarriedForward(date) {
    const [settings, purchases, sales, expenses, cashOut, cashIn] = await Promise.all([
        getBusinessSettings(),
        supabase.from('purchases').select('amount_paid, transport_cost, labour_cost, food_cost, other_expenses').lt('purchase_date', date),
        supabase.from('sales').select('amount_received, transport_cost, labour_cost, commission, other_expenses').lt('sale_date', date),
        supabase.from('expenses').select('amount').lt('expense_date', date),
        supabase.from('cash_adjustments').select('amount').eq('adjustment_type', 'cash_out').lt('adjustment_date', date),
        supabase.from('cash_adjustments').select('amount').eq('adjustment_type', 'cash_in').lt('adjustment_date', date),
    ]);

    if (purchases.error) throw purchases.error;
    if (sales.error) throw sales.error;
    if (expenses.error) throw expenses.error;
    if (cashOut.error) throw cashOut.error;
    if (cashIn.error) throw cashIn.error;

    const opening = Number(settings.opening_cash_balance) || 0;
    const salesIn = sales.data.reduce((s, x) => s + Number(x.amount_received), 0);
    const purchaseOut = purchases.data.reduce((s, x) => s + Number(x.amount_paid), 0);
    const expenseOut = expenses.data.reduce((s, x) => s + Number(x.amount), 0);
    const purchaseSideCosts = purchases.data.reduce((s, x) => s + Number(x.transport_cost) + Number(x.labour_cost) + Number(x.food_cost) + Number(x.other_expenses), 0);
    const salesSideCosts = sales.data.reduce((s, x) => s + Number(x.transport_cost) + Number(x.labour_cost) + Number(x.commission) + Number(x.other_expenses), 0);
    const cashOutTotal = cashOut.data.reduce((s, x) => s + Number(x.amount), 0);
    const cashInTotal = cashIn.data.reduce((s, x) => s + Number(x.amount), 0);

    return opening + salesIn - purchaseOut - expenseOut - purchaseSideCosts - salesSideCosts - cashOutTotal + cashInTotal;
}

export async function getCashBookLedger(startDate, endDate) {
    const [openingBalance, purchases, sales, expenses, adjustments] = await Promise.all([
        getBalanceCarriedForward(startDate),
        supabase.from('purchases')
            .select('purchase_date, created_at, invoice_no, amount_paid, transport_cost, labour_cost, food_cost, other_expenses, farmers(name)')
            .gte('purchase_date', startDate).lte('purchase_date', endDate),
        supabase.from('sales')
            .select('sale_date, created_at, invoice_no, amount_received, transport_cost, labour_cost, commission, other_expenses, buyers(name)')
            .gte('sale_date', startDate).lte('sale_date', endDate),
        supabase.from('expenses')
            .select('expense_date, created_at, category, description, amount')
            .gte('expense_date', startDate).lte('expense_date', endDate),
        supabase.from('cash_adjustments')
            .select('adjustment_date, created_at, adjustment_type, amount, reason')
            .gte('adjustment_date', startDate).lte('adjustment_date', endDate),
    ]);

    if (purchases.error) throw purchases.error;
    if (sales.error) throw sales.error;
    if (expenses.error) throw expenses.error;
    if (adjustments.error) throw adjustments.error;

    const rows = [];

    purchases.data.forEach(p => {
        // Net cash impact = amount paid to farmer + transport/labour/food/other,
        // all paid out in cash on the spot.
        const cashOut = Number(p.amount_paid) + Number(p.transport_cost) + Number(p.labour_cost) + Number(p.food_cost) + Number(p.other_expenses);
        rows.push({
            date: p.purchase_date,
            created_at: p.created_at,
            type: 'purchase',
            label: 'Purchase',
            description: `${p.invoice_no || ''} - ${p.farmers?.name || 'Unknown Farmer'}`,
            amount: -cashOut
        });
    });

    sales.data.forEach(s => {
        // Net cash impact = amount received from buyer minus transport/labour/commission/other,
        // which are paid out of the sale proceeds immediately.
        const cashIn = Number(s.amount_received) - Number(s.transport_cost) - Number(s.labour_cost) - Number(s.commission) - Number(s.other_expenses);
        rows.push({
            date: s.sale_date,
            created_at: s.created_at,
            type: 'sale',
            label: 'Sale',
            description: `${s.invoice_no || ''} - ${s.buyers?.name || 'Unknown Buyer'}`,
            amount: cashIn
        });
    });

    expenses.data.forEach(e => {
        rows.push({
            date: e.expense_date,
            created_at: e.created_at,
            type: 'expense',
            label: 'Expense',
            description: `${e.category}${e.description ? ' - ' + e.description : ''}`,
            amount: -Number(e.amount)
        });
    });

    adjustments.data.forEach(a => {
        rows.push({
            date: a.adjustment_date,
            created_at: a.created_at,
            type: a.adjustment_type,
            label: a.adjustment_type === 'cash_out' ? 'Cash Out' : 'Cash Returned',
            description: a.reason || '-',
            amount: a.adjustment_type === 'cash_out' ? -Number(a.amount) : Number(a.amount)
        });
    });

    // Chronological order: date first, then created_at as tiebreaker for same-day entries.
    rows.sort((a, b) => {
        if (a.date !== b.date) return a.date < b.date ? -1 : 1;
        return new Date(a.created_at) - new Date(b.created_at);
    });

    let balance = openingBalance;
    rows.forEach(row => {
        row.balanceBefore = balance;
        balance += row.amount;
        row.balanceAfter = balance;
    });

    // Balance must be computed oldest -> newest (above), but shown newest -> oldest,
    // like a bank statement. Each row already carries its own correct
    // balanceBefore/balanceAfter, so reversing the display order here is safe.
    rows.reverse();

    return { openingBalance, rows, closingBalance: balance };
}
