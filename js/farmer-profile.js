import { initLayout } from './layout.js';



import {
    getFarmerById, getFarmerPurchaseHistory, getFarmerTotals, recordFarmerPayment,
    getFarmerPaymentsList, deleteFarmerPayment
} from './services/farmer-service.js';
import { confirmAction } from './components/confirm-modal.js';
import { formatDate } from './utils/date-format.js';


import { getCurrentProfile } from './layout.js';

await initLayout('farmers');

// Get farmer ID from URL query string
const urlParams = new URLSearchParams(window.location.search);
const farmerId = urlParams.get('id');

if (!farmerId) {
    window.location.href = 'farmers.html';
}

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

function getInitials(name) {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
}

let purchaseHistory = [];



async function loadProfile() {
    try {
        const [farmer, totals, history, payments] = await Promise.all([
            getFarmerById(farmerId),
            getFarmerTotals(farmerId),
            getFarmerPurchaseHistory(farmerId),
            getFarmerPaymentsList(farmerId)
        ]);

        purchaseHistory = history;
        renderHeader(farmer);
        renderBalanceCards(totals);
        renderPurchaseHistory(history);
        renderRecentPayments(payments);
    } catch (err) {
        showToast('Failed to load farmer profile: ' + err.message, 'error');
    }
}


function renderHeader(farmer) {
    document.getElementById('profileHeader').innerHTML = `
        <div class="profile-avatar-lg">${getInitials(farmer.name)}</div>
        <div class="profile-info">
            <div class="profile-name">${farmer.name}</div>
            <div class="profile-meta">
                <span><i class="fa-solid fa-phone"></i> ${farmer.phone || 'No phone'}</span>
                <span><i class="fa-solid fa-location-dot"></i> ${farmer.village || '-'}${farmer.union_name ? ', ' + farmer.union_name : ''}</span>
                <span><i class="fa-solid fa-id-card"></i> ${farmer.nid || 'No NID'}</span>
            </div>
        </div>
    `;
}

function renderBalanceCards(totals) {
    document.getElementById('balanceCards').innerHTML = `
        <div class="balance-card">
            <div class="balance-card-label">Total Purchased</div>
            <div class="balance-card-value">৳${fmt(totals.total_purchased)}</div>
        </div>
        <div class="balance-card">
            <div class="balance-card-label">Total Paid</div>
            <div class="balance-card-value" style="color:var(--color-accent);">৳${fmt(totals.total_paid)}</div>
        </div>
        <div class="balance-card">
            <div class="balance-card-label">Outstanding Due</div>
            <div class="balance-card-value" style="color:${totals.outstanding_balance > 0 ? 'var(--color-danger)' : 'var(--color-accent)'};">৳${fmt(totals.outstanding_balance)}</div>
        </div>
        <div class="balance-card">
            <div class="balance-card-label">Total Purchases</div>
            <div class="balance-card-value">${totals.transaction_count}</div>
        </div>
    `;
}

function renderPurchaseHistory(history) {
    const container = document.getElementById('purchaseHistoryTable');

    if (!history.length) {
        container.innerHTML = `<div class="table-empty"><i class="fa-solid fa-inbox"></i><div>No purchase history yet.</div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="data-table-wrapper">
            <table>
                <thead>
                    <tr><th>Invoice</th><th>Date</th><th>Variety</th><th>Quantity</th><th>Price/Md</th><th>Amount</th><th>Paid</th><th>Due</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${history.map(p => {
                        const due = Number(p.gross_amount) - Number(p.amount_paid);
                        return `
                        <tr>
                            <td><span class="invoice-badge">${p.invoice_no}</span></td>
                            <td>${formatDate(p.purchase_date)}</td>
                            <td>${p.paddy_varieties?.name || '-'}</td>
                            <td>${fmt(p.maund)} Md</td>
                            <td>৳${fmt(p.price_per_maund)}</td>
                            <td>৳${fmt(p.gross_amount)}</td>
                            <td>৳${fmt(p.amount_paid)}</td>
                            <td style="color:${due > 0 ? 'var(--color-danger)' : 'var(--text-secondary)'};">৳${fmt(due)}</td>
                            <td><span class="badge ${p.payment_status === 'paid' ? 'payment-badge-paid' : p.payment_status === 'partial' ? 'payment-badge-partial' : 'payment-badge-due'}">${p.payment_status}</span></td>
                            <td>
                                ${due > 0 ? `<button class="btn-secondary pay-btn" data-id="${p.id}" data-due="${due}" style="padding:6px 12px; font-size:12px;">Pay</button>` : '-'}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.pay-btn').forEach(btn => {
        btn.addEventListener('click', () => openPaymentModal(btn.dataset.id, btn.dataset.due));
    });
}



function renderRecentPayments(payments) {
    const container = document.getElementById('recentPaymentsTable');

    if (!payments.length) {
        container.innerHTML = `<div class="table-empty"><i class="fa-solid fa-inbox"></i><div>No payments recorded yet.</div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="data-table-wrapper">
            <table>
                <thead><tr><th>Date</th><th>Invoice</th><th>Amount</th><th>Method</th><th>Action</th></tr></thead>
                <tbody>
                    ${payments.map(p => `
                        <tr>
                            <td>${formatDate(p.payment_date)}</td>
                            <td><span class="invoice-badge">${p.purchases?.invoice_no || '-'}</span></td>
                            <td>৳${fmt(p.amount)}</td>
                            <td>${p.payment_method}</td>
                            <td>
                                <button class="icon-btn delete delete-payment-btn" data-id="${p.id}" data-purchase-id="${p.purchase_id}" data-amount="${p.amount}" title="Delete this payment">
                                    <i class="fa-solid fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    document.querySelectorAll('.delete-payment-btn').forEach(btn => {
        btn.addEventListener('click', () => handleDeletePayment(btn.dataset.id, btn.dataset.purchaseId, btn.dataset.amount));
    });
}

async function handleDeletePayment(paymentId, purchaseId, amount) {
    const confirmed = await confirmAction({
        title: 'Delete Payment?',
        message: `Delete this payment of ৳${fmt(amount)}? The purchase's due amount will increase back.`,
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteFarmerPayment(paymentId, purchaseId, amount);
        showToast('Payment deleted and due restored.');
        loadProfile();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// ---------- Payment Modal ----------
const paymentModal = document.getElementById('paymentModal');
let payingPurchaseId = null;

function openPaymentModal(purchaseId, due) {
    payingPurchaseId = purchaseId;
    document.getElementById('paymentDueAmount').textContent = `৳${fmt(due)}`;
    document.getElementById('paymentAmount').value = due;
    document.getElementById('paymentAmount').max = due;
    paymentModal.classList.add('open');
}

document.getElementById('paymentModalClose').addEventListener('click', () => paymentModal.classList.remove('open'));
document.getElementById('paymentCancelBtn').addEventListener('click', () => paymentModal.classList.remove('open'));

document.getElementById('paymentForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = parseFloat(document.getElementById('paymentAmount').value);
    const method = document.getElementById('paymentMethodSelect').value;

    if (!amount || amount <= 0) {
        showToast('Enter a valid payment amount.', 'error');
        return;
    }

    const submitBtn = document.getElementById('paymentSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Processing...';

    try {
        const profile = getCurrentProfile();
        await recordFarmerPayment(payingPurchaseId, farmerId, amount, method, profile?.id);
        showToast('Payment recorded successfully.');
        paymentModal.classList.remove('open');
        loadProfile();
    } catch (err) {
        showToast('Payment failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Record Payment';
    }
});

loadProfile();
