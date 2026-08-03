import { initLayout, getCurrentProfile } from './layout.js';


import {
    getWarehousesForDropdown, getPaddyVarietiesForDropdown, createPaddyVariety,
    getAllPaddyVarietiesIncludingInactive, setPaddyVarietyActive
} from './services/purchase-service.js';


import { getWarehousesForDropdown, getPaddyVarietiesForDropdown, createPaddyVariety } from './services/purchase-service.js';

const KG_PER_MAUND = 40;

await initLayout('sales');

let allSales = [];
let buyersList = [];
let warehousesList = [];
let varietiesList = [];
let editingSaleId = null;
let currentAvgCost = 0;
let currentAvailableStock = 0;

const tableBody = document.getElementById('salesTableBody');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addSaleBtn');
const modalOverlay = document.getElementById('saleModal');
const modalTitle = document.getElementById('modalTitle');
const saleForm = document.getElementById('saleForm');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const cancelBtn = document.getElementById('cancelBtn');

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

const fmt = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 2 }).format(num || 0);

function paymentBadgeClass(status) {
    return { paid: 'payment-badge-paid', partial: 'payment-badge-partial', due: 'payment-badge-due' }[status] || '';
}

// ---------- Load dropdown data ----------
async function loadDropdowns() {
    [buyersList, warehousesList, varietiesList] = await Promise.all([
        getBuyersForDropdown(),
        getWarehousesForDropdown(),
        getPaddyVarietiesForDropdown()
    ]);

    const buyerSelect = document.getElementById('saleBuyer');
    buyerSelect.innerHTML = '<option value="">Select buyer</option>' +
        buyersList.map(b => `<option value="${b.id}">${b.name} (${b.buyer_type})</option>`).join('');

    const warehouseSelect = document.getElementById('saleWarehouse');
    warehouseSelect.innerHTML = '<option value="">Select warehouse</option>' +
        warehousesList.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    renderVarietyOptions();

    if (!buyersList.length || !warehousesList.length) {
        showToast('Please add at least one Buyer and one Warehouse before creating a sale.', 'error');
    }
}

function renderVarietyOptions(selectedId = '') {
    const varietySelect = document.getElementById('saleVariety');
    varietySelect.innerHTML = '<option value="">Select paddy variety</option>' +
        varietiesList.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    if (selectedId) varietySelect.value = selectedId;
}

document.getElementById('addVarietyBtn').addEventListener('click', async () => {
    const name = prompt('Enter new paddy variety name:');
    if (!name || !name.trim()) return;

    try {
        const newVariety = await createPaddyVariety(name);
        varietiesList.push(newVariety);
        renderVarietyOptions(newVariety.id);
        showToast(`"${newVariety.name}" added successfully.`);
    } catch (err) {
        showToast('Failed to add variety: ' + err.message, 'error');
    }
});

