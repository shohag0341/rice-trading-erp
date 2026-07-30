import { initLayout, getCurrentProfile } from './layout.js';
import {
    getAllPurchases, createPurchase, updatePurchase, deletePurchase,
    getFarmersForDropdown, getWarehousesForDropdown, getPaddyVarietiesForDropdown,
    generateInvoiceNumber
} from './services/purchase-service.js';

const KG_PER_MAUND = 37.32;

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

    const varietySelect = document.getElementById('purchaseVariety');
    varietySelect.innerHTML = '<option value="">Select paddy variety</option>' +
        varietiesList.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

    if (!farmersList.length || !warehousesList.length) {
        showToast('Please add at least one Farmer and one Warehouse before creating a purchase.', 'error');
    }
}

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
    const due = netCost - amountPaid;

    document.getElementById('calcMaund').textContent = fmt(maund) + ' Maund';
    document.getElementById('calcGross').textContent = '৳' + fmt(grossAmount);
    document.getElementById('calcNetCost').textContent = '৳' + fmt(netCost);
    document.getElementById('calcDue').textContent = '৳' + fmt(due > 0 ? due : 0);

    // Auto-set payment status based on amount paid
    const statusSelect = document.getElementById('purchasePaymentStatus');
    if (amountPaid <= 0) statusSelect.value = 'due';
    else if (amountPaid >= netCost && netCost > 0) statusSelect.value = 'paid';
    else statusSelect.value = 'partial';
}

['purchaseWeight', 'purchasePrice', 'purchaseTransport', 'purchaseLabour', 'purchaseFood', 'purchaseOther', 'purchaseAmountPaid']
    .forEach(id => {
        document.getElementById(id).addEventListener('input', updateCalculationPreview);
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
            <td>${new Date(p.purchase_date).toLocaleDateString('en-GB')}</td>
            <td>${p.farmers?.name || '-'}</td>
            <td>${p.paddy_varieties?.name || '-'}</td>
            <td>${fmt(p.maund)} Md</td>
            <td>৳${fmt(p.net_cost)}</td>
            <td><span class="badge ${paymentBadgeClass(p.payment_status)}">${p.payment_status}</span></td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" data-id="${p.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${p.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

// ---------- Modal open/close ----------
async function openAddModal() {
    editingPurchaseId = null;
    modalTitle.textContent = 'New Purchase';
    purchaseForm.reset();

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

    if (!purchaseData.farmer_id || !purchaseData.warehouse_id || !purchaseData.paddy_variety_id) {
        showToast('Please select Farmer, Warehouse, and Paddy Variety.', 'error');
        return;
    }
    if (purchaseData.weight_kg <= 0) {
        showToast('Weight must be greater than 0.', 'error');
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
    if (!confirm(`Delete purchase "${purchase?.invoice_no}"? This cannot be undone.`)) return;

    try {
        await deletePurchase(id);
        showToast('Purchase deleted.');
        loadPurchases(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
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



