import { getCurrentSession, getCurrentUserProfile, logoutUser } from './services/auth-service.js';
import { getUnreadCount } from './services/notification-service.js';

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
    { icon: 'fa-file-lines', label: 'Reports', href: 'reports.html', page: 'reports' },
    { icon: 'fa-magnifying-glass-chart', label: 'Analytics', href: 'analytics.html', page: 'analytics' },
    { section: 'System' },
    { icon: 'fa-gear', label: 'Settings', href: 'settings.html', page: 'settings' },
];

let currentProfile = null;

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
    bindLayoutEvents();
    loadNotificationBadge(session.user.id);

    return currentProfile;
}

function renderSidebar(activePage) {
    const sidebar = document.getElementById('sidebar');
    let navHtml = '';

    NAV_ITEMS.forEach(item => {
        if (item.section) {
            navHtml += `<div class="nav-section-title">${item.section}</div>`;
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
            <button class="header-icon-btn" id="notifBtn">
                <i class="fa-solid fa-bell"></i>
                <span class="badge-dot" id="notifBadge" style="display:none;"></span>
            </button>
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

async function loadNotificationBadge(userId) {
    try {
        const count = await getUnreadCount(userId);
        const badge = document.getElementById('notifBadge');
        if (count > 0) badge.style.display = 'block';
    } catch (e) {
        console.error('Notification badge error:', e);
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

    // User menu -> simple logout on click for now
    const userMenu = document.getElementById('userMenu');
    userMenu?.addEventListener('click', async () => {
        if (confirm('Log out of Rice Trading ERP Pro?')) {
            await logoutUser();
            window.location.href = 'index.html';
        }
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = theme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

export function getCurrentProfile() {
    return currentProfile;
}
