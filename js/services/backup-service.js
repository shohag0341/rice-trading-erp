// Fetches every record in the system (across all modules) for the "Download
// Full Backup" feature in Settings. Read-only - never writes anything.
import { supabase } from './supabase-client.js';
import { getAllFarmers } from './farmer-service.js';
import { getAllBuyers } from './buyer-service.js';
import { getAllWarehouses } from './warehouse-service.js';
import { getAllPurchases } from './purchase-service.js';
import { getAllPaddyVarietiesIncludingInactive } from './purchase-service.js';
import { getAllSales } from './sale-service.js';
import { getAllExpenses } from './expense-service.js';
import { getAllCashAdjustments } from './cash-service.js';
import { getDamagedStock } from './inventory-service.js';

async function getAllFarmerPayments() {
    const { data, error } = await supabase
        .from('farmer_payments')
        .select('*, farmers(name), purchases(invoice_no)')
        .order('payment_date', { ascending: false });
    if (error) throw error;
    return data;
}

async function getAllBuyerPayments() {
    const { data, error } = await supabase
        .from('buyer_payments')
        .select('*, buyers(name), sales(invoice_no)')
        .order('payment_date', { ascending: false });
    if (error) throw error;
    return data;
}

// Fetches every table needed for a full backup, in parallel.
export async function getBackupData() {
    const [
        farmers, buyers, warehouses, varieties,
        purchases, sales, expenses, cashAdjustments, damagedStock,
        farmerPayments, buyerPayments
    ] = await Promise.all([
        getAllFarmers(),
        getAllBuyers(),
        getAllWarehouses(),
        getAllPaddyVarietiesIncludingInactive(),
        getAllPurchases(),
        getAllSales(),
        getAllExpenses(),
        getAllCashAdjustments(),
        getDamagedStock(),
        getAllFarmerPayments(),
        getAllBuyerPayments()
    ]);

    return {
        farmers, buyers, warehouses, varieties,
        purchases, sales, expenses, cashAdjustments, damagedStock,
        farmerPayments, buyerPayments
    };
}