// ---------- When warehouse or variety changes, fetch stock & avg cost ----------
async function refreshStockAndCost() {
    const warehouseId = document.getElementById('saleWarehouse').value;
    const varietyId = document.getElementById('saleVariety').value;
    const stockInfoBox = document.getElementById('stockInfoBox');

    if (!warehouseId || !varietyId) {
        stockInfoBox.style.display = 'none';
        currentAvgCost = 0;
        currentAvailableStock = 0;
        updateCalculationPreview();
        return;
    }

    stockInfoBox.style.display = 'block';
    stockInfoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking stock...`;

    try {
        const [stock, avgCost] = await Promise.all([
            getAvailableStock(warehouseId, varietyId),
            getAverageCostPerMaund(warehouseId, varietyId)
        ]);

        currentAvailableStock = Number(stock.current_maund || 0);
        currentAvgCost = avgCost;

        const stockColor = currentAvailableStock <= 0 ? 'var(--color-danger)' : 'var(--text-primary)';
        stockInfoBox.innerHTML = `
            <i class="fa-solid fa-boxes-stacked"></i>
            Available Stock: <strong style="color:${stockColor};">${fmt(currentAvailableStock)} Maund</strong>
            &nbsp;|&nbsp; Avg. Purchase Cost: <strong>৳${fmt(currentAvgCost)}/Maund</strong>
        `;

        updateCalculationPreview();
    } catch (err) {
        stockInfoBox.innerHTML = `Could not load stock info.`;
    }
}

document.getElementById('saleWarehouse').addEventListener('change', refreshStockAndCost);
document.getElementById('saleVariety').addEventListener('change', refreshStockAndCost);





// ---------- Live calculation preview (with profit) ----------
function updateCalculationPreview() {
    const weightKg = parseFloat(document.getElementById('saleWeight').value) || 0;
    const sellingPrice = parseFloat(document.getElementById('saleSellingPrice').value) || 0;
    const transport = parseFloat(document.getElementById('saleTransport').value) || 0;
    const labour = parseFloat(document.getElementById('saleLabour').value) || 0;
    const commission = parseFloat(document.getElementById('saleCommission').value) || 0;
    const other = parseFloat(document.getElementById('saleOther').value) || 0;
    const amountReceived = parseFloat(document.getElementById('saleAmountReceived').value) || 0;

    const maund = weightKg / KG_PER_MAUND;
    const grossAmount = maund * sellingPrice;


    
    const netAmount = grossAmount - transport - labour - commission - other;
    const costOfGoods = maund * currentAvgCost;
    const netProfit = netAmount - costOfGoods;
    const due = grossAmount - amountReceived;

    

    document.getElementById('calcMaund').textContent = fmt(maund) + ' Maund';
    document.getElementById('calcGross').textContent = '৳' + fmt(grossAmount);
    document.getElementById('calcCost').textContent = '৳' + fmt(costOfGoods);
    document.getElementById('calcNetAmount').textContent = '৳' + fmt(netAmount);
    document.getElementById('calcDue').textContent = '৳' + fmt(due > 0 ? due : 0);

    const profitEl = document.getElementById('calcProfit');
    profitEl.textContent = '৳' + fmt(netProfit);
    profitEl.style.color = netProfit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)';

    // Warn if selling more than available stock
    const weightWarning = document.getElementById('weightWarning');
    if (currentAvailableStock > 0 && maund > currentAvailableStock) {
        weightWarning.style.display = 'block';
        weightWarning.textContent = `Warning: Selling ${fmt(maund)} Maund but only ${fmt(currentAvailableStock)} Maund available in stock.`;
    } else {
        weightWarning.style.display = 'none';
    }

   
    
    
    // Auto-set payment status based on amount received vs GROSS amount
    // (Buyer owes the paddy sale price; transport/labour/commission are business costs)
    const statusSelect = document.getElementById('salePaymentStatus');
    if (amountReceived <= 0) statusSelect.value = 'due';
    else if (amountReceived >= grossAmount && grossAmount > 0) statusSelect.value = 'paid';
    else statusSelect.value = 'partial';



    
}

['saleWeight', 'saleSellingPrice', 'saleTransport', 'saleLabour', 'saleCommission', 'saleOther', 'saleAmountReceived']
    .forEach(id => {
        document.getElementById(id).addEventListener('input', updateCalculationPreview);
    });





// ---------- Load and render sales table ----------
async function loadSales(searchTerm = '') {
    tableBody.innerHTML = `<tr><td colspan="9" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>Loading sales...</div></td></tr>`;
    try {
        allSales = await getAllSales(searchTerm);
        renderTable(allSales);
    } catch (err) {
        showToast('Failed to load sales: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="9" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderTable(sales) {
    if (!sales.length) {
        tableBody.innerHTML = `
            <tr><td colspan="9">
                <div class="table-empty">
                    <i class="fa-solid fa-money-bill-trend-up"></i>
                    <div>No sales found. Click "New Sale" to record your first one.</div>
                </div>
            </td></tr>`;
        return;
    }

    tableBody.innerHTML = sales.map(s => {
        const profitColor = s.net_profit >= 0 ? 'var(--color-accent)' : 'var(--color-danger)';
        return `
        <tr>
            <td><span class="invoice-badge">${s.invoice_no}</span></td>
            <td>${new Date(s.sale_date).toLocaleDateString('en-GB')}</td>
            <td>${s.buyers?.name || '-'}</td>
            <td>${s.paddy_varieties?.name || '-'}</td>
            <td>${fmt(s.maund)} Md</td>
            <td>৳${fmt(s.net_amount)}</td>
            <td style="color:${profitColor}; font-weight:700;">৳${fmt(s.net_profit)}</td>
            <td><span class="badge ${paymentBadgeClass(s.payment_status)}">${s.payment_status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${s.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
                                                                                 }


// "Full Received" quick button — fills amount_received with exactly the gross (buyer's) amount
document.getElementById('markReceivedBtn').addEventListener('click', () => {
    const weightKg = parseFloat(document.getElementById('saleWeight').value) || 0;
    const pricePerMaund = parseFloat(document.getElementById('saleSellingPrice').value) || 0;
    const grossAmount = (weightKg / 40) * pricePerMaund;

    if (grossAmount <= 0) {
        showToast('Enter Weight and Selling Price first.', 'error');
        return;
    }

    document.getElementById('saleAmountReceived').value = grossAmount.toFixed(2);
    updateCalculationPreview();
});


// ---------- Modal open/close ----------
async function openAddModal() {
    editingSaleId = null;
    modalTitle.textContent = 'New Sale';
    saleForm.reset();
    currentAvgCost = 0;
    currentAvailableStock = 0;
    document.getElementById('stockInfoBox').style.display = 'none';
    document.getElementById('weightWarning').style.display = 'none';

    document.getElementById('saleDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('saleInvoiceNo').value = await generateSaleInvoiceNumber();
    updateCalculationPreview();

    modalOverlay.classList.add('open');
}

async function openEditModal(id) {
    const sale = allSales.find(s => s.id === id);
    if (!sale) return;

    editingSaleId = id;
    modalTitle.textContent = 'Edit Sale';

    document.getElementById('saleInvoiceNo').value = sale.invoice_no;
    document.getElementById('saleDate').value = sale.sale_date;
    document.getElementById('saleBuyer').value = sale.buyer_id;
    document.getElementById('saleWarehouse').value = sale.warehouse_id;
    document.getElementById('saleVariety').value = sale.paddy_variety_id;
    document.getElementById('saleWeight').value = sale.weight_kg;
    document.getElementById('saleSellingPrice').value = sale.selling_price_per_maund;
    document.getElementById('saleTransport').value = sale.transport_cost;
    document.getElementById('saleLabour').value = sale.labour_cost;
    document.getElementById('saleCommission').value = sale.commission;
    document.getElementById('saleOther').value = sale.other_expenses;
    document.getElementById('salePaymentMethod').value = sale.payment_method;
    document.getElementById('saleAmountReceived').value = sale.amount_received;
    document.getElementById('saleRemarks').value = sale.remarks || '';

    
    
    
    // Track the original cost recorded at the time of this sale.
    // We do NOT call refreshStockAndCost() here — this sale's own stock-out
    // movement already exists in the ledger, so a live lookup would (wrongly)
    // reflect stock AFTER this sale instead of before it, often showing 0.
    currentAvgCost = Number(sale.avg_cost_per_maund || 0);
    await showStoredStockInfo(sale.warehouse_id, sale.paddy_variety_id);
    updateCalculationPreview();

    modalOverlay.classList.add('open');
}

// Used only when opening Edit: shows current live stock (informational)
// alongside the cost that was ACTUALLY recorded for this sale, without
// overwriting currentAvgCost.
async function showStoredStockInfo(warehouseId, varietyId) {
    const stockInfoBox = document.getElementById('stockInfoBox');
    if (!warehouseId || !varietyId) {
        stockInfoBox.style.display = 'none';
        return;
    }

    stockInfoBox.style.display = 'block';
    stockInfoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking stock...`;

    try {
        const stock = await getAvailableStock(warehouseId, varietyId);
        currentAvailableStock = Number(stock.current_maund || 0);

        stockInfoBox.innerHTML = `
            <i class="fa-solid fa-boxes-stacked"></i>
            Available Stock now: <strong>${fmt(currentAvailableStock)} Maund</strong>
            &nbsp;|&nbsp; Cost recorded for this sale: <strong>৳${fmt(currentAvgCost)}/Maund</strong>
        `;
    } catch (err) {
        stockInfoBox.innerHTML = `Could not load stock info.`;
    }
}



function closeModal() {
    modalOverlay.classList.remove('open');
    saleForm.reset();
    editingSaleId = null;
}

// ---------- Form submit ----------
async function handleFormSubmit(e) {
    e.preventDefault();

    const saleData = {
        invoice_no: document.getElementById('saleInvoiceNo').value.trim(),
        sale_date: document.getElementById('saleDate').value,
        buyer_id: document.getElementById('saleBuyer').value,
        warehouse_id: document.getElementById('saleWarehouse').value,
        paddy_variety_id: document.getElementById('saleVariety').value,
        weight_kg: parseFloat(document.getElementById('saleWeight').value) || 0,
        selling_price_per_maund: parseFloat(document.getElementById('saleSellingPrice').value) || 0,
        transport_cost: parseFloat(document.getElementById('saleTransport').value) || 0,
        labour_cost: parseFloat(document.getElementById('saleLabour').value) || 0,
        commission: parseFloat(document.getElementById('saleCommission').value) || 0,
        other_expenses: parseFloat(document.getElementById('saleOther').value) || 0,
        avg_cost_per_maund: currentAvgCost,
        payment_method: document.getElementById('salePaymentMethod').value,
        payment_status: document.getElementById('salePaymentStatus').value,
        amount_received: parseFloat(document.getElementById('saleAmountReceived').value) || 0,
        remarks: document.getElementById('saleRemarks').value.trim(),
    };

    if (!saleData.buyer_id || !saleData.warehouse_id || !saleData.paddy_variety_id) {
        showToast('Please select Buyer, Warehouse, and Paddy Variety.', 'error');
        return;
    }
    if (saleData.weight_kg <= 0) {
        showToast('Weight must be greater than 0.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        if (editingSaleId) {
            await updateSale(editingSaleId, saleData);
            showToast('Sale updated successfully.');
        } else {
            const profile = getCurrentProfile();
            await createSale(saleData, profile?.id);
            showToast('Sale recorded successfully.');
        }
        closeModal();
        loadSales(searchInput.value.trim());
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Sale';
    }
}

async function handleDelete(id) {
    const sale = allSales.find(s => s.id === id);
    if (!confirm(`Delete sale "${sale?.invoice_no}"? This cannot be undone.`)) return;

    try {
        await deleteSale(id);
        showToast('Sale deleted.');
        loadSales(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// ---------- Events ----------
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadSales(searchInput.value.trim()), 350);
});

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
saleForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// ---------- Init ----------
await loadDropdowns();
loadSales();

