import { getCurrentSession, getCurrentUserProfile, logoutUser } from './services/auth-service.js';
import { getFarmersWithDue } from './services/farmer-service.js';
import { getBuyersWithDue } from './services/buyer-service.js';

// Navigation menu structure - icons and links for the sidebar
const NAV_ITEMS = [
    { section: 'Main' },
    { icon: 'fa-chart-line', label: 'Dashboard', href: 'dashboard.html', page: 'dashboard' },
    { section: 'Trading' },
    { icon: 'fa-user-tie', label: 'Farmers', href: 'farmers.html', page: 'farmers' },
    { icon: 'fa-handshake', label: 'Buyers', href: 'buyers.html', page: 'buyers' },
    { icon: 'fa-cart-shopping', label: 'Purchases', href: 'purchases.html', page: 'purchases' },
    { icon: 'fa-money-bill-trend-up', label: 'Sales', href: 'sales.html', page: 'sales' },
    { section: 'Operations' },
    { icon: 'fa-warehouse', label: 'Warehouses', href: 'warehouses.html', page: 'warehouses' },
    { icon: 'fa-boxes-stacked', label: 'Inventory', href: 'inventory.html', page: 'inventory' },
    { icon: 'fa-receipt', label: 'Expenses', href: 'expenses.html', page: 'expenses' },
    { section: 'Insights' },
    {
        icon: 'fa-file-lines', label: 'Reports', page: 'reports',
        children: [
            { label: 'Purchase Report', href: 'reports.html?type=purchase' },
            { label: 'Sales Report', href: 'reports.html?type=sales' },
            { label: 'Expense Report', href: 'reports.html?type=expense' },
            { label: 'Profit & Loss', href: 'reports.html?type=profit' },
            { label: 'Cost Analysis', href: 'reports.html?type=costanalysis' },
        ]
    },
    { icon: 'fa-magnifying-glass-chart', label: 'Analytics', href: 'analytics.html', page: 'analytics' },
    
    
    { section: 'System' },
    { icon: 'fa-money-bill-transfer', label: 'Cash Adjustments', href: 'cash-adjustments.html', page: 'cash-adjustments' },
    { icon: 'fa-gear', label: 'Settings', href: 'settings.html', page: 'settings' },
    
];

let currentProfile = null;
const fmt = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 0 }).format(num || 0);

// Must be called at the top of every protected page
export async function initLayout(activePage) {
    const session = await getCurrentSession();
    if (!session) {
        window.location.href = 'index.html';
        return null;
    }

    currentProfile = await getCurrentUserProfile();
    renderSidebar(activePage);
    renderHeader(activePage);
    injectLogoutModal();
    bindLayoutEvents();
    loadDueNotifications();

    return currentProfile;
}

function renderSidebar(activePage) {
    const sidebar = document.getElementById('sidebar');
    let navHtml = '';

    const urlParams = new URLSearchParams(window.location.search);
    const activeReportType = urlParams.get('type') || 'purchase';

    NAV_ITEMS.forEach(item => {
        if (item.section) {
            navHtml += `<div class="nav-section-title">${item.section}</div>`;
        } else if (item.children) {
            const isParentActive = item.page === activePage;
            navHtml += `
                <div class="nav-group ${isParentActive ? 'expanded' : ''}">
                    <button type="button" class="nav-item nav-item-toggle ${isParentActive ? 'active' : ''}">
                        <i class="fa-solid ${item.icon}"></i>
                        <span>${item.label}</span>
                        <i class="fa-solid fa-chevron-down nav-toggle-arrow"></i>
                    </button>
                    <div class="nav-submenu">
                        ${item.children.map(child => {
                            const childType = new URLSearchParams(child.href.split('?')[1]).get('type');
                            const isChildActive = isParentActive && childType === activeReportType;
                            return `<a href="${child.href}" class="nav-subitem ${isChildActive ? 'active' : ''}">${child.label}</a>`;
                        }).join('')}
                    </div>
                </div>`;
        } else {
            const isActive = item.page === activePage ? 'active' : '';
            navHtml += `
                <a href="${item.href}" class="nav-item ${isActive}">
                    <i class="fa-solid ${item.icon}"></i>
                    <span>${item.label}</span>
                </a>`;
        }
    });

    sidebar.innerHTML = `
        <div class="sidebar-header">
            <i class="fa-solid fa-warehouse"></i>
            <span>Rice Trading ERP</span>
        </div>
        <nav class="sidebar-nav">${navHtml}</nav>
    `;

    // Expand/collapse submenu on toggle click
    sidebar.querySelectorAll('.nav-item-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            btn.closest('.nav-group').classList.toggle('expanded');
        });
    });
}

