import { initLayout, getCurrentProfile } from './layout.js';
import { getAverageCostPerMaund } from './services/sale-service.js';
import {
    getCurrentStockByWarehouse, getStockMovements, getDamagedStock, createDamagedStock,
    getStockForWarehouseVariety, deleteDamagedStock
} from './services/inventory-service.js';
import { getWarehousesForDropdown, getPaddyVarietiesForDropdown } from './services/purchase-service.js';

await initLayout('inventory');

const fmt = (num) => new Intl.NumberFormat('en-BD', { maximumFractionDigits: 2 }).format(num || 0);

let currentDamageAvailableStock = 0;
let allDamagedRecords = [];

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
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');

        if (btn.dataset.tab === 'movementsTab') loadMovements();
        if (btn.dataset.tab === 'damagedTab') loadDamagedStock();
    });
});

// ---------- Tab 1: Current Stock ----------



async function loadCurrentStock() {
    const container = document.getElementById('stockCardsContainer');
    container.innerHTML = `<div class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading stock...</div>`;

    try {
        const warehouseStocks = await getCurrentStockByWarehouse();

        if (!warehouseStocks.length) {
            container.innerHTML = `<div class="table-empty"><i class="fa-solid fa-warehouse"></i><div>No warehouses found. Add a warehouse first.</div></div>`;
            return;
        }

        // Fetch current avg cost/maund for every warehouse+variety combo that has stock
        for (const w of warehouseStocks) {
            await Promise.all(w.varieties.map(async (v) => {
                try {
                    v.avg_cost = await getAverageCostPerMaund(w.warehouse_id, v.variety_id);
                } catch (e) {
                    v.avg_cost = 0;
                }
            }));
        }

        container.innerHTML = `<div class="inventory-summary-cards">` +
            warehouseStocks.map(w => `
                <div class="stock-card">
                    <div class="stock-card-warehouse">${w.warehouse_name}</div>
                    <div class="stock-card-total">${fmt(w.total_maund)} Md</div>
                    <div class="stock-card-sub">Total stock</div>
                    ${w.varieties.length ? `
                        <div class="variety-breakdown">
                            ${w.varieties.map(v => `
                                <div class="variety-row">
                                    <span>${v.variety_name}</span>
                                    <span style="text-align:right;">
                                        <strong>${fmt(v.maund)} Md</strong>
                                        <div style="font-size:11px; color:var(--text-secondary); font-weight:500;">৳${fmt(v.avg_cost)}/Md</div>
                                    </span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `<div class="variety-breakdown" style="color:var(--text-secondary); font-size:12px;">No stock yet</div>`}
                </div>
            `).join('') + `</div>`;
    } catch (err) {
        showToast('Failed to load stock: ' + err.message, 'error');
        container.innerHTML = `<div class="table-empty">Could not load stock data.</div>`;
    }
}




// ---------- Tab 2: Stock Movements ----------
function formatMovementType(type) {
    const map = {
        purchase_in: 'Purchase In', sale_out: 'Sale Out', transfer_in: 'Transfer In',
        transfer_out: 'Transfer Out', damage: 'Damage', adjustment: 'Adjustment'
    };
    return map[type] || type;
}

function movementBadgeClass(type) {
    if (type === 'purchase_in' || type === 'transfer_in') return 'movement-in';
    if (type === 'sale_out' || type === 'transfer_out' || type === 'damage') return 'movement-out';
    return 'movement-neutral';
}

async function loadMovements() {
    const tableBody = document.getElementById('movementsTableBody');
    tableBody.innerHTML = `<tr><td colspan="5" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
        const movements = await getStockMovements();

        if (!movements.length) {
            tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">No stock movements yet.</td></tr>`;
            return;
        }

        tableBody.innerHTML = movements.map(m => `
            <tr>
                <td>${new Date(m.created_at).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
                <td><span class="movement-type-badge ${movementBadgeClass(m.movement_type)}">${formatMovementType(m.movement_type)}</span></td>
                <td>${m.warehouses?.name || '-'}</td>
                <td>${m.paddy_varieties?.name || '-'}</td>
                <td style="color:${Number(m.weight_kg) < 0 ? 'var(--color-danger)' : 'var(--color-accent)'}; font-weight:700;">
                    ${Number(m.weight_kg) > 0 ? '+' : ''}${fmt(m.weight_kg)} KG
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Failed to load movements: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="5" class="table-empty">Could not load data.</td></tr>`;
    }
}





// ---------- Tab 3: Damaged Stock ----------
async function loadDamagedStock() {
    const tableBody = document.getElementById('damagedTableBody');
    tableBody.innerHTML = `<tr><td colspan="7" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
        allDamagedRecords = await getDamagedStock();

        if (!allDamagedRecords.length) {
            tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">No damaged stock recorded.</td></tr>`;
            return;
        }

        tableBody.innerHTML = allDamagedRecords.map(d => `
            <tr>
                <td>${new Date(d.damage_date).toLocaleDateString('en-GB')}</td>
                <td>${d.warehouses?.name || '-'}</td>
                <td>${d.paddy_varieties?.name || '-'}</td>
                <td>${fmt(d.weight_kg)} KG</td>
                <td>৳${fmt(d.estimated_loss)}</td>
                <td>${d.reason || '-'}</td>
                <td>
                    <div class="action-btns">
                        <button class="icon-btn delete delete-damage-btn" data-id="${d.id}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        document.querySelectorAll('.delete-damage-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteDamage(btn.dataset.id));
        });
    } catch (err) {
        showToast('Failed to load damaged stock: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="7" class="table-empty">Could not load data.</td></tr>`;
    }
}

