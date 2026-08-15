import { initLayout, getCurrentProfile } from './layout.js';
import {
    getAllSales, createSale, updateSale, deleteSale,
    getBuyersForDropdown, getAverageCostPerMaund, getAvailableStock,
    generateSaleInvoiceNumber
} from './services/sale-service.js';
import {
    getWarehousesForDropdown, getPaddyVarietiesForDropdown, createPaddyVariety,
    getAllPaddyVarietiesIncludingInactive, setPaddyVarietyActive
} from './services/purchase-service.js';
import { makeSearchable } from './components/searchable-select.js';
import { confirmAction } from './components/confirm-modal.js';
import { formatDate } from './utils/date-format.js';
import { printReceipt } from './components/receipt.js';
import { getBusinessSettings } from './services/settings-service.js';

let buyerSearchWidget, warehouseSearchWidget, varietySearchWidget;


let KG_PER_MAUND = 40; // fallback until Business Settings loads

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

    if (!buyerSearchWidget) {
        buyerSearchWidget = makeSearchable('saleBuyer', { placeholder: 'Search buyer...' });
        warehouseSearchWidget = makeSearchable('saleWarehouse', { placeholder: 'Search warehouse...' });
        varietySearchWidget = makeSearchable('saleVariety', { placeholder: 'Search variety...' });
    } else {
        buyerSearchWidget.refresh();
        warehouseSearchWidget.refresh();
        varietySearchWidget.refresh();
    }

    if (!buyersList.length || !warehousesList.length) {
        showToast('Please add at least one Buyer and one Warehouse before creating a sale.', 'error');
    }
}

function renderVarietyOptions(selectedId = '') {
    const varietySelect = document.getElementById('saleVariety');
    varietySelect.innerHTML = '<option value="">Select paddy variety</option>' +
        varietiesList.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
    if (selectedId) varietySelect.value = selectedId;
    varietySearchWidget?.refresh();
}



// ---------- Manage Paddy Varieties (add / activate / deactivate) ----------
const varietyModal = document.getElementById('varietyModal');

document.getElementById('addVarietyBtn').addEventListener('click', () => {
    document.getElementById('newVarietyName').value = '';
    varietyModal.classList.add('open');
    loadVarietyManageList();
});

document.getElementById('varietyModalClose').addEventListener('click', () => varietyModal.classList.remove('open'));
varietyModal.addEventListener('click', (e) => { if (e.target === varietyModal) varietyModal.classList.remove('open'); });

