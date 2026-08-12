import { initLayout, getCurrentProfile } from './layout.js';
import {
    getAllPurchases, createPurchase, updatePurchase, deletePurchase,
    getFarmersForDropdown, getWarehousesForDropdown, getPaddyVarietiesForDropdown,
    generateInvoiceNumber, createPaddyVariety,
    getAllPaddyVarietiesIncludingInactive, setPaddyVarietyActive
} from './services/purchase-service.js';
import { makeSearchable } from './components/searchable-select.js';
import { confirmAction } from './components/confirm-modal.js';
import { formatDate } from './utils/date-format.js';
import { printReceipt } from './components/receipt.js';
import { getBusinessSettings } from './services/settings-service.js';

let farmerSearchWidget, warehouseSearchWidget, varietySearchWidget;



const KG_PER_MAUND = 40;

await initLayout('purchases');

let allPurchases = [];
let farmersList = [];
let warehousesList = [];
let varietiesList = [];
let editingPurchaseId = null;

const tableBody = document.getElementById('purchasesTableBody');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addPurchaseBtn');
const modalOverlay = document.getElementById('purchaseModal');
const modalTitle = document.getElementById('modalTitle');
const purchaseForm = document.getElementById('purchaseForm');
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
    [farmersList, warehousesList, varietiesList] = await Promise.all([
        getFarmersForDropdown(),
        getWarehousesForDropdown(),
        getPaddyVarietiesForDropdown()
    ]);

    const farmerSelect = document.getElementById('purchaseFarmer');
    farmerSelect.innerHTML = '<option value="">Select farmer</option>' +
        farmersList.map(f => `<option value="${f.id}">${f.name}${f.village ? ' - ' + f.village : ''}</option>`).join('');

    const warehouseSelect = document.getElementById('purchaseWarehouse');
    warehouseSelect.innerHTML = '<option value="">Select warehouse</option>' +
        warehousesList.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    renderVarietyOptions();

    if (!farmerSearchWidget) {
        farmerSearchWidget = makeSearchable('purchaseFarmer', { placeholder: 'Search farmer...' });
        warehouseSearchWidget = makeSearchable('purchaseWarehouse', { placeholder: 'Search warehouse...' });
        varietySearchWidget = makeSearchable('purchaseVariety', { placeholder: 'Search variety...' });
    } else {
        farmerSearchWidget.refresh();
        warehouseSearchWidget.refresh();
        varietySearchWidget.refresh();
    }

    if (!farmersList.length || !warehousesList.length) {
        showToast('Please add at least one Farmer and one Warehouse before creating a purchase.', 'error');
    }
}





