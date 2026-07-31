import { initLayout, getCurrentProfile } from './layout.js';
import { getAllFarmers, createFarmer, updateFarmer, deleteFarmer } from './services/farmer-service.js';

await initLayout('farmers');

let allFarmers = [];
let editingFarmerId = null;

const tableBody = document.getElementById('farmersTableBody');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addFarmerBtn');
const modalOverlay = document.getElementById('farmerModal');
const modalTitle = document.getElementById('modalTitle');
const farmerForm = document.getElementById('farmerForm');
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

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

async function loadFarmers(searchTerm = '') {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>Loading farmers...</div></td></tr>`;
    try {
        allFarmers = await getAllFarmers(searchTerm);
        renderTable(allFarmers);
    } catch (err) {
        showToast('Failed to load farmers: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderTable(farmers) {
    if (!farmers.length) {
        tableBody.innerHTML = `
            <tr><td colspan="6">
                <div class="table-empty">
                    <i class="fa-solid fa-user-tie"></i>
                    <div>No farmers found. Click "Add Farmer" to add your first one.</div>
                </div>
            </td></tr>`;
        return;
    }

    tableBody.innerHTML = farmers.map(f => `
        <tr>

        
            <td>
                <a href="farmer-profile.html?id=${f.id}" style="text-decoration:none; color:inherit;">
                    <span class="table-avatar">${getInitials(f.name)}</span>
                    <strong style="color:var(--color-primary);">${f.name}</strong>
                </a>
            </td>


            
            <td>${f.phone || '-'}</td>
            <td>${f.village || '-'}</td>
            <td>${f.district || '-'}</td>
            <td><span class="badge ${f.is_active ? 'badge-success' : 'badge-danger'}">${f.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" data-id="${f.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${f.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

function openAddModal() {
    editingFarmerId = null;
    modalTitle.textContent = 'Add Farmer';
    farmerForm.reset();
    modalOverlay.classList.add('open');
}

function openEditModal(id) {
    const farmer = allFarmers.find(f => f.id === id);
    if (!farmer) return;

    editingFarmerId = id;
    modalTitle.textContent = 'Edit Farmer';

    document.getElementById('farmerName').value = farmer.name || '';
    document.getElementById('farmerPhone').value = farmer.phone || '';
    document.getElementById('farmerVillage').value = farmer.village || '';
    document.getElementById('farmerUnion').value = farmer.union_name || '';
    document.getElementById('farmerDistrict').value = farmer.district || '';
    document.getElementById('farmerNid').value = farmer.nid || '';
    document.getElementById('farmerRemarks').value = farmer.remarks || '';

    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    farmerForm.reset();
    editingFarmerId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const farmerData = {
        name: document.getElementById('farmerName').value.trim(),
        phone: document.getElementById('farmerPhone').value.trim(),
        village: document.getElementById('farmerVillage').value.trim(),
        union_name: document.getElementById('farmerUnion').value.trim(),
        district: document.getElementById('farmerDistrict').value.trim(),
        nid: document.getElementById('farmerNid').value.trim(),
        remarks: document.getElementById('farmerRemarks').value.trim(),
    };

    if (!farmerData.name) {
        showToast('Farmer name is required.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        if (editingFarmerId) {
            await updateFarmer(editingFarmerId, farmerData);
            showToast('Farmer updated successfully.');
        } else {
            const profile = getCurrentProfile();
            await createFarmer(farmerData, profile?.id);
            showToast('Farmer added successfully.');
        }
        closeModal();
        loadFarmers(searchInput.value.trim());
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Farmer';
    }
}

async function handleDelete(id) {
    const farmer = allFarmers.find(f => f.id === id);
    if (!confirm(`Delete farmer "${farmer?.name}"? This cannot be undone.`)) return;

    try {
        await deleteFarmer(id);
        showToast('Farmer deleted.');
        loadFarmers(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// Debounced search
let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadFarmers(searchInput.value.trim()), 350);
});

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
farmerForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

loadFarmers();