async function loadVarietyManageList() {
    const listEl = document.getElementById('varietyManageList');
    listEl.innerHTML = `<div class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>`;

    try {
        const allVarieties = await getAllPaddyVarietiesIncludingInactive();

        if (!allVarieties.length) {
            listEl.innerHTML = `<div class="table-empty">No varieties yet.</div>`;
            return;
        }

        listEl.innerHTML = allVarieties.map(v => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 4px; border-bottom:1px solid var(--border-color);">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:600; font-size:14px;">${v.name}</span>
                    ${!v.is_active ? '<span class="badge badge-danger">Inactive</span>' : ''}
                </div>
                <button type="button" class="btn-secondary toggle-variety-btn" data-id="${v.id}" data-active="${v.is_active}" style="padding:6px 12px; font-size:12px;">
                    ${v.is_active ? 'Deactivate' : 'Activate'}
                </button>
            </div>
        `).join('');

        document.querySelectorAll('.toggle-variety-btn').forEach(btn => {
            btn.addEventListener('click', () => handleToggleVariety(btn.dataset.id, btn.dataset.active === 'true'));
        });
    } catch (err) {
        listEl.innerHTML = `<div class="table-empty">Could not load varieties.</div>`;
    }
}

async function handleToggleVariety(id, isCurrentlyActive) {
    try {
        await setPaddyVarietyActive(id, !isCurrentlyActive);
        showToast(isCurrentlyActive ? 'Variety deactivated.' : 'Variety activated.');
        loadVarietyManageList();
        varietiesList = await getPaddyVarietiesForDropdown();
        renderVarietyOptions();
    } catch (err) {
        showToast('Failed: ' + err.message, 'error');
    }
}

document.getElementById('saveNewVarietyBtn').addEventListener('click', async () => {
    const name = document.getElementById('newVarietyName').value.trim();
    if (!name) {
        showToast('Enter a variety name.', 'error');
        return;
    }

    try {
        const newVariety = await createPaddyVariety(name);
        varietiesList.push(newVariety);
        renderVarietyOptions(newVariety.id);
        document.getElementById('newVarietyName').value = '';
        showToast(`"${newVariety.name}" added successfully.`);
        loadVarietyManageList();
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
            getAverageCostPerMaund(warehouseId, varietyId, KG_PER_MAUND)
        ]);

        currentAvailableStock = Number(stock.current_maund || 0);
        currentAvgCost = avgCost;

        const stockColor = currentAvailableStock <= 0 ? 'var(--color-danger)' : 'var(--text-primary)';
        const stockKg = currentAvailableStock * KG_PER_MAUND;
        stockInfoBox.innerHTML = `
            <i class="fa-solid fa-boxes-stacked"></i>
            Available Stock: <strong style="color:${stockColor};">${fmt(currentAvailableStock)} Maund</strong> <span style="color:var(--text-secondary);">(${fmt(stockKg)} KG)</span>
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
            <td>${formatDate(s.sale_date)}</td>
            <td>${s.buyers?.name || '-'}</td>
            <td>${s.paddy_varieties?.name || '-'}</td>
            <td>${fmt(s.maund)} Md</td>
            <td>৳${fmt(s.net_amount)}</td>
            <td style="color:${profitColor}; font-weight:700;">৳${fmt(s.net_profit)}</td>
            <td><span class="badge ${paymentBadgeClass(s.payment_status)}">${s.payment_status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn print-btn" data-id="${s.id}" title="Print Receipt"><i class="fa-solid fa-print"></i></button>
                    <button class="icon-btn edit-btn" data-id="${s.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${s.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.print-btn').forEach(btn => btn.addEventListener('click', () => handlePrintReceipt(btn.dataset.id)));
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}


// "Full Received" quick button — fills amount_received with exactly the gross (buyer's) amount
document.getElementById('markReceivedBtn').addEventListener('click', () => {
    const weightKg = parseFloat(document.getElementById('saleWeight').value) || 0;
    const pricePerMaund = parseFloat(document.getElementById('saleSellingPrice').value) || 0;
    const grossAmount = (weightKg / KG_PER_MAUND) * pricePerMaund;

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
    buyerSearchWidget?.refresh();
    warehouseSearchWidget?.refresh();
    varietySearchWidget?.refresh();
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

    buyerSearchWidget?.refresh();
    warehouseSearchWidget?.refresh();
    varietySearchWidget?.refresh();

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
        const stockKg = currentAvailableStock * KG_PER_MAUND;

        stockInfoBox.innerHTML = `
            <i class="fa-solid fa-boxes-stacked"></i>
            Available Stock now: <strong>${fmt(currentAvailableStock)} Maund</strong> <span style="color:var(--text-secondary);">(${fmt(stockKg)} KG)</span>
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

if (!saleData.invoice_no) {
        showToast('Invoice No is required.', 'error');
        return;
    }
    if (!saleData.sale_date) {
        showToast('Sale Date is required.', 'error');
        return;
    }
    if (!saleData.buyer_id) {
        showToast('Please select a Buyer.', 'error');
        return;
    }
    if (!saleData.warehouse_id) {
        showToast('Please select a Warehouse.', 'error');
        return;
    }
    if (!saleData.paddy_variety_id) {
        showToast('Please select a Paddy Variety.', 'error');
        return;
    }
    if (saleData.weight_kg <= 0) {
        showToast('Weight must be greater than 0.', 'error');
        return;
    }
    if (saleData.selling_price_per_maund <= 0) {
        showToast('Selling Price Per Maund must be greater than 0.', 'error');
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

    const confirmed = await confirmAction({
        title: 'Delete Sale?',
        message: `Delete sale "${sale?.invoice_no}"? This cannot be undone.`,
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteSale(id);
        showToast('Sale deleted.');
        loadSales(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

async function handlePrintReceipt(id) {
    const sale = allSales.find(s => s.id === id);
    if (!sale) return;

    try {
        const business = await getBusinessSettings();
        const due = Number(sale.gross_amount) - Number(sale.amount_received);

        printReceipt({
            businessName: business?.business_name || 'Rice Trading ERP Pro',
            businessAddress: business?.address || '',
            businessPhone: business?.phone || '',
            title: 'Sale Receipt',
            invoiceNo: sale.invoice_no,
            date: formatDate(sale.sale_date),
            partyLabel: 'Buyer',
            partyName: sale.buyers?.name || '-',
            partyPhone: sale.buyers?.phone || '',
            warehouseName: sale.warehouses?.name || '-',
            varietyName: sale.paddy_varieties?.name || '-',
            weightKg: sale.weight_kg,
            maund: sale.maund,
            priceLabel: 'Selling Price/Maund',
            pricePerMaund: sale.selling_price_per_maund,
            grossAmount: sale.gross_amount,
            costRows: [
                { label: 'Transport', amount: sale.transport_cost },
                { label: 'Labour', amount: sale.labour_cost },
                { label: 'Commission', amount: sale.commission },
                { label: 'Other', amount: sale.other_expenses }
            ],
            netLabel: 'Net Amount',
            netAmount: sale.net_amount,
            paidLabel: 'Amount Received',
            amountPaid: sale.amount_received,
            due: due,
            remarks: sale.remarks || ''
        });
    } catch (err) {
        showToast('Could not open receipt: ' + err.message, 'error');
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
try {
    const business = await getBusinessSettings();
    if (business?.kg_per_maund) KG_PER_MAUND = Number(business.kg_per_maund);
} catch (err) {
    // Keep the fallback of 40 if settings can't be loaded for some reason
}

await loadDropdowns();

const urlParams = new URLSearchParams(window.location.search);
const urlSearchTerm = urlParams.get('search') || '';
if (urlSearchTerm) searchInput.value = urlSearchTerm;

loadSales(urlSearchTerm);

if (urlParams.get('action') === 'add') {
    openAddModal();
}
