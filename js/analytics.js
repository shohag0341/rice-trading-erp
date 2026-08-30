import { initLayout } from './layout.js';



import {
    getAnalyticsSummary, getBestVillage, getBestFarmer, getBestBuyer, getBestVariety,
    getTopVillages, getTopVarieties, getVarietyBreakdown
} from './services/analytics-service.js';

import { getPaddyVarietiesForDropdown } from './services/purchase-service.js';



import { getDateRange } from './services/report-service.js';

await initLayout('analytics');

const fmt = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 2 }).format(num || 0);

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

let currentStartDate = '';
let currentEndDate = '';
let currentVarietyId = '';

const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const quickRangeBtns = document.querySelectorAll('.quick-range-btn');
const varietyFilter = document.getElementById('varietyFilter');
const varietyMixNote = document.getElementById('varietyMixNote');

async function loadVarietyFilterOptions() {
    try {
        const varieties = await getPaddyVarietiesForDropdown();
        varietyFilter.innerHTML = `<option value="">All Varieties</option>` +
            varieties.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    } catch (err) {
        console.error('Failed to load varieties for filter:', err);
    }
}

varietyFilter.addEventListener('change', () => {
    currentVarietyId = varietyFilter.value;
    loadSummary();
});

quickRangeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        quickRangeBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const range = getDateRange(btn.dataset.range);
        currentStartDate = range.start;
        currentEndDate = range.end;
        startDateInput.value = range.start;
        endDateInput.value = range.end;

        loadSummary();
    });
});

[startDateInput, endDateInput].forEach(input => {
    input.addEventListener('change', () => {
        quickRangeBtns.forEach(b => b.classList.remove('active'));
        currentStartDate = startDateInput.value;
        currentEndDate = endDateInput.value;
        if (currentStartDate && currentEndDate) loadSummary();
    });
});

