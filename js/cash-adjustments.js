import { initLayout, getCurrentProfile } from './layout.js';
import { getAllCashAdjustments, createCashAdjustment, deleteCashAdjustment } from './services/cash-service.js';
import { confirmAction } from './components/confirm-modal.js';

await initLayout('cash-adjustments');

let allAdjustments = [];

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

const tableBody = document.getElementById('adjustmentsTableBody');
const addBtn = document.getElementById('addAdjustmentBtn');
const modalOverlay = document.getElementById('adjustmentModal');
const adjustmentForm = document.getElementById('adjustmentForm');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const cancelBtn = document.getElementById('cancelBtn');

async function loadAdjustments() {
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
        allAdjustments = await getAllCashAdjustments();
        renderSummary(allAdjustments);
        renderTable(allAdjustments);
    } catch (err) {
        showToast('Failed to load: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Could not load data.</td></tr>`;
    }
}

function renderSummary(adjustments) {
    const totalOut = adjustments.filter(a => a.adjustment_type === 'cash_out').reduce((s, a) => s + Number(a.amount), 0);
    const totalIn = adjustments.filter(a => a.adjustment_type === 'cash_in').reduce((s, a) => s + Number(a.amount), 0);
    const netOutstanding = totalOut - totalIn;

    document.getElementById('summaryGrid').innerHTML = `
        <div class="summary-mini-card">
            <div class="summary-mini-label">Total Cash Out</div>
            <div class="summary-mini-value" style="color:var(--color-danger);">৳${fmt(totalOut)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="summary-mini-label">Total Cash Returned</div>
            <div class="summary-mini-value" style="color:var(--color-accent);">৳${fmt(totalIn)}</div>
        </div>
        <div class="summary-mini-card">
            <div class="summary-mini-label">Not Yet Returned</div>
            <div class="summary-mini-value" style="color:${netOutstanding > 0 ? 'var(--color-warning)' : 'var(--color-accent)'};">৳${fmt(netOutstanding)}</div>
        </div>
    `;
}

function renderTable(adjustments) {
    if (!adjustments.length) {
        tableBody.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-money-bill-transfer"></i><div>No cash adjustments recorded yet.</div></td></tr>`;
        return;
    }

    tableBody.innerHTML = adjustments.map(a => `
        <tr>
            <td>${new Date(a.adjustment_date).toLocaleDateString('en-GB')}</td>
            <td>
                <span class="badge ${a.adjustment_type === 'cash_out' ? 'badge-danger' : 'badge-success'}">
                    ${a.adjustment_type === 'cash_out' ? 'Cash Out' : 'Cash Returned'}
                </span>
            </td>
            <td style="font-weight:700; color:${a.adjustment_type === 'cash_out' ? 'var(--color-danger)' : 'var(--color-accent)'};">
                ${a.adjustment_type === 'cash_out' ? '-' : '+'}৳${fmt(a.amount)}
            </td>
            <td>${a.reason || '-'}</td>
            <td>
                <div class="action-btns">
                    <button class="icon-btn delete delete-btn" data-id="${a.id}" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDelete(btn.dataset.id));
    });
}

function openAddModal() {
    adjustmentForm.reset();
    document.getElementById('adjustmentDate').value = new Date().toISOString().split('T')[0];
    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    adjustmentForm.reset();
}

async function handleFormSubmit(e) {
    e.preventDefault();

    const adjustmentData = {
        adjustment_date: document.getElementById('adjustmentDate').value,
        adjustment_type: document.getElementById('adjustmentType').value,
        amount: parseFloat(document.getElementById('adjustmentAmount').value) || 0,
        reason: document.getElementById('adjustmentReason').value.trim(),
    };

    if (adjustmentData.amount <= 0) {
        showToast('Amount must be greater than 0.', 'error');
        return;
    }

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        const profile = getCurrentProfile();
        await createCashAdjustment(adjustmentData, profile?.id);
        showToast('Recorded successfully.');
        closeModal();
        loadAdjustments();
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save';
    }
}

async function handleDelete(id) {
    const confirmed = await confirmAction({
        title: 'Delete Record?',
        message: 'Delete this record? This will affect your cash balance calculation.',
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteCashAdjustment(id);
        showToast('Record deleted.');
        loadAdjustments();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

addBtn.addEventListener('click', openAddModal);
modalCloseBtn.addEventListener('click', closeModal);
cancelBtn.addEventListener('click', closeModal);
adjustmentForm.addEventListener('submit', handleFormSubmit);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });

loadAdjustments();
        
