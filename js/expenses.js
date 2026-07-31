import { initLayout, getCurrentProfile } from './layout.js';
import { getAllExpenses, createExpense, updateExpense, deleteExpense } from './services/expense-service.js';
import { getWarehousesForDropdown } from './services/purchase-service.js';

await initLayout('expenses');

let allExpenses = [];
let warehousesList = [];
let editingExpenseId = null;

const tableBody = document.getElementById('expensesTableBody');
const searchInput = document.getElementById('searchInput');
const addBtn = document.getElementById('addExpenseBtn');
const modalOverlay = document.getElementById('expenseModal');
const modalTitle = document.getElementById('modalTitle');
const expenseForm = document.getElementById('expenseForm');
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

function formatCategory(cat) {
    const map = {
        fuel: 'Fuel', truck: 'Truck', food: 'Food', labour: 'Labour',
        warehouse_rent: 'Warehouse Rent', repair: 'Repair',
        electricity: 'Electricity', miscellaneous: 'Miscellaneous'
    };
    return map[cat] || cat;
}

async function loadDropdowns() {
    warehousesList = await getWarehousesForDropdown();
    const warehouseSelect = document.getElementById('expenseWarehouse');
    warehouseSelect.innerHTML = '<option value="">Not warehouse-specific</option>' +
        warehousesList.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
}

async function loadExpenses(searchTerm = '') {
    tableBody.innerHTML = `<tr><td colspan="6" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i><div>Loading expenses...</div></td></tr>`;
    try {
        allExpenses = await getAllExpenses(searchTerm);
        renderTable(allExpenses);
    } catch (err) {
        showToast('Failed to load expenses: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="6" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderTable(expenses) {
    if (!expenses.length) {
        tableBody.innerHTML = `
            <tr><td colspan="6">
                <div class="table-empty">
                    <i class="fa-solid fa-receipt"></i>
                    <div>No expenses found. Click "Add Expense" to record your first one.</div>
                </div>
            </td></tr>`;
        return;
    }

    tableBody.innerHTML = expenses.map(e => `
        <tr>
            <td>${new Date(e.expense_date).toLocaleDateString('en-GB')}</td>
            <td><span class="badge badge-success">${formatCategory(e.category)}</span></td>
            <td>${e.warehouses?.name || '-'}</td>
            <td>${e.description || '-'}</td>
            <td>৳${fmt(e.amount)}</td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn edit-btn" data-id="${e.id}" title="Edit"><i class="fa-solid fa-pen"></i></button>
                    <button class="icon-btn delete delete-btn" data-id="${e.id}" title="Delete"><i class="fa-solid fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.edit-btn').forEach(btn => btn.addEventListener('click', () => openEditModal(btn.dataset.id)));
    document.querySelectorAll('.delete-btn').forEach(btn => btn.addEventListener('click', () => handleDelete(btn.dataset.id)));
}

function openAddModal() {
    editingExpenseId = null;
    modalTitle.textContent = 'Add Expense';
    expenseForm.reset();
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    modalOverlay.classList.add('open');
}

function openEditModal(id) {
    const expense = allExpenses.find(e => e.id === id);
    if (!expense) return;

    editingExpenseId = id;
    modalTitle.textContent = 'Edit Expense';

    document.getElementById('expenseDate').value = expense.expense_date;
    document.getElementById('expenseCategory').value = expense.category;
    document.getElementById('expenseWarehouse').value = expense.warehouse_id || '';
    document.getElementById('expenseAmount').value = expense.amount;
    document.getElementById('expensePaymentMethod').value = expense.payment_method;
    document.getElementById('expenseDescription').value = expense.description || '';

    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    expenseForm.reset();
    editingExpenseId = null;
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const expenseData = {
        expense_date: document.getElementById('expenseDate').value,
        category: document.getElementById('expenseCategory').value,
        warehouse_id: document.getElementById('expenseWarehouse').value || null,
        amount: parseFloat(document.getElementById('expenseAmount').value) || 0,
        payment_method: document.getElementById('expensePaymentMethod').value,
        description: document.getElementById('expenseDescription').value.trim(),
    };

    if (expenseData.amount <= 0) {
        showToast('Amount must be greater than 0.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        if (editingExpenseId) {
            await updateExpense(editingExpenseId, expenseData);
            showToast('Expense updated successfully.');
        } else {
            const profile = getCurrentProfile();
            await createExpense(expenseData, profile?.id);
            showToast('Expense recorded successfully.');
        }
        closeModal();
        loadExpenses(searchInput.value.trim());
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Expense';
    }
}

async function handleDelete(id) {
    if (!confirm('Delete this expense record? This cannot be undone.')) return;

    try {
        await deleteExpense(id);
        showToast('Expense deleted.');
        loadExpenses(searchInput.value.trim());
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

let searchTimeout;
searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => loadExpenses(searchInput.value.trim()), 350);
});

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
expenseForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

await loadDropdowns();
loadExpenses();
