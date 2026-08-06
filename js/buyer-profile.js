import { initLayout, getCurrentProfile } from './layout.js';
import {
    getBuyerById, getBuyerSalesHistory, getBuyerTotals, recordBuyerPayment,
    getBuyerPaymentsList, deleteBuyerPayment
} from './services/buyer-service.js';
import { confirmAction } from './components/confirm-modal.js';
import { formatDate } from './utils/date-format.js';

await initLayout('buyers');

const urlParams = new URLSearchParams(window.location.search);
const buyerId = urlParams.get('id');

if (!buyerId) {
    window.location.href = 'buyers.html';
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

function formatBuyerType(type) {
    const map = { rice_mill: 'Rice Mill', arat: 'Arat', wholesaler: 'Wholesaler' };
    return map[type] || type;
}

async function loadProfile() {
    try {
        const [buyer, totals, history, payments] = await Promise.all([
            getBuyerById(buyerId),
            getBuyerTotals(buyerId),
            getBuyerSalesHistory(buyerId),
            getBuyerPaymentsList(buyerId)
        ]);

        renderHeader(buyer);
        renderBalanceCards(totals);
        renderSalesHistory(history);
        renderRecentPayments(payments);
    } catch (err) {
        showToast('Failed to load buyer profile: ' + err.message, 'error');
        console.error('Buyer profile load error:', err);
    }
}

function renderHeader(buyer) {
    document.getElementById('profileHeader').innerHTML = `
        <div class="profile-avatar-lg">${getInitials(buyer.name)}</div>
        <div class="profile-info">
            <div class="profile-name">${buyer.name}</div>
            <div class="profile-meta">
                <span><i class="fa-solid fa-tag"></i> ${formatBuyerType(buyer.buyer_type)}</span>
                <span><i class="fa-solid fa-phone"></i> ${buyer.phone || 'No phone'}</span>
                <span><i class="fa-solid fa-user"></i> ${buyer.contact_person || '-'}</span>
            </div>
        </div>
    `;
}

function renderBalanceCards(totals) {
    document.getElementById('balanceCards').innerHTML = `
        <div class="balance-card">
            <div class="balance-card-label">Total Sold</div>
            <div class="balance-card-value">৳${fmt(totals.total_sold)}</div>
        </div>
        <div class="balance-card">
            <div class="balance-card-label">Total Received</div>
            <div class="balance-card-value" style="color:var(--color-accent);">৳${fmt(totals.total_received)}</div>
        </div>
        <div class="balance-card">
            <div class="balance-card-label">Outstanding Due</div>
            <div class="balance-card-value" style="color:${totals.outstanding_balance > 0 ? 'var(--color-danger)' : 'var(--color-accent)'};">৳${fmt(totals.outstanding_balance)}</div>
        </div>
        <div class="balance-card">
            <div class="balance-card-label">Total Sales</div>
            <div class="balance-card-value">${totals.transaction_count}</div>
        </div>
    `;
}

function renderSalesHistory(history) {
    const container = document.getElementById('salesHistoryTable');

    if (!history.length) {
        container.innerHTML = `<div class="table-empty"><i class="fa-solid fa-inbox"></i><div>No sales history yet.</div></div>`;
        return;
    }

    container.innerHTML = `
        <div class="data-table-wrapper">
            <table>
                <thead>
                    <tr><th>Invoice</th><th>Date</th><th>Variety</th><th>Quantity</th><th>Price/Md</th><th>Amount</th><th>Received</th><th>Due</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                    ${history.map(s => {
                        const due = Number(s.gross_amount) - Number(s.amount_received);
                        return `
                        <tr>
                            <td><span class="invoice-badge">${s.invoice_no}</span></td>
                            <td>${formatDate(s.sale_date)}</td>
                            <td>${s.paddy_varieties?.name || '-'}</td>
                            <td>${fmt(s.maund)} Md</td>
                            <td>৳${fmt(s.selling_price_per_maund)}</td>
                            <td>৳${fmt(s.gross_amount)}</td>
                            <td>৳${fmt(s.amount_received)}</td>
                            <td style="color:${due > 0 ? 'var(--color-danger)' : 'var(--text-secondary)'};">৳${fmt(due)}</td>
                            <td><span class="badge ${s.payment_status === 'paid' ? 'payment-badge-paid' : s.payment_status === 'partial' ? 'payment-badge-partial' : 'payment-badge-due'}">${s.payment_status}</span></td>
                            <td>
                                ${due > 0 ? `<button class="btn-secondary pay-btn" data-id="${s.id}" data-due="${due}" style="padding:6px 12px; font-size:12px;">Collect</button>` : '-'}
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
                            <td><span class="invoice-badge">${p.sales?.invoice_no || '-'}</span></td>
                            <td>৳${fmt(p.amount)}</td>
                            <td>${p.payment_method}</td>
                            <td>
                                <button class="icon-btn delete delete-payment-btn" data-id="${p.id}" data-sale-id="${p.sale_id}" data-amount="${p.amount}" title="Delete this payment">
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
        btn.addEventListener('click', () => handleDeletePayment(btn.dataset.id, btn.dataset.saleId, btn.dataset.amount));
    });
}

async function handleDeletePayment(paymentId, saleId, amount) {
    const confirmed = await confirmAction({
        title: 'Delete Payment?',
        message: `Delete this payment of ৳${fmt(amount)}? The sale's due amount will increase back.`,
        confirmText: 'Delete'
    });
    if (!confirmed) return;

    try {
        await deleteBuyerPayment(paymentId, saleId, amount);
        showToast('Payment deleted and due restored.');
        loadProfile();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

const paymentModal = document.getElementById('paymentModal');
let payingSaleId = null;

function openPaymentModal(saleId, due) {
    payingSaleId = saleId;
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
        await recordBuyerPayment(payingSaleId, buyerId, amount, method, profile?.id);
        showToast('Payment collected successfully.');
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
        
