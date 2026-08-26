import { initLayout } from './layout.js';
import {
    getTodaySummary, getCashBalance, getCurrentStockTotal, getTotalStockValue,
    getTrendData, getTopFarmers, getTopBuyers, getWarehouseUtilization
} from './services/dashboard-service.js';
import { globalSearch } from './services/search-service.js';
import { getBusinessSettings } from './services/settings-service.js';

// Protect the page and render sidebar/header
await initLayout('dashboard');

const fmt = (num) => new Intl.NumberFormat('en-BD').format(Math.round(num || 0));
const fmtStock = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 2 }).format(num || 0);

async function loadDashboard() {
    try {
        let kgPerMaund = 40; // fallback until Business Settings loads
        try {
            const business = await getBusinessSettings();
            if (business?.kg_per_maund) kgPerMaund = Number(business.kg_per_maund);
        } catch (err) {
            // Keep the fallback of 40 if settings can't be loaded for some reason
        }

        const [today, cash, stockTotal, stockValue, trend, farmers, buyers, warehouses] = await Promise.all([
            getTodaySummary(),
            getCashBalance(),
            getCurrentStockTotal(),
            getTotalStockValue(kgPerMaund),
            getTrendData(currentTrendGranularity),
            getTopFarmers(5),
            getTopBuyers(5),
            getWarehouseUtilization()
        ]);

        renderStatCards(today, cash, stockTotal, stockValue);
        renderTrendChart(trend, currentTrendGranularity);


        
        renderWarehouseList(warehouses);
        renderTopFarmers(farmers);
        renderTopBuyers(buyers);
    } catch (err) {
        console.error('Dashboard load error:', err);
        document.getElementById('statsGrid').innerHTML =
            `<div class="card-box">Could not load dashboard data. ${err.message || ''}</div>`;
    }
}




function renderStatCards(today, cash, stockTotal, stockValue) {
    const grid = document.getElementById('statsGrid');
    grid.innerHTML = `
        <div class="stat-card" style="cursor:pointer;" onclick="window.location.href='reports.html?type=purchase&range=today'">
            <div class="stat-card-icon bg-blue"><i class="fa-solid fa-cart-shopping"></i></div>
            <div class="stat-card-label">Today's Purchase</div>
            <div class="stat-card-value">৳${fmt(today.purchase.total_net_cost)}</div>
            <div class="stat-card-sub">${fmt(today.purchase.total_maund)} Maund</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="window.location.href='reports.html?type=sales&range=today'">
            <div class="stat-card-icon bg-green"><i class="fa-solid fa-money-bill-trend-up"></i></div>
            <div class="stat-card-label">Today's Sales</div>
            <div class="stat-card-value">৳${fmt(today.sales.total_net_amount)}</div>
            <div class="stat-card-sub">${fmt(today.sales.total_maund)} Maund</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="window.location.href='reports.html?type=profit&range=today'">
            <div class="stat-card-icon bg-purple"><i class="fa-solid fa-sack-dollar"></i></div>
            <div class="stat-card-label">Today's Profit</div>
            <div class="stat-card-value">৳${fmt(today.sales.total_profit)}</div>
            <div class="stat-card-sub">Net profit today</div>
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="window.location.href='inventory.html'">
            <div class="stat-card-icon bg-orange"><i class="fa-solid fa-boxes-stacked"></i></div>
            <div class="stat-card-label">Current Stock</div>

            
            <div class="stat-card-value">${fmtStock(stockTotal)}</div>
            <div class="stat-card-sub">৳${fmt(stockValue)} total value</div>


            
        </div>
        <div class="stat-card" style="cursor:pointer;" onclick="window.location.href='cash-adjustments.html'">
            <div class="stat-card-icon bg-red"><i class="fa-solid fa-wallet"></i></div>
            <div class="stat-card-label">Cash Balance</div>
            <div class="stat-card-value">৳${fmt(cash?.cash_balance)}</div>
            <div class="stat-card-sub">Received - Paid - Expenses</div>
        </div>
    `;
}





let trendChartInstance = null;
let currentTrendGranularity = 'monthly';

function formatBucketLabel(key, granularity) {
    if (granularity === 'yearly') return key; // "2026"
    if (granularity === 'weekly') {
        const d = new Date(key);
        return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
    }
    // monthly & alltime -> key is "YYYY-MM"
    const [y, m] = key.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function renderTrendChart(trend, granularity) {
    const ctx = document.getElementById('trendChart');
    const labels = trend.map(t => formatBucketLabel(t.key, granularity));

    if (trendChartInstance) trendChartInstance.destroy();

    if (!trend.length) {
        ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
        return;
    }

    trendChartInstance = new Chart(ctx, {
        data: {
            labels,
            datasets: [
                {
                    type: 'bar',
                    label: 'Purchase',
                    data: trend.map(t => t.purchase),
                    backgroundColor: 'rgba(37,99,235,0.75)',
                    borderRadius: 4,
                    order: 2
                },
                {
                    type: 'bar',
                    label: 'Sales',
                    data: trend.map(t => t.sales),
                    backgroundColor: 'rgba(22,163,74,0.75)',
                    borderRadius: 4,
                    order: 2
                },
                {
                    type: 'line',
                    label: 'Profit',
                    data: trend.map(t => t.profit),
                    borderColor: '#f97316',
                    backgroundColor: 'rgba(249,115,22,0.15)',
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#f97316',
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: { position: 'bottom' },
                tooltip: {
                    callbacks: {
                        label: (item) => `${item.dataset.label}: ৳${fmt(item.parsed.y)}`
                    }
                }
            },
            scales: {
                y: { beginAtZero: true, ticks: { callback: (v) => '৳' + fmt(v) } }
            }
        }
    });
}

document.querySelectorAll('.trend-range-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
        if (btn.dataset.range === currentTrendGranularity) return;

        document.querySelectorAll('.trend-range-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentTrendGranularity = btn.dataset.range;

        try {
            const trend = await getTrendData(currentTrendGranularity);
            renderTrendChart(trend, currentTrendGranularity);
        } catch (err) {
            console.error('Trend chart load error:', err);
        }
    });
});