// ---------- Date-range summary ----------
async function loadSummary() {
    const grid = document.getElementById('summaryGrid');
    grid.innerHTML = `<div class="summary-mini-card"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;

    // Only relevant when blending all varieties together - a single-variety view
    // is already an apples-to-apples comparison, so the note would be redundant.
    varietyMixNote.style.display = currentVarietyId ? 'none' : 'block';

    try {
        const s = await getAnalyticsSummary(currentStartDate, currentEndDate, currentVarietyId || null);

        grid.innerHTML = `
            <div class="summary-mini-card">
                <div class="summary-mini-label">Avg Purchase Price</div>
                <div class="summary-mini-value">৳${fmt(s.avgPurchasePrice)}/Md</div>
            </div>
            <div class="summary-mini-card">
                <div class="summary-mini-label">Avg Selling Price</div>
                <div class="summary-mini-value">৳${fmt(s.avgSellingPrice)}/Md</div>
            </div>
            <div class="summary-mini-card">
                <div class="summary-mini-label">Profit Per Maund</div>
                <div class="summary-mini-value" style="color:${s.profitPerMaund >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}">৳${fmt(s.profitPerMaund)}</div>
            </div>
            <div class="summary-mini-card">
                <div class="summary-mini-label">Inventory Turnover</div>
                <div class="summary-mini-value">${fmt(s.inventoryTurnover)}%</div>
            </div>
        `;
    } catch (err) {
        showToast('Failed to load summary: ' + err.message, 'error');
        grid.innerHTML = '';
    }

    loadVarietyBreakdown();
}

// ---------- Variety-wise breakdown (changes with date range) ----------
async function loadVarietyBreakdown() {
    const container = document.getElementById('varietyBreakdownTable');
    container.innerHTML = `<div class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</div>`;

    try {
        let breakdown = await getVarietyBreakdown(currentStartDate, currentEndDate);
        if (currentVarietyId) {
            breakdown = breakdown.filter(b => b.variety_id === currentVarietyId);
        }

        if (!breakdown.length) {
            container.innerHTML = `<div class="table-empty">No purchase/sales activity in this period.</div>`;
            return;
        }

        container.innerHTML = `
            <div class="data-table-wrapper">
                <table>
                    <thead>
                        <tr>
                            <th>Variety</th>
                            <th>Purchased (Md)</th>
                            <th>Avg Purchase Price</th>
                            <th>Sold (Md)</th>
                            <th>Avg Selling Price</th>
                            <th>Profit/Maund</th>
                            <th>Total Profit</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${breakdown.map(b => `
                            <tr>
                                <td><strong>${b.variety_name}</strong></td>
                                <td>${fmt(b.purchaseMaund)}</td>
                                <td>${b.avgPurchasePrice > 0 ? '৳' + fmt(b.avgPurchasePrice) : '-'}</td>
                                <td>${fmt(b.salesMaund)}</td>
                                <td>${b.avgSellingPrice > 0 ? '৳' + fmt(b.avgSellingPrice) : '-'}</td>
                                <td style="color:${b.profitPerMaund >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'};">${b.salesMaund > 0 ? '৳' + fmt(b.profitPerMaund) : '-'}</td>
                                <td style="font-weight:700; color:${b.totalProfit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'};">${b.salesMaund > 0 ? '৳' + fmt(b.totalProfit) : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (err) {
        showToast('Failed to load variety breakdown: ' + err.message, 'error');
        container.innerHTML = `<div class="table-empty">Could not load data.</div>`;
    }
}




// ---------- All-time bests ----------
async function loadBests() {
    try {
        const [village, farmer, buyer, variety] = await Promise.all([
            getBestVillage(), getBestFarmer(), getBestBuyer(), getBestVariety()
        ]);

        document.getElementById('bestsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-card-icon bg-green"><i class="fa-solid fa-location-dot"></i></div>
                <div class="stat-card-label">Best Village</div>
                <div class="stat-card-value" style="font-size:16px;">${village?.village || 'No data yet'}</div>
                <div class="stat-card-sub">৳${fmt(village?.total_purchase_amount)} total purchase</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon bg-blue"><i class="fa-solid fa-user-tie"></i></div>
                <div class="stat-card-label">Best Farmer</div>
                <div class="stat-card-value" style="font-size:16px;">${farmer?.farmer_name || 'No data yet'}</div>
                <div class="stat-card-sub">৳${fmt(farmer?.total_amount)} supplied</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon bg-purple"><i class="fa-solid fa-handshake"></i></div>
                <div class="stat-card-label">Best Buyer</div>
                <div class="stat-card-value" style="font-size:16px;">${buyer?.buyer_name || 'No data yet'}</div>
                <div class="stat-card-sub">৳${fmt(buyer?.total_amount)} purchased</div>
            </div>
            <div class="stat-card">
                <div class="stat-card-icon bg-orange"><i class="fa-solid fa-wheat-awn"></i></div>
                <div class="stat-card-label">Best Variety</div>
                <div class="stat-card-value" style="font-size:16px;">${variety?.variety_name || 'No data yet'}</div>
                <div class="stat-card-sub">৳${fmt(variety?.total_profit)} profit generated</div>
            </div>
        `;
    } catch (err) {
        showToast('Failed to load leaderboard: ' + err.message, 'error');
    }
}

// ---------- Top villages & varieties tables ----------
async function loadTopLists() {
    try {
        const [villages, varieties] = await Promise.all([getTopVillages(5), getTopVarieties(5)]);

        document.getElementById('topVillagesTable').innerHTML = villages.length ? `
            <div class="data-table-wrapper">
                <table>
                    <thead><tr><th>Village</th><th>Purchases</th><th>Total Amount</th></tr></thead>
                    <tbody>
                        ${villages.map(v => `
                            <tr><td>${v.village}</td><td>${v.total_purchases}</td><td>৳${fmt(v.total_purchase_amount)}</td></tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `<div class="table-empty">No data yet.</div>`;

        document.getElementById('topVarietiesTable').innerHTML = varieties.length ? `
            <div class="data-table-wrapper">
                <table>
                    <thead><tr><th>Variety</th><th>Avg Purchase Price</th><th>Avg Selling Price</th><th>Total Profit</th></tr></thead>
                    <tbody>
                        ${varieties.map(v => `
                            <tr>
                                <td>${v.variety_name}</td>
                                <td>৳${fmt(v.avg_purchase_price)}</td>
                                <td>৳${fmt(v.avg_selling_price)}</td>
                                <td style="color:${v.total_profit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)'}; font-weight:700;">৳${fmt(v.total_profit)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        ` : `<div class="table-empty">No data yet.</div>`;
    } catch (err) {
        showToast('Failed to load top lists: ' + err.message, 'error');
    }
}

// ---------- Init ----------
loadVarietyFilterOptions();
document.querySelector('.quick-range-btn[data-range="month"]').click();
loadBests();
loadTopLists();
