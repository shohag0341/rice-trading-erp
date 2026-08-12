import { initLayout, getCurrentProfile } from './layout.js';
import {
    getBusinessSettings, updateBusinessSettings,
    getAllUsers, updateUserRole, toggleUserActiveStatus
} from './services/settings-service.js';
import { confirmAction } from './components/confirm-modal.js';
import { formatDate } from './utils/date-format.js';
import { getBackupData } from './services/backup-service.js';

const currentUserProfile = await initLayout('settings');

let businessSettingsId = null;
let allUsers = [];

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

// ---------- Tab switching ----------
document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// ---------- Business Info ----------
async function loadBusinessSettings() {
    try {
        const settings = await getBusinessSettings();
        businessSettingsId = settings.id;

        document.getElementById('businessName').value = settings.business_name || '';
        document.getElementById('businessAddress').value = settings.address || '';
        document.getElementById('businessPhone').value = settings.phone || '';
        document.getElementById('businessEmail').value = settings.email || '';
        document.getElementById('businessCurrency').value = settings.currency || 'BDT';
        document.getElementById('kgPerMaund').value = settings.kg_per_maund || 40;
        document.getElementById('lowStockThreshold').value = settings.low_stock_threshold_maund || 100;
    } catch (err) {
        showToast('Failed to load business settings: ' + err.message, 'error');
    }
}

document.getElementById('businessSettingsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const settingsData = {
        business_name: document.getElementById('businessName').value.trim(),
        address: document.getElementById('businessAddress').value.trim(),
        phone: document.getElementById('businessPhone').value.trim(),
        email: document.getElementById('businessEmail').value.trim(),
        currency: document.getElementById('businessCurrency').value,
        kg_per_maund: parseFloat(document.getElementById('kgPerMaund').value) || 40,
        low_stock_threshold_maund: parseFloat(document.getElementById('lowStockThreshold').value) || 100,
    };

    const submitBtn = document.getElementById('businessSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        const profile = getCurrentProfile();
        await updateBusinessSettings(businessSettingsId, settingsData, profile?.id);
        showToast('Business settings updated successfully.');
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Settings';
    }
});

// ---------- User Management ----------
function formatRole(role) {
    const map = { admin: 'Admin', manager: 'Manager', staff: 'Staff', viewer: 'Viewer' };
    return map[role] || role;
}