function renderHeader(activePage) {
    const header = document.getElementById('topHeader');
    const pageTitle = NAV_ITEMS.find(i => i.page === activePage)?.label || 'Dashboard';
    const initials = (currentProfile?.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

    header.innerHTML = `
        <div class="header-left">
            <button class="menu-toggle" id="menuToggle"><i class="fa-solid fa-bars"></i></button>
            <div class="page-title">${pageTitle}</div>
        </div>
        <div class="header-right">
            <button class="header-icon-btn" id="themeToggle"><i class="fa-solid fa-moon"></i></button>
            <div class="notif-wrapper">
                <button class="header-icon-btn" id="notifBtn">
                    <i class="fa-solid fa-bell"></i>
                    <span class="badge-dot" id="notifBadge" style="display:none;"></span>
                </button>
                <div class="notif-dropdown" id="notifDropdown">
                    <div class="notif-empty"><i class="fa-solid fa-spinner fa-spin"></i></div>
                </div>
            </div>
            <div class="user-menu" id="userMenu">
                <div class="user-avatar">${initials}</div>
                <div class="user-info">
                    <div class="user-name">${currentProfile?.full_name || 'User'}</div>
                    <div class="user-role">${currentProfile?.role || ''}</div>
                </div>
                <i class="fa-solid fa-chevron-down" style="font-size:11px;color:var(--text-secondary);"></i>
            </div>
        </div>
    `;
}

// ---------- Due payments/collections shown in the notification bell ----------
async function loadDueNotifications() {
    const badge = document.getElementById('notifBadge');
    const dropdown = document.getElementById('notifDropdown');

    try {
        const [farmersDue, buyersDue] = await Promise.all([
            getFarmersWithDue(),
            getBuyersWithDue()
        ]);

        const totalCount = farmersDue.length + buyersDue.length;
        if (totalCount > 0) badge.style.display = 'block';

        if (!totalCount) {
            dropdown.innerHTML = `<div class="notif-empty">কোনো বকেয়া নেই।</div>`;
            return;
        }

        let html = '';

        if (farmersDue.length) {
            html += `<div class="notif-section-title">ফার্মারকে দিতে হবে</div>`;
            html += farmersDue.map(f => `
                <a href="farmer-profile.html?id=${f.id}" class="notif-item">
                    <i class="fa-solid fa-user-tie"></i>
                    <div class="notif-item-text">
                        <div class="notif-item-name">${f.name}</div>
                        <div class="notif-item-sub">বাকি ৳${fmt(f.outstanding_balance)}</div>
                    </div>
                </a>`).join('');
        }

        if (buyersDue.length) {
            html += `<div class="notif-section-title">বায়ারের থেকে পাব</div>`;
            html += buyersDue.map(b => `
                <a href="buyer-profile.html?id=${b.id}" class="notif-item">
                    <i class="fa-solid fa-handshake"></i>
                    <div class="notif-item-text">
                        <div class="notif-item-name">${b.name}</div>
                        <div class="notif-item-sub">পাব ৳${fmt(b.outstanding_balance)}</div>
                    </div>
                </a>`).join('');
        }

        dropdown.innerHTML = html;
    } catch (e) {
        console.error('Due notifications error:', e);
        dropdown.innerHTML = `<div class="notif-empty">লোড করা যায়নি।</div>`;
    }
}

function bindLayoutEvents() {
    // Mobile sidebar toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    menuToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
    });

    // Dark mode toggle
    const themeToggle = document.getElementById('themeToggle');
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    themeToggle?.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
    });

    // Notification bell dropdown toggle
    const notifBtn = document.getElementById('notifBtn');
    const notifDropdown = document.getElementById('notifDropdown');

    notifBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        notifDropdown.classList.toggle('open');
    });

    document.addEventListener('click', (e) => {
        if (notifDropdown && notifDropdown.classList.contains('open') && !notifDropdown.contains(e.target) && e.target !== notifBtn) {
            notifDropdown.classList.remove('open');
        }
    });

    

    // User menu -> open styled logout confirmation modal
    const userMenu = document.getElementById('userMenu');
    userMenu?.addEventListener('click', () => {
        document.getElementById('logoutModalOverlay')?.classList.add('open');
    });
}

function injectLogoutModal() {
    if (document.getElementById('logoutModalOverlay')) return;

    const modal = document.createElement('div');
    modal.id = 'logoutModalOverlay';
    modal.className = 'logout-modal-overlay';
    modal.innerHTML = `
        <div class="logout-modal-box">
            <div class="logout-modal-icon"><i class="fa-solid fa-right-from-bracket"></i></div>
            <div class="logout-modal-title">লগ আউট করবেন?</div>
            <div class="logout-modal-text">আপনি কি Rice Trading ERP Pro থেকে লগ আউট করতে চান?</div>
            <div class="logout-modal-actions">
                <button type="button" class="logout-cancel-btn" id="logoutCancelBtn">Cancel</button>
                <button type="button" class="logout-confirm-btn" id="logoutConfirmBtn">Log Out</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('open');
    });

    document.getElementById('logoutCancelBtn').addEventListener('click', () => {
        modal.classList.remove('open');
    });

    document.getElementById('logoutConfirmBtn').addEventListener('click', async () => {
        await logoutUser();
        window.location.href = 'index.html';
    });
}




function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

export function getCurrentProfile() {
    return currentProfile;
}