function renderWarehouseList(warehouses) {
    const container = document.getElementById('warehouseList');
    if (!warehouses.length) {
        container.innerHTML = `<div class="list-item-sub">No warehouses added yet.</div>`;
        return;
    }
    container.innerHTML = warehouses.map(w => `
        <div class="list-item">
            <div>
                <div class="list-item-name">${w.warehouse_name}</div>
                <div class="list-item-sub">${fmt(w.used_maund)} / ${fmt(w.capacity_maund)} Maund</div>
            </div>
            <div class="list-item-value">${w.utilization_percent}%</div>
        </div>
    `).join('');
}

function renderTopFarmers(farmers) {
    const container = document.getElementById('topFarmersList');
    if (!farmers.length) {
        container.innerHTML = `<div class="list-item-sub">No purchase data yet.</div>`;
        return;
    }
    container.innerHTML = farmers.map(f => `
        <div class="list-item">
            <div>
                <div class="list-item-name">${f.farmer_name}</div>
                <div class="list-item-sub">${f.village || '-'} · ${f.total_purchases} purchases</div>
            </div>
            <div class="list-item-value">৳${fmt(f.total_amount)}</div>
        </div>
    `).join('');
}

function renderTopBuyers(buyers) {
    const container = document.getElementById('topBuyersList');
    if (!buyers.length) {
        container.innerHTML = `<div class="list-item-sub">No sales data yet.</div>`;
        return;
    }
    container.innerHTML = buyers.map(b => `
        <div class="list-item">
            <div>
                <div class="list-item-name">${b.buyer_name}</div>
                <div class="list-item-sub">${b.buyer_type} · ${b.total_sales_count} sales</div>
            </div>
            <div class="list-item-value">৳${fmt(b.total_amount)}</div>
        </div>
    `).join('');
}

// ---------- Global Search ----------
const globalSearchInput = document.getElementById('globalSearchInput');
const globalSearchResults = document.getElementById('globalSearchResults');

function renderSearchResults(results) {
    const { farmers, buyers, purchases, sales } = results;
    const totalCount = farmers.length + buyers.length + purchases.length + sales.length;

    if (!totalCount) {
        globalSearchResults.innerHTML = `<div class="search-empty">No matches found.</div>`;
        return;
    }

    const groupHtml = (title, items) => {
        if (!items.length) return '';
        return `
            <div class="search-result-group-title">${title}</div>
            ${items.map(item => `
                <div class="search-result-item" data-url="${item.url}">
                    <div>
                        <div class="search-result-name">${item.title}</div>
                        ${item.subtitle ? `<div class="search-result-sub">${item.subtitle}</div>` : ''}
                    </div>
                    <i class="fa-solid fa-chevron-right" style="font-size:11px; color:var(--text-secondary);"></i>
                </div>
            `).join('')}
        `;
    };

    globalSearchResults.innerHTML =
        groupHtml('Farmers', farmers) +
        groupHtml('Buyers', buyers) +
        groupHtml('Purchase Invoices', purchases) +
        groupHtml('Sale Invoices', sales);

    globalSearchResults.querySelectorAll('.search-result-item').forEach(el => {
        el.addEventListener('click', () => {
            window.location.href = el.dataset.url;
        });
    });
}

let searchDebounceTimer;
globalSearchInput.addEventListener('input', () => {
    const term = globalSearchInput.value.trim();

    clearTimeout(searchDebounceTimer);

    if (term.length < 2) {
        globalSearchResults.classList.remove('open');
        return;
    }

    globalSearchResults.classList.add('open');
    globalSearchResults.innerHTML = `<div class="search-loading"><i class="fa-solid fa-spinner fa-spin"></i> Searching...</div>`;

    searchDebounceTimer = setTimeout(async () => {
        try {
            const results = await globalSearch(term);
            renderSearchResults(results);
        } catch (err) {
            globalSearchResults.innerHTML = `<div class="search-empty">Search failed: ${err.message}</div>`;
        }
    }, 350);
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('.global-search-wrapper')) {
        globalSearchResults.classList.remove('open');
    }
});

// ---------- Floating "+" shortcut (New Purchase / New Sale) ----------
const fabToggle = document.getElementById('fabToggle');
const fabMenu = document.getElementById('fabMenu');

fabToggle.addEventListener('click', () => {
    fabToggle.classList.toggle('open');
    fabMenu.classList.toggle('open');
});

document.getElementById('fabNewPurchase').addEventListener('click', () => {
    window.location.href = 'purchases.html?action=add';
});

document.getElementById('fabNewSale').addEventListener('click', () => {
    window.location.href = 'sales.html?action=add';
});

loadDashboard();

                
