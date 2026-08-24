import { initLayout, getCurrentProfile } from './layout.js';
import {
    getPurchaseReport, getSalesReport, getExpenseReport, getProfitReport, getDateRange,
    getCombinedCostReport
} from './services/report-service.js';
import { recordFarmerPayment } from './services/farmer-service.js';
import { recordBuyerPayment } from './services/buyer-service.js';
import { formatDate } from './utils/date-format.js';


await initLayout('reports');

const fmt = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 2 }).format(num || 0);

let currentReportType = 'purchase';
let currentStartDate = '';
let currentEndDate = '';

const reportTypeSelect = document.getElementById('reportType');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const summaryGrid = document.getElementById('summaryGrid');
const tableContainer = document.getElementById('reportTableContainer');
const printBtn = document.getElementById('printBtn');
const quickRangeBtns = document.querySelectorAll('.quick-range-btn');

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ---------- Quick range buttons ----------
quickRangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        quickRangeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const range = getDateRange(btn.dataset.range);
        currentStartDate = range.start;
        currentEndDate = range.end;
        startDateInput.value = range.start;
        endDateInput.value = range.end;

        loadReport();
    });
});

// ---------- Manual date change ----------
[startDateInput, endDateInput].forEach(input => {
    input.addEventListener('change', () => {
        quickRangeBtns.forEach(b => b.classList.remove('active'));
        currentStartDate = startDateInput.value;
        currentEndDate = endDateInput.value;
        if (currentStartDate && currentEndDate) loadReport();
    });
});

reportTypeSelect.addEventListener('change', () => {
    currentReportType = reportTypeSelect.value;
    loadReport();
});

printBtn.addEventListener('click', () => window.print());








