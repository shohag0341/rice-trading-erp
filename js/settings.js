import { initLayout, getCurrentProfile } from './layout.js';
import {
    getBusinessSettings, updateBusinessSettings,
    getAllUsers, updateUserRole, toggleUserActiveStatus
} from './services/settings-service.js';

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
            <td>${new Date(u.created_at).toLocaleDateString('en-GB')}</td>
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
    if (!confirm(`Change ${user?.full_name}'s role to "${formatRole(newRole)}"?`)) {
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

    if (!confirm(`Are you sure you want to ${action} ${user?.full_name}?`)) return;

    try {
        await toggleUserActiveStatus(userId, !currentlyActive);
        showToast(`User ${action}d successfully.`);
        loadUsers();
    } catch (err) {
        showToast('Failed to update status: ' + err.message, 'error');
    }
}

// ---------- Init ----------
loadBusinessSettings();
loadUsers();