async function loadUsers() {
    const tableBody = document.getElementById('usersTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading users...</td></tr>`;

    try {
        allUsers = await getAllUsers();
        renderUsersTable(allUsers);
    } catch (err) {
        showToast('Failed to load users: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Could not load users.</td></tr>`;
    }
}

function renderUsersTable(users) {
    const tableBody = document.getElementById('usersTableBody');
    const isCurrentUserAdmin = currentUserProfile?.role === 'admin';

    if (!users.length) {
        tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">No users found.</td></tr>`;
        return;
    }

    tableBody.innerHTML = users.map(u => `
        <tr>
            <td><strong>${u.full_name}</strong></td>
            <td>${u.phone || '-'}</td>
            <td>
                ${isCurrentUserAdmin ? `
                    <select class="role-select" data-id="${u.id}" ${u.id === currentUserProfile.id ? 'disabled' : ''}>
                        <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                        <option value="manager" ${u.role === 'manager' ? 'selected' : ''}>Manager</option>
                        <option value="staff" ${u.role === 'staff' ? 'selected' : ''}>Staff</option>
                        <option value="viewer" ${u.role === 'viewer' ? 'selected' : ''}>Viewer</option>
                    </select>
                ` : `<span class="badge badge-success">${formatRole(u.role)}</span>`}
            </td>
            <td>
                ${isCurrentUserAdmin && u.id !== currentUserProfile.id ? `
                    <button class="status-toggle-btn ${u.is_active ? 'status-active' : 'status-inactive'} toggle-status-btn" data-id="${u.id}" data-active="${u.is_active}">
                        ${u.is_active ? 'Active' : 'Inactive'}
                    </button>
                ` : `<span class="badge ${u.is_active ? 'badge-success' : 'badge-danger'}">${u.is_active ? 'Active' : 'Inactive'}</span>`}
            </td>
            <td>${formatDate(u.created_at)}</td>
        </tr>
    `).join('');

    if (isCurrentUserAdmin) {
        document.querySelectorAll('.role-select').forEach(select => {
            select.addEventListener('change', () => handleRoleChange(select.dataset.id, select.value));
        });

        document.querySelectorAll('.toggle-status-btn').forEach(btn => {
            btn.addEventListener('click', () => handleStatusToggle(btn.dataset.id, btn.dataset.active === 'true'));
        });
    }
}

async function handleRoleChange(userId, newRole) {
    const user = allUsers.find(u => u.id === userId);

    const confirmed = await confirmAction({
        title: 'Change Role?',
        message: `Change ${user?.full_name}'s role to "${formatRole(newRole)}"?`,
        confirmText: 'Change Role',
        danger: false
    });
    if (!confirmed) {
        loadUsers();
        return;
    }

    try {
        await updateUserRole(userId, newRole);
        showToast('User role updated successfully.');
        loadUsers();
    } catch (err) {
        showToast('Failed to update role: ' + err.message, 'error');
        loadUsers();
    }
}

async function handleStatusToggle(userId, currentlyActive) {
    const user = allUsers.find(u => u.id === userId);
    const action = currentlyActive ? 'deactivate' : 'activate';

    const confirmed = await confirmAction({
        title: currentlyActive ? 'Deactivate User?' : 'Activate User?',
        message: `Are you sure you want to ${action} ${user?.full_name}?`,
        confirmText: currentlyActive ? 'Deactivate' : 'Activate',
        danger: currentlyActive
    });
    if (!confirmed) return;

    try {
        await toggleUserActiveStatus(userId, !currentlyActive);
        showToast(`User ${action}d successfully.`);
        loadUsers();
    } catch (err) {
        showToast('Failed to update status: ' + err.message, 'error');
    }
}

// ---------- Backup & Export ----------
const fmtNum = (num) => Number(num || 0);

function buildBackupWorkbook(data) {
    const wb = XLSX.utils.book_new();

    const farmersSheet = data.farmers.map(f => ({
        Name: f.name, Phone: f.phone || '', Village: f.village || '', Union: f.union_name || '',
        District: f.district || '', NID: f.nid || '', Status: f.is_active ? 'Active' : 'Inactive',
        Remarks: f.remarks || ''
    }));

    const buyersSheet = data.buyers.map(b => ({
        Name: b.name, Type: b.buyer_type, Phone: b.phone || '', 'Contact Person': b.contact_person || '',
        Address: b.address || '', Status: b.is_active ? 'Active' : 'Inactive', Remarks: b.remarks || ''
    }));

    const warehousesSheet = data.warehouses.map(w => ({
        Name: w.name, Location: w.location || '', 'Capacity (Maund)': fmtNum(w.capacity_maund),
        'Manager Name': w.manager_name || '', 'Manager Phone': w.manager_phone || ''
    }));

    const varietiesSheet = data.varieties.map(v => ({
        Name: v.name, Status: v.is_active ? 'Active' : 'Inactive'
    }));

    const purchasesSheet = data.purchases.map(p => ({
        Invoice: p.invoice_no, Date: formatDate(p.purchase_date), Farmer: p.farmers?.name || '',
        Warehouse: p.warehouses?.name || '', Variety: p.paddy_varieties?.name || '',
        'Weight (KG)': fmtNum(p.weight_kg), Maund: fmtNum(p.maund), 'Price/Maund': fmtNum(p.price_per_maund),
        Transport: fmtNum(p.transport_cost), Labour: fmtNum(p.labour_cost), Food: fmtNum(p.food_cost),
        Other: fmtNum(p.other_expenses), 'Net Cost': fmtNum(p.net_cost), 'Payment Method': p.payment_method,
        'Payment Status': p.payment_status, 'Amount Paid': fmtNum(p.amount_paid), Remarks: p.remarks || ''
    }));

    const salesSheet = data.sales.map(s => ({
        Invoice: s.invoice_no, Date: formatDate(s.sale_date), Buyer: s.buyers?.name || '',
        Warehouse: s.warehouses?.name || '', Variety: s.paddy_varieties?.name || '',
        'Weight (KG)': fmtNum(s.weight_kg), Maund: fmtNum(s.maund), 'Selling Price/Maund': fmtNum(s.selling_price_per_maund),
        Transport: fmtNum(s.transport_cost), Labour: fmtNum(s.labour_cost), Commission: fmtNum(s.commission),
        Other: fmtNum(s.other_expenses), 'Net Amount': fmtNum(s.net_amount), 'Net Profit': fmtNum(s.net_profit),
        'Payment Method': s.payment_method, 'Payment Status': s.payment_status,
        'Amount Received': fmtNum(s.amount_received), Remarks: s.remarks || ''
    }));

    const expensesSheet = data.expenses.map(e => ({
        Date: formatDate(e.expense_date), Category: e.category, Warehouse: e.warehouses?.name || '',
        Description: e.description || '', Amount: fmtNum(e.amount), 'Payment Method': e.payment_method
    }));

    const cashAdjustmentsSheet = data.cashAdjustments.map(a => ({
        Date: formatDate(a.adjustment_date), Type: a.adjustment_type === 'cash_out' ? 'Cash Out' : 'Cash Returned',
        Amount: fmtNum(a.amount), Reason: a.reason || ''
    }));

    const damagedStockSheet = data.damagedStock.map(d => ({
        Date: formatDate(d.damage_date), Type: d.adjustment_type === 'gain' ? 'Gain' : 'Loss',
        Warehouse: d.warehouses?.name || '', Variety: d.paddy_varieties?.name || '',
        'Weight (KG)': fmtNum(d.weight_kg), 'Estimated Value': fmtNum(d.estimated_loss), Reason: d.reason || ''
    }));

    const farmerPaymentsSheet = data.farmerPayments.map(p => ({
        Date: formatDate(p.payment_date), Farmer: p.farmers?.name || '', Invoice: p.purchases?.invoice_no || '',
        Amount: fmtNum(p.amount), Method: p.payment_method
    }));

    const buyerPaymentsSheet = data.buyerPayments.map(p => ({
        Date: formatDate(p.payment_date), Buyer: p.buyers?.name || '', Invoice: p.sales?.invoice_no || '',
        Amount: fmtNum(p.amount), Method: p.payment_method
    }));

    const sheets = [
        ['Farmers', farmersSheet], ['Buyers', buyersSheet], ['Warehouses', warehousesSheet],
        ['Paddy Varieties', varietiesSheet], ['Purchases', purchasesSheet], ['Sales', salesSheet],
        ['Expenses', expensesSheet], ['Cash Adjustments', cashAdjustmentsSheet],
        ['Stock Adjustments', damagedStockSheet], ['Farmer Payments', farmerPaymentsSheet],
        ['Buyer Payments', buyerPaymentsSheet]
    ];

    sheets.forEach(([name, rows]) => {
        const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 'No records': '' }]);
        XLSX.utils.book_append_sheet(wb, ws, name);
    });

    return wb;
}

document.getElementById('downloadBackupBtn').addEventListener('click', async () => {
    const btn = document.getElementById('downloadBackupBtn');
    const btnText = document.getElementById('downloadBackupBtnText');
    const statusText = document.getElementById('backupStatusText');

    btn.disabled = true;
    btnText.innerHTML = '<span class="spinner"></span> Preparing backup...';
    statusText.textContent = '';

    try {
        const data = await getBackupData();
        const wb = buildBackupWorkbook(data);

        const dateStamp = new Date().toISOString().split('T')[0];
        XLSX.writeFile(wb, `rice-erp-backup-${dateStamp}.xlsx`);

        showToast('Backup downloaded successfully.');
        statusText.textContent = `Last backup: just now (${dateStamp})`;
    } catch (err) {
        showToast('Backup failed: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btnText.textContent = 'Download Backup (Excel)';
    }
});

// ---------- Init ----------
loadBusinessSettings();
loadUsers();
        