function renderVarietyOptions(selectedId = '') {
    const varietySelect = document.getElementById('purchaseVariety');
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

// ---------- Live calculation preview ----------
function updateCalculationPreview() {
    const weightKg = parseFloat(document.getElementById('purchaseWeight').value) || 0;
    const pricePerMaund = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const transport = parseFloat(document.getElementById('purchaseTransport').value) || 0;
    const labour = parseFloat(document.getElementById('purchaseLabour').value) || 0;
    const food = parseFloat(document.getElementById('purchaseFood').value) || 0;
    const other = parseFloat(document.getElementById('purchaseOther').value) || 0;
    const amountPaid = parseFloat(document.getElementById('purchaseAmountPaid').value) || 0;

    const maund = weightKg / KG_PER_MAUND;
    const grossAmount = maund * pricePerMaund;


    
    const netCost = grossAmount + transport + labour + food + other;
    const due = grossAmount - amountPaid;

    

    document.getElementById('calcMaund').textContent = fmt(maund) + ' Maund';
    document.getElementById('calcGross').textContent = '৳' + fmt(grossAmount);
    document.getElementById('calcNetCost').textContent = '৳' + fmt(netCost);
    document.getElementById('calcDue').textContent = '৳' + fmt(due > 0 ? due : 0);

   
    
    // Auto-set payment status based on amount paid vs GROSS amount
    // (Farmer is only owed the paddy price, not transport/labour/food costs)
    const statusSelect = document.getElementById('purchasePaymentStatus');
    if (amountPaid <= 0) statusSelect.value = 'due';
    else if (amountPaid >= grossAmount && grossAmount > 0) statusSelect.value = 'paid';
    else statusSelect.value = 'partial';


    
}



['purchaseWeight', 'purchasePrice', 'purchaseTransport', 'purchaseLabour', 'purchaseFood', 'purchaseOther', 'purchaseAmountPaid']
    .forEach(id => {
        document.getElementById(id).addEventListener('input', updateCalculationPreview);
    });


// "Full Paid" quick button — fills amount_paid with exactly the gross (farmer's) amount
document.getElementById('markPaidBtn').addEventListener('click', () => {
    const weightKg = parseFloat(document.getElementById('purchaseWeight').value) || 0;
    const pricePerMaund = parseFloat(document.getElementById('purchasePrice').value) || 0;
    const grossAmount = (weightKg / KG_PER_MAUND) * pricePerMaund;

    if (grossAmount <= 0) {
        showToast('Enter Weight and Price first.', 'error');
        return;
    }

    document.getElementById('purchaseAmountPaid').value = grossAmount.toFixed(2);
    updateCalculationPreview();
});


// ---------- Load and render purchases table ----------
async function loadPurchases(searchTerm = '') {
    tableBody.innerHTML = `<tr><td colspan="8" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>Loading purchases...</div></td></tr>`;
    try {
        allPurchases = await getAllPurchases(searchTerm);
        renderTable(allPurchases);
    } catch (err) {
        showToast('Failed to load purchases: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="8" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderTable(purchases) {
    if (!purchases.length) {
        tableBody.innerHTML = `
            <tr><td colspan="8">
                <div class="table-empty">
                    <i class="fa-solid fa-cart-shopping"></i>
                    <div>No purchases found. Click "New Purchase" to record your first one.</div>
                </div>
            </td></tr>`;
        return;
    }

    tableBody.innerHTML = purchases.map(p => `
        <tr>
            <td><span class="invoice-badge">${p.invoice_no}</span></td>
            <td>${formatDate(p.purchase_date)}</td>
            <td>${p.farmers?.name || '-'}</td>
            <td>${p.paddy_varieties?.name || '-'}</td>
            <td>${fmt(p.maund)} Md</td>
            <td>৳${fmt(p.net_cost)}</td>
            <td><span class="badge ${paymentBadgeClass(p.payment_status)}">${p.payment_status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn print-btn" data-id="${p.id}" title="Print Receipt"><i class="fa-solid fa-print"></i></button>
                    <button class="icon-btn edit-btn" data-id="${p.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${p.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.print-btn').forEach(btn => btn.addEventListener('click', () => handlePrintReceipt(btn.dataset.id)));
    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

// ---------- Modal open/close ----------

async function openAddModal() {
    editingPurchaseId = null;
    modalTitle.textContent = 'New Purchase';
    purchaseForm.reset();
    farmerSearchWidget?.refresh();
    warehouseSearchWidget?.refresh();
    varietySearchWidget?.refresh();

    document.getElementById('purchaseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('purchaseInvoiceNo').value = await generateInvoiceNumber();
    updateCalculationPreview();

    modalOverlay.classList.add('open');
}

function openEditModal(id) {
    const purchase = allPurchases.find(p => p.id === id);
    if (!purchase) return;

    editingPurchaseId = id;
    modalTitle.textContent = 'Edit Purchase';

    document.getElementById('purchaseInvoiceNo').value = purchase.invoice_no;
    document.getElementById('purchaseDate').value = purchase.purchase_date;
    document.getElementById('purchaseFarmer').value = purchase.farmer_id;
    document.getElementById('purchaseWarehouse').value = purchase.warehouse_id;
    document.getElementById('purchaseVariety').value = purchase.paddy_variety_id;
    farmerSearchWidget?.refresh();
    warehouseSearchWidget?.refresh();
    varietySearchWidget?.refresh();

    
    document.getElementById('purchaseWeight').value = purchase.weight_kg;
    document.getElementById('purchaseMoisture').value = purchase.moisture_percent || '';
    document.getElementById('purchasePrice').value = purchase.price_per_maund;
    document.getElementById('purchaseTransport').value = purchase.transport_cost;
    document.getElementById('purchaseLabour').value = purchase.labour_cost;
    document.getElementById('purchaseFood').value = purchase.food_cost;
    document.getElementById('purchaseOther').value = purchase.other_expenses;
    document.getElementById('purchasePaymentMethod').value = purchase.payment_method;
    document.getElementById('purchaseAmountPaid').value = purchase.amount_paid;
    document.getElementById('purchaseRemarks').value = purchase.remarks || '';

    updateCalculationPreview();
    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    purchaseForm.reset();
    editingPurchaseId = null;
}

// ---------- Form submit ----------
async function handleFormSubmit(e) {
    e.preventDefault();

    const purchaseData = {
        invoice_no: document.getElementById('purchaseInvoiceNo').value.trim(),
        purchase_date: document.getElementById('purchaseDate').value,
        farmer_id: document.getElementById('purchaseFarmer').value,
        warehouse_id: document.getElementById('purchaseWarehouse').value,
        paddy_variety_id: document.getElementById('purchaseVariety').value,
        weight_kg: parseFloat(document.getElementById('purchaseWeight').value) || 0,
        moisture_percent: parseFloat(document.getElementById('purchaseMoisture').value) || null,
        price_per_maund: parseFloat(document.getElementById('purchasePrice').value) || 0,
        transport_cost: parseFloat(document.getElementById('purchaseTransport').value) || 0,
        labour_cost: parseFloat(document.getElementById('purchaseLabour').value) || 0,
        food_cost: parseFloat(document.getElementById('purchaseFood').value) || 0,
        other_expenses: parseFloat(document.getElementById('purchaseOther').value) || 0,
        payment_method: document.getElementById('purchasePaymentMethod').value,
        payment_status: document.getElementById('purchasePaymentStatus').value,
        amount_paid: parseFloat(document.getElementById('purchaseAmountPaid').value) || 0,
        remarks: document.getElementById('purchaseRemarks').value.trim(),
    };

    if (!purchaseData.invoice_no) {
        showToast('Invoice No is required.', 'error');
        return;
    }
    if (!purchaseData.purchase_date) {
        showToast('Purchase Date is required.', 'error');
        return;
    }
    if (!purchaseData.farmer_id) {
        showToast('Please select a Farmer.', 'error');
        return;
    }
    if (!purchaseData.warehouse_id) {
        showToast('Please select a Warehouse.', 'error');
        return;
    }
    if (!purchaseData.paddy_variety_id) {
        showToast('Please select a Paddy Variety.', 'error');
        return;
    }
    if (purchaseData.weight_kg <= 0) {
        showToast('Weight must be greater than 0.', 'error');
        return;
    }
    if (purchaseData.price_per_maund <= 0) {
        showToast('Price Per Maund must be greater than 0.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        if (editingPurchaseId) {
            await updatePurchase(editingPurchaseId, purchaseData);
            showToast('Purchase updated successfully.');
        } else {
            const profile = getCurrentProfile();
            await createPurchase(purchaseData, profile?.id);
            showToast('Purchase recorded successfully.');
        }
        closeModal();
        loadPurchases(searchInput.value.trim());
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Purchase';
    }
}

async function handleDelete(id) {
    const purchase = allPurchases.find(p => p.id === id);

    const confirmed = await confirmAction({
        title: 'Delete Purchase?',
        message: `Delete purchase "${purchase?.invoice_no}"? This cannot be undone.`,
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deletePurchase(id);
        showToast('Purchase deleted.');
        loadPurchases(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

async function handlePrintReceipt(id) {
    const purchase = allPurchases.find(p => p.id === id);
    if (!purchase) return;

    try {
        const business = await getBusinessSettings();
        const due = Number(purchase.gross_amount) - Number(purchase.amount_paid);

        printReceipt({
            businessName: business?.business_name || 'Rice Trading ERP Pro',
            businessAddress: business?.address || '',
            businessPhone: business?.phone || '',
            title: 'Purchase Receipt',
            invoiceNo: purchase.invoice_no,
            date: formatDate(purchase.purchase_date),
            partyLabel: 'Farmer',
            partyName: purchase.farmers?.name || '-',
            partyPhone: purchase.farmers?.phone || '',
            warehouseName: purchase.warehouses?.name || '-',
            varietyName: purchase.paddy_varieties?.name || '-',
            weightKg: purchase.weight_kg,
            maund: purchase.maund,
            priceLabel: 'Price/Maund',
            pricePerMaund: purchase.price_per_maund,
            grossAmount: purchase.gross_amount,
            costRows: [
                { label: 'Transport', amount: purchase.transport_cost },
                { label: 'Labour', amount: purchase.labour_cost },
                { label: 'Food', amount: purchase.food_cost },
                { label: 'Other', amount: purchase.other_expenses }
            ],
            netLabel: 'Net Cost',
            netAmount: purchase.net_cost,
            paidLabel: 'Amount Paid',
            amountPaid: purchase.amount_paid,
            due: due,
            remarks: purchase.remarks || ''
        });
    } catch (err) {
        showToast('Could not open receipt: ' + err.message, 'error');
    }
}

// ---------- Events ----------
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadPurchases(searchInput.value.trim()), 350);
});

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
purchaseForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// ---------- Init ----------
await loadDropdowns();
loadPurchases();
    
