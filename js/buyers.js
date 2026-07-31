import { initLayout, getCurrentProfile } from './layout.js';
import { getAllBuyers, createBuyer, updateBuyer, deleteBuyer } from './services/buyer-service.js';

await initLayout('buyers');

let allBuyers = [];
let editingBuyerId = null;

const tableBody = document.getElementById('buyersTableBody');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addBuyerBtn');
const modalOverlay = document.getElementById('buyerModal');
const modalTitle = document.getElementById('modalTitle');
const buyerForm = document.getElementById('buyerForm');
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

function formatBuyerType(type) {
    const map = { rice_mill: 'Rice Mill', arat: 'Arat', wholesaler: 'Wholesaler' };
    return map[type] || type;
}

async function loadBuyers(searchTerm = '') {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>Loading buyers...</div></td></tr>`;
    try {
        allBuyers = await getAllBuyers(searchTerm);
        renderTable(allBuyers);
    } catch (err) {
        showToast('Failed to load buyers: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderTable(buyers) {
    if (!buyers.length) {
        tableBody.innerHTML = `
            <tr><td colspan="6">
                <div class="table-empty">
                    <i class="fa-solid fa-handshake"></i>
                    <div>No buyers found. Click "Add Buyer" to add your first one.</div>
                </div>
            </td></tr>`;
        return;
    }

    tableBody.innerHTML = buyers.map(b => `
        <tr>


        
            <td>
                <a href="buyer-profile.html?id=${b.id}" style="text-decoration:none; color:inherit;">
                    <span class="table-avatar">${getInitials(b.name)}</span>
                    <strong style="color:var(--color-primary);">${b.name}</strong>
                </a>
            </td>



            
            <td><span class="badge badge-success">${formatBuyerType(b.buyer_type)}</span></td>
            <td>${b.phone || '-'}</td>
            <td>${b.contact_person || '-'}</td>
            <td><span class="badge ${b.is_active ? 'badge-success' : 'badge-danger'}">${b.is_active ? 'Active' : 'Inactive'}</span></td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" data-id="${b.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${b.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

function openAddModal() {
    editingBuyerId = null;
    modalTitle.textContent = 'Add Buyer';
    buyerForm.reset();
    modalOverlay.classList.add('open');
}

function openEditModal(id) {
    const buyer = allBuyers.find(b => b.id === id);
    if (!buyer) return;

    editingBuyerId = id;
    modalTitle.textContent = 'Edit Buyer';

    document.getElementById('buyerName').value = buyer.name || '';
    document.getElementById('buyerType').value = buyer.buyer_type || 'rice_mill';
    document.getElementById('buyerPhone').value = buyer.phone || '';
    document.getElementById('buyerContactPerson').value = buyer.contact_person || '';
    document.getElementById('buyerAddress').value = buyer.address || '';
    document.getElementById('buyerRemarks').value = buyer.remarks || '';

    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    buyerForm.reset();
    editingBuyerId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const buyerData = {
        name: document.getElementById('buyerName').value.trim(),
        buyer_type: document.getElementById('buyerType').value,
        phone: document.getElementById('buyerPhone').value.trim(),
        contact_person: document.getElementById('buyerContactPerson').value.trim(),
        address: document.getElementById('buyerAddress').value.trim(),
        remarks: document.getElementById('buyerRemarks').value.trim(),
    };

    if (!buyerData.name) {
        showToast('Buyer name is required.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        if (editingBuyerId) {
            await updateBuyer(editingBuyerId, buyerData);
            showToast('Buyer updated successfully.');
        } else {
            const profile = getCurrentProfile();
            await createBuyer(buyerData, profile?.id);
            showToast('Buyer added successfully.');
        }
        closeModal();
        loadBuyers(searchInput.value.trim());
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Buyer';
    }
}

async function handleDelete(id) {
    const buyer = allBuyers.find(b => b.id === id);
    if (!confirm(`Delete buyer "${buyer?.name}"? This cannot be undone.`)) return;

    try {
        await deleteBuyer(id);
        showToast('Buyer deleted.');
        loadBuyers(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadBuyers(searchInput.value.trim()), 350);
});

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
buyerForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

loadBuyers();