async function handleDeleteDamage(damageId) {
    const record = allDamagedRecords.find(d => d.id === damageId);
    if (!record) return;

    if (!confirm(`Delete this damage record (${fmt(record.weight_kg)} KG)? This will restore the stock.`)) return;

    try {
        await deleteDamagedStock(
            record.id,
            record.warehouse_id,
            record.paddy_variety_id,
            Number(record.weight_kg),
            record.damage_date
        );
        showToast('Damage record deleted and stock restored.');
        loadDamagedStock();
        loadCurrentStock();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// ---------- Damaged Stock Modal ----------
const damageModal = document.getElementById('damageModal');
const damageForm = document.getElementById('damageForm');

async function loadDamageDropdowns() {
    const [warehouses, varieties] = await Promise.all([
        getWarehousesForDropdown(),
        getPaddyVarietiesForDropdown()
    ]);

    document.getElementById('damageWarehouse').innerHTML = '<option value="">Select warehouse</option>' +
        warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    document.getElementById('damageVariety').innerHTML = '<option value="">Select variety</option>' +
        varieties.map(v => `<option value="${v.id}">${v.name}</option>`).join('');
}

document.getElementById('addDamageBtn').addEventListener('click', () => {
    damageForm.reset();
    document.getElementById('damageDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('damageStockInfoBox').style.display = 'none';
    document.getElementById('damageWeightWarning').style.display = 'none';
    currentDamageAvailableStock = 0;
    damageModal.classList.add('open');
});

document.getElementById('damageModalClose').addEventListener('click', () => damageModal.classList.remove('open'));
document.getElementById('damageCancelBtn').addEventListener('click', () => damageModal.classList.remove('open'));
damageModal.addEventListener('click', (e) => { if (e.target === damageModal) damageModal.classList.remove('open'); });

async function refreshDamageStockInfo() {
    const warehouseId = document.getElementById('damageWarehouse').value;
    const varietyId = document.getElementById('damageVariety').value;
    const infoBox = document.getElementById('damageStockInfoBox');

    if (!warehouseId || !varietyId) {
        infoBox.style.display = 'none';
        currentDamageAvailableStock = 0;
        return;
    }

    infoBox.style.display = 'block';
    infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking stock...`;

    try {
        const stock = await getStockForWarehouseVariety(warehouseId, varietyId);
        currentDamageAvailableStock = Number(stock.current_weight_kg || 0);

        const color = currentDamageAvailableStock <= 0 ? 'var(--color-danger)' : 'var(--text-primary)';
        infoBox.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> Available in warehouse: <strong style="color:${color};">${fmt(currentDamageAvailableStock)} KG</strong>`;

        validateDamageWeight();
    } catch (err) {
        infoBox.innerHTML = 'Could not check stock.';
    }
}

function validateDamageWeight() {
    const weight = parseFloat(document.getElementById('damageWeight').value) || 0;
    const warningBox = document.getElementById('damageWeightWarning');

    if (weight > currentDamageAvailableStock) {
        warningBox.style.display = 'block';
        warningBox.textContent = `Cannot record ${fmt(weight)} KG damage — only ${fmt(currentDamageAvailableStock)} KG available in this warehouse for this variety.`;
    } else {
        warningBox.style.display = 'none';
    }
}

document.getElementById('damageWarehouse').addEventListener('change', refreshDamageStockInfo);
document.getElementById('damageVariety').addEventListener('change', refreshDamageStockInfo);
document.getElementById('damageWeight').addEventListener('input', validateDamageWeight);

damageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const damageData = {
        warehouse_id: document.getElementById('damageWarehouse').value,
        paddy_variety_id: document.getElementById('damageVariety').value,
        weight_kg: parseFloat(document.getElementById('damageWeight').value) || 0,
        damage_date: document.getElementById('damageDate').value,
        estimated_loss: parseFloat(document.getElementById('damageLoss').value) || 0,
        reason: document.getElementById('damageReason').value.trim(),
    };

    if (!damageData.warehouse_id || !damageData.paddy_variety_id || damageData.weight_kg <= 0) {
        showToast('Please fill Warehouse, Variety, and Weight.', 'error');
        return;
    }

    if (damageData.weight_kg > currentDamageAvailableStock) {
        showToast(`Cannot record damage: only ${fmt(currentDamageAvailableStock)} KG available in stock for this warehouse/variety.`, 'error');
        return;
    }

    const submitBtn = document.getElementById('damageSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        const profile = getCurrentProfile();
        await createDamagedStock(damageData, profile?.id);
        showToast('Damaged stock recorded successfully.');
        damageModal.classList.remove('open');
        loadDamagedStock();
        loadCurrentStock();
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Record';
    }
});

// ---------- Init ----------
await loadDamageDropdowns();
loadCurrentStock();
                             
