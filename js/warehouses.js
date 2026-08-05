import { initLayout, getCurrentProfile } from './layout.js';
import {
    getAllWarehouses, createWarehouse, updateWarehouse,
    deleteWarehouse, getWarehouseUtilizationMap
} from './services/warehouse-service.js';
import { confirmAction } from './components/confirm-modal.js';

await initLayout('warehouses');

let allWarehouses = [];
let utilizationMap = {};
let editingWarehouseId = null;

const tableBody = document.getElementById('warehousesTableBody');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addWarehouseBtn');
const modalOverlay = document.getElementById('warehouseModal');
const modalTitle = document.getElementById('modalTitle');
const warehouseForm = document.getElementById('warehouseForm');
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

const fmt = (num) => new Intl.NumberFormat('en-BD').format(Math.round(num || 0));

async function loadWarehouses(searchTerm = '') {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>Loading warehouses...</div></td></tr>`;
    try {
        [allWarehouses, utilizationMap] = await Promise.all([
            getAllWarehouses(searchTerm),
            getWarehouseUtilizationMap()
        ]);
        renderTable(allWarehouses);
    } catch (err) {
        showToast('Failed to load warehouses: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderTable(warehouses) {
    if (!warehouses.length) {
        tableBody.innerHTML = `
            <tr><td colspan="6">
                <div class="table-empty">
                    <i class="fa-solid fa-warehouse"></i>
                    <div>No warehouses found. Click "Add Warehouse" to add your first one.</div>
                </div>
            </td></tr>`;
        return;
    }

    tableBody.innerHTML = warehouses.map(w => {
        const util = utilizationMap[w.id] || { used_maund: 0, utilization_percent: 0 };
        const pct = Math.min(util.utilization_percent, 100);
        const barColor = pct > 90 ? 'var(--color-danger)' : pct > 70 ? 'var(--color-warning)' : 'var(--color-accent)';

        return `
        <tr>
            <td><strong>${w.name}</strong></td>
            <td>${w.location || '-'}</td>
            <td>${fmt(w.capacity_maund)} Maund</td>
            <td>
                <div style="display:flex; align-items:center; gap:8px;">
                    <div style="flex:1; height:6px; background:var(--bg-primary); border-radius:10px; overflow:hidden; min-width:70px;">
                        <div style="width:${pct}%; height:100%; background:${barColor};"></div>
                    </div>
                    <span style="font-size:11px; color:var(--text-secondary); white-space:nowrap;">${util.utilization_percent}%</span>
                </div>
            </td>
            <td>${w.manager_name || '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" data-id="${w.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${w.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>`;
    }).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

function openAddModal() {
    editingWarehouseId = null;
    modalTitle.textContent = 'Add Warehouse';
    warehouseForm.reset();
    modalOverlay.classList.add('open');
}

function openEditModal(id) {
    const warehouse = allWarehouses.find(w => w.id === id);
    if (!warehouse) return;

    editingWarehouseId = id;
    modalTitle.textContent = 'Edit Warehouse';

    document.getElementById('warehouseName').value = warehouse.name || '';
    document.getElementById('warehouseLocation').value = warehouse.location || '';
    document.getElementById('warehouseCapacity').value = warehouse.capacity_maund || '';
    document.getElementById('warehouseManagerName').value = warehouse.manager_name || '';
    document.getElementById('warehouseManagerPhone').value = warehouse.manager_phone || '';

    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    warehouseForm.reset();
    editingWarehouseId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const warehouseData = {
        name: document.getElementById('warehouseName').value.trim(),
        location: document.getElementById('warehouseLocation').value.trim(),
        capacity_maund: parseFloat(document.getElementById('warehouseCapacity').value) || 0,
        manager_name: document.getElementById('warehouseManagerName').value.trim(),
        manager_phone: document.getElementById('warehouseManagerPhone').value.trim(),
    };

    if (!warehouseData.name) {
        showToast('Warehouse name is required.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        if (editingWarehouseId) {
            await updateWarehouse(editingWarehouseId, warehouseData);
            showToast('Warehouse updated successfully.');
        } else {
            const profile = getCurrentProfile();
            await createWarehouse(warehouseData, profile?.id);
            showToast('Warehouse added successfully.');
        }
        closeModal();
        loadWarehouses(searchInput.value.trim());
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Warehouse';
    }
}

async function handleDelete(id) {
    const warehouse = allWarehouses.find(w => w.id === id);

    const confirmed = await confirmAction({
        title: 'Delete Warehouse?',
        message: `Delete warehouse "${warehouse?.name}"? This cannot be undone.`,
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteWarehouse(id);
        showToast('Warehouse deleted.');
        loadWarehouses(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadWarehouses(searchInput.value.trim()), 350);
});

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
warehouseForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

loadWarehouses();