// ---------- Main report loader ----------
async function loadReport() {
    if (!currentStartDate || !currentEndDate) return;

    summaryGrid.innerHTML = `<div class="summary-mini-card"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;
    tableContainer.innerHTML = '';

    try {
        if (currentReportType === 'purchase') {
            await renderPurchaseReport();
        } else if (currentReportType === 'sales') {
            await renderSalesReport();
        } else if (currentReportType === 'expense') {
            await renderExpenseReport();

            
        } else if (currentReportType === 'profit') {
            await renderProfitReport();
        } else if (currentReportType === 'costanalysis') {
            await renderCostAnalysisReport();
        }


        
    } catch (err) {
        showToast('Failed to load report: ' + err.message, 'error');
        summaryGrid.innerHTML = '';
        tableContainer.innerHTML = `<div class="table-empty">Could not load report data.</div>`;
    }
}

// ---------- Purchase Report ----------


async function renderPurchaseReport() {
    const data = await getPurchaseReport(currentStartDate, currentEndDate);

    const totalMaund = data.reduce((s, p) => s + Number(p.maund), 0);
    const totalCost = data.reduce((s, p) => s + Number(p.net_cost), 0);
    const totalGross = data.reduce((s, p) => s + Number(p.gross_amount), 0);
    const totalPaid = data.reduce((s, p) => s + Number(p.amount_paid), 0);
    const totalTransport = data.reduce((s, p) => s + Number(p.transport_cost), 0);
    const totalLabour = data.reduce((s, p) => s + Number(p.labour_cost), 0);
    const totalFood = data.reduce((s, p) => s + Number(p.food_cost), 0);
    const totalOther = data.reduce((s, p) => s + Number(p.other_expenses), 0);

    summaryGrid.innerHTML = `
        <div class="summary-mini-card"><div class="summary-mini-label">Transactions</div><div class="summary-mini-value">${data.length}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Total Quantity</div><div class="summary-mini-value">${fmt(totalMaund)} Md</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Total Cost</div><div class="summary-mini-value">৳${fmt(totalCost)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Farmer Due</div><div class="summary-mini-value">৳${fmt(totalGross - totalPaid)}</div></div>
    `;

    if (!data.length) {
        tableContainer.innerHTML = `<div class="table-empty"><i class="fa-solid fa-inbox"></i><div>No purchases in this date range.</div></div>`;
        return;
    }

    tableContainer.innerHTML = `
        <div class="card-box" style="margin-bottom:18px;">
            <div class="card-box-title">Cost Breakdown (Transport / Labour / Food / Other)</div>
            <div class="calc-summary">
                <div class="calc-row"><span>Transport Cost</span><span>৳${fmt(totalTransport)}</span></div>
                <div class="calc-row"><span>Labour Cost</span><span>৳${fmt(totalLabour)}</span></div>
                <div class="calc-row"><span>Food Cost</span><span>৳${fmt(totalFood)}</span></div>
                <div class="calc-row"><span>Other Expenses</span><span>৳${fmt(totalOther)}</span></div>
                <div class="calc-row total"><span>Total Additional Cost</span><span>৳${fmt(totalTransport + totalLabour + totalFood + totalOther)}</span></div>
            </div>
        </div>

        <div class="data-table-wrapper">
            <table>
                <thead><tr><th>Invoice</th><th>Date</th><th>Farmer</th><th>Transport</th><th>Labour</th><th>Food</th><th>Other</th><th>Net Cost</th><th>Due</th><th>Action</th></tr></thead>
                <tbody>
                    ${data.map(p => {
                        const due = Number(p.gross_amount) - Number(p.amount_paid);
                        return `
                        <tr>
                            <td>
                                <span class="invoice-badge">${p.invoice_no}</span>
                                ${due > 0 ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-danger); margin-left:6px;" title="Farmer has due"></i>' : ''}
                            </td>
                            <td>${formatDate(p.purchase_date)}</td>
                            <td>${p.farmers?.name || '-'}</td>
                            <td>৳${fmt(p.transport_cost)}</td>
                            <td>৳${fmt(p.labour_cost)}</td>
                            <td>৳${fmt(p.food_cost)}</td>
                            <td>৳${fmt(p.other_expenses)}</td>
                            <td>৳${fmt(p.net_cost)}</td>
                            <td style="color:${due > 0 ? 'var(--color-danger)' : 'var(--text-secondary)'}; font-weight:${due > 0 ? '700' : '400'};">৳${fmt(due)}</td>
                            <td>
                                ${due > 0 ? `<button class="btn-secondary pay-farmer-btn" data-id="${p.id}" data-farmer-id="${p.farmers?.id}" data-due="${due}" style="padding:6px 12px; font-size:12px;">Pay</button>` : '-'}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.pay-farmer-btn').forEach(btn => {
        btn.addEventListener('click', () => openPaymentModal('farmer', btn.dataset.id, btn.dataset.farmerId, btn.dataset.due));
    });
}



// ---------- Sales Report ----------

async function renderSalesReport() {
    const data = await getSalesReport(currentStartDate, currentEndDate);

    const totalMaund = data.reduce((s, x) => s + Number(x.maund), 0);
    const totalAmount = data.reduce((s, x) => s + Number(x.net_amount), 0);
    const totalProfit = data.reduce((s, x) => s + Number(x.net_profit), 0);
    const totalGross = data.reduce((s, x) => s + Number(x.gross_amount), 0);
    const totalReceived = data.reduce((s, x) => s + Number(x.amount_received), 0);
    const totalTransport = data.reduce((s, x) => s + Number(x.transport_cost), 0);
    const totalLabour = data.reduce((s, x) => s + Number(x.labour_cost), 0);
    const totalCommission = data.reduce((s, x) => s + Number(x.commission), 0);
    const totalOther = data.reduce((s, x) => s + Number(x.other_expenses), 0);

    summaryGrid.innerHTML = `
        <div class="summary-mini-card"><div class="summary-mini-label">Transactions</div><div class="summary-mini-value">${data.length}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Total Quantity</div><div class="summary-mini-value">${fmt(totalMaund)} Md</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Total Sales</div><div class="summary-mini-value">৳${fmt(totalAmount)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Total Profit</div><div class="summary-mini-value" style="color:${totalProfit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}">৳${fmt(totalProfit)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Buyer Due</div><div class="summary-mini-value">৳${fmt(totalGross - totalReceived)}</div></div>
    `;

    if (!data.length) {
        tableContainer.innerHTML = `<div class="table-empty"><i class="fa-solid fa-inbox"></i><div>No sales in this date range.</div></div>`;
        return;
    }




    
    tableContainer.innerHTML = `
        <div class="card-box" style="margin-bottom:18px;">
            <div class="card-box-title">Cost Breakdown (Transport / Labour / Commission / Other)</div>
            <div class="calc-summary">
                <div class="calc-row"><span>Transport Cost</span><span>৳${fmt(totalTransport)}</span></div>
                <div class="calc-row"><span>Labour Cost</span><span>৳${fmt(totalLabour)}</span></div>
                <div class="calc-row"><span>Commission</span><span>৳${fmt(totalCommission)}</span></div>
                <div class="calc-row"><span>Other Expenses</span><span>৳${fmt(totalOther)}</span></div>
                <div class="calc-row total"><span>Total Additional Cost</span><span>৳${fmt(totalTransport + totalLabour + totalCommission + totalOther)}</span></div>
            </div>
        </div>

        <div class="data-table-wrapper">
            <table>
                <thead><tr><th>Invoice</th><th>Date</th><th>Buyer</th><th>Net Amount</th><th>Profit</th><th>Due</th><th>Action</th></tr></thead>
                <tbody>
                    ${data.map(s => {
                        const due = Number(s.gross_amount) - Number(s.amount_received);
                        return `
                        <tr>
                            <td>
                                <span class="invoice-badge">${s.invoice_no}</span>
                                ${due > 0 ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--color-danger); margin-left:6px;" title="Buyer owes payment"></i>' : ''}
                            </td>
                            <td>${formatDate(s.sale_date)}</td>
                            <td>${s.buyers?.name || '-'}</td>
                            <td>৳${fmt(s.net_amount)}</td>
                            <td style="color:${s.net_profit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}; font-weight:700;">৳${fmt(s.net_profit)}</td>
                            <td style="color:${due > 0 ? 'var(--color-danger)' : 'var(--text-secondary)'}; font-weight:${due > 0 ? '700' : '400'};">৳${fmt(due)}</td>
                            <td>
                                ${due > 0 ? `<button class="btn-secondary pay-buyer-btn" data-id="${s.id}" data-buyer-id="${s.buyers?.id}" data-due="${due}" style="padding:6px 12px; font-size:12px;">Collect</button>` : '-'}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.pay-buyer-btn').forEach(btn => {
        btn.addEventListener('click', () => openPaymentModal('buyer', btn.dataset.id, btn.dataset.buyerId, btn.dataset.due));
    });
}






// ---------- Expense Report ----------
async function renderExpenseReport() {
    const data = await getExpenseReport(currentStartDate, currentEndDate);
    const totalAmount = data.reduce((s, e) => s + Number(e.amount), 0);

    const byCategory = {};
    data.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount); });
    const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];

    summaryGrid.innerHTML = `
        <div class="summary-mini-card"><div class="summary-mini-label">Transactions</div><div class="summary-mini-value">${data.length}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Total Expenses</div><div class="summary-mini-value">৳${fmt(totalAmount)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Top Category</div><div class="summary-mini-value" style="font-size:15px;">${topCategory ? topCategory[0] : '-'}</div></div>
    `;

    if (!data.length) {
        tableContainer.innerHTML = `<div class="table-empty"><i class="fa-solid fa-inbox"></i><div>No expenses in this date range.</div></div>`;
        return;
    }

    tableContainer.innerHTML = `
        <div class="data-table-wrapper">
            <table>
                <thead><tr><th>Date</th><th>Category</th><th>Warehouse</th><th>Description</th><th>Amount</th></tr></thead>
                <tbody>
                    ${data.map(e => `
                        <tr>
                            <td>${formatDate(e.expense_date)}</td>
                            <td><span class="badge badge-success">${e.category}</span></td>
                            <td>${e.warehouses?.name || '-'}</td>
                            <td>${e.description || '-'}</td>
                            <td>৳${fmt(e.amount)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ---------- Profit Report ----------
async function renderProfitReport() {
    const report = await getProfitReport(currentStartDate, currentEndDate);

    summaryGrid.innerHTML = `
        <div class="summary-mini-card"><div class="summary-mini-label">Total Revenue</div><div class="summary-mini-value">৳${fmt(report.totalRevenue)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Cost of Goods</div><div class="summary-mini-value">৳${fmt(report.totalCogs)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Operating Expenses</div><div class="summary-mini-value">৳${fmt(report.totalExpenses)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Net Profit</div><div class="summary-mini-value" style="color:${report.netProfit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}">৳${fmt(report.netProfit)}</div></div>
    `;

    // Build per-invoice profit/loss rows from the sales already fetched for this period
    const sortedSales = [...report.sales].sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date));
    const invoiceRows = sortedSales.map(s => {
        const revenue = Number(s.net_amount);
        const cost = Number(s.maund) * Number(s.avg_cost_per_maund);
        const profit = revenue - cost;
        const profitColor = profit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)';
        return `
            <tr>
                <td><span class="invoice-badge">${s.invoice_no}</span></td>
                <td>${formatDate(s.sale_date)}</td>
                <td>${s.buyers?.name || '-'}</td>
                <td>৳${fmt(revenue)}</td>
                <td>৳${fmt(cost)}</td>
                <td style="color:${profitColor}; font-weight:700;">৳${fmt(profit)}</td>
            </tr>`;
    }).join('');

    tableContainer.innerHTML = `
        <div class="card-box">
            <div class="card-box-title">Profit & Loss Statement</div>
            <div class="calc-summary">
                <div class="calc-row"><span>Total Revenue (Sales)</span><span>৳${fmt(report.totalRevenue)}</span></div>
                <div class="calc-row"><span>Cost of Goods Sold</span><span>- ৳${fmt(report.totalCogs)}</span></div>
                <div class="calc-row total"><span>Gross Profit</span><span>৳${fmt(report.grossProfit)}</span></div>
               
                
                
                <div class="calc-row"><span>Operating Expenses</span><span>- ৳${fmt(report.totalExpenses)}</span></div>
                <div class="calc-row"><span>Inventory Losses (drying/damage)</span><span>- ৳${fmt(report.totalInventoryLoss)}</span></div>
                <div class="calc-row"><span>Inventory Gains (surplus found)</span><span>+ ৳${fmt(report.totalInventoryGain)}</span></div>
                <div class="calc-row total" style="color:${report.netProfit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}"><span>Net Profit</span><span>৳${fmt(report.netProfit)}</span></div>


                
            </div>
        </div>

        <div class="card-box" style="margin-top:18px;">
            <div class="card-box-title">Invoice-wise Profit / Loss</div>
            <div class="data-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Invoice</th>
                            <th>Date</th>
                            <th>Buyer</th>
                            <th>Revenue</th>
                            <th>Cost</th>
                            <th>Profit / Loss</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoiceRows || `<tr><td colspan="6" class="table-empty">No sales in this period.</td></tr>`}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}



// ---------- Cost Analysis Report (Combined, but kept separate by source) ----------
async function renderCostAnalysisReport() {
    const report = await getCombinedCostReport(currentStartDate, currentEndDate);

    summaryGrid.innerHTML = `
        <div class="summary-mini-card"><div class="summary-mini-label">Purchase-side Costs</div><div class="summary-mini-value">৳${fmt(report.totalPurchaseCost)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Sales-side Costs</div><div class="summary-mini-value">৳${fmt(report.totalSalesCost)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Operating Expenses</div><div class="summary-mini-value">৳${fmt(report.totalOperatingExpense)}</div></div>
        <div class="summary-mini-card"><div class="summary-mini-label">Grand Total</div><div class="summary-mini-value" style="color:var(--color-danger);">৳${fmt(report.grandTotal)}</div></div>
    `;


tableContainer.innerHTML = `
        <div class="card-box" style="margin-bottom:18px;">
            <div class="card-box-title"><i class="fa-solid fa-cart-shopping"></i> Purchase-side Costs (from buying paddy)</div>
            <div class="calc-summary">
                <div class="calc-row"><span>Transport</span><span>৳${fmt(report.purchaseCosts.transport)}</span></div>
                <div class="calc-row"><span>Labour</span><span>৳${fmt(report.purchaseCosts.labour)}</span></div>
                <div class="calc-row"><span>Food</span><span>৳${fmt(report.purchaseCosts.food)}</span></div>
                <div class="calc-row"><span>Other</span><span>৳${fmt(report.purchaseCosts.other)}</span></div>
                <div class="calc-row total"><span>Subtotal</span><span>৳${fmt(report.totalPurchaseCost)}</span></div>
            </div>
        </div>

        <div class="card-box" style="margin-bottom:18px;">
            <div class="card-box-title"><i class="fa-solid fa-money-bill-trend-up"></i> Sales-side Costs (from selling rice)</div>
            <div class="calc-summary">
                <div class="calc-row"><span>Transport</span><span>৳${fmt(report.salesCosts.transport)}</span></div>
                <div class="calc-row"><span>Labour</span><span>৳${fmt(report.salesCosts.labour)}</span></div>
                <div class="calc-row"><span>Commission</span><span>৳${fmt(report.salesCosts.commission)}</span></div>
                <div class="calc-row"><span>Other</span><span>৳${fmt(report.salesCosts.other)}</span></div>
                <div class="calc-row total"><span>Subtotal</span><span>৳${fmt(report.totalSalesCost)}</span></div>
            </div>
        </div>

        <div class="card-box">
            <div class="card-box-title"><i class="fa-solid fa-receipt"></i> Operating Expenses (rent, electricity, etc.)</div>
            <div class="calc-summary">
                ${Object.keys(report.expensesByCategory).length ? Object.entries(report.expensesByCategory).map(([cat, amount]) => `
                    <div class="calc-row"><span>${cat}</span><span>৳${fmt(amount)}</span></div>
                `).join('') : '<div class="calc-row"><span>No operating expenses in this period</span></div>'}
                <div class="calc-row total"><span>Subtotal</span><span>৳${fmt(report.totalOperatingExpense)}</span></div>
            </div>
        </div>
    `;
}



// ---------- Payment Modal (shared for Farmer & Buyer) ----------
const paymentModal = document.getElementById('paymentModal');
let payingType = null;
let payingRecordId = null;
let payingPartyId = null;

function openPaymentModal(type, recordId, partyId, due) {
    payingType = type;
    payingRecordId = recordId;
    payingPartyId = partyId;

    document.getElementById('paymentModalTitle').textContent = type === 'farmer' ? 'Pay Farmer' : 'Collect from Buyer';
    document.getElementById('paymentDueAmount').textContent = `৳${fmt(due)}`;
    document.getElementById('paymentAmount').value = due;
    document.getElementById('paymentAmount').max = due;
    paymentModal.classList.add('open');
}

document.getElementById('paymentModalClose').addEventListener('click', () => paymentModal.classList.remove('open'));
document.getElementById('paymentCancelBtn').addEventListener('click', () => paymentModal.classList.remove('open'));
paymentModal.addEventListener('click', (e) => { if (e.target === paymentModal) paymentModal.classList.remove('open'); });

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const method = document.getElementById('paymentMethodSelect').value;

    if (!amount || amount <= 0) {
        showToast('Enter a valid payment amount.', 'error');
        return;
    }

    const submitBtn = document.getElementById('paymentSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';

    try {
        const profile = getCurrentProfile();

        if (payingType === 'farmer') {
            await recordFarmerPayment(payingRecordId, payingPartyId, amount, method, profile?.id);
            showToast('Payment recorded successfully.');
        } else {
            await recordBuyerPayment(payingRecordId, payingPartyId, amount, method, profile?.id);
            showToast('Payment collected successfully.');
        }

        paymentModal.classList.remove('open');
        loadReport();
    } catch (err) {
        showToast('Payment failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Record Payment';
    }
});


// ---------- Init: check URL params first, else default to "This Month" ----------
const urlParams = new URLSearchParams(window.location.search);
const urlReportType = urlParams.get('type');
const urlRange = urlParams.get('range');

if (urlReportType) {
    reportTypeSelect.value = urlReportType;
    currentReportType = urlReportType;
}

const targetRange = urlRange || 'month';
document.querySelector(`.quick-range-btn[data-range="${targetRange}"]`).click();
