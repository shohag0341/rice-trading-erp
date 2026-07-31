import { initLayout } from './layout.js';
import {
    getPurchaseReport, getSalesReport, getExpenseReport, getProfitReport, getDateRange
} from './services/report-service.js';

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
                <thead><tr><th>Invoice</th><th>Date</th><th>Farmer</th><th>Transport</th><th>Labour</th><th>Food</th><th>Other</th><th>Net Cost</th></tr></thead>
                <tbody>
                    ${data.map(p => `
                        <tr>
                            <td><span class="invoice-badge">${p.invoice_no}</span></td>
                            <td>${new Date(p.purchase_date).toLocaleDateString('en-GB')}</td>
                            <td>${p.farmers?.name || '-'}</td>
                            <td>৳${fmt(p.transport_cost)}</td>
                            <td>৳${fmt(p.labour_cost)}</td>
                            <td>৳${fmt(p.food_cost)}</td>
                            <td>৳${fmt(p.other_expenses)}</td>
                            <td>৳${fmt(p.net_cost)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
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
                <thead><tr><th>Invoice</th><th>Date</th><th>Buyer</th><th>Transport</th><th>Labour</th><th>Commission</th><th>Other</th><th>Net Amount</th><th>Profit</th></tr></thead>
                <tbody>
                    ${data.map(s => `
                        <tr>
                            <td><span class="invoice-badge">${s.invoice_no}</span></td>
                            <td>${new Date(s.sale_date).toLocaleDateString('en-GB')}</td>
                            <td>${s.buyers?.name || '-'}</td>
                            <td>৳${fmt(s.transport_cost)}</td>
                            <td>৳${fmt(s.labour_cost)}</td>
                            <td>৳${fmt(s.commission)}</td>
                            <td>৳${fmt(s.other_expenses)}</td>
                            <td>৳${fmt(s.net_amount)}</td>
                            <td style="color:${s.net_profit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}; font-weight:700;">৳${fmt(s.net_profit)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
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
                            <td>${new Date(e.expense_date).toLocaleDateString('en-GB')}</td>
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

    tableContainer.innerHTML = `
        <div class="card-box">
            <div class="card-box-title">Profit & Loss Statement</div>
            <div class="calc-summary">
                <div class="calc-row"><span>Total Revenue (Sales)</span><span>৳${fmt(report.totalRevenue)}</span></div>
                <div class="calc-row"><span>Cost of Goods Sold</span><span>- ৳${fmt(report.totalCogs)}</span></div>
                <div class="calc-row total"><span>Gross Profit</span><span>৳${fmt(report.grossProfit)}</span></div>
                <div class="calc-row"><span>Operating Expenses</span><span>- ৳${fmt(report.totalExpenses)}</span></div>
                <div class="calc-row total" style="color:${report.netProfit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}"><span>Net Profit</span><span>৳${fmt(report.netProfit)}</span></div>
            </div>
        </div>
    `;
}

// ---------- Init: default to "This Month" ----------
document.querySelector('.quick-range-btn[data-range="month"]').click();
