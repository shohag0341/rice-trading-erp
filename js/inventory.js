import { initLayout, getCurrentProfile } from './layout.js';
import { getAverageCostPerMaund } from './services/sale-service.js';
import {
    getCurrentStockByWarehouse, getStockMovements, getDamagedStock, createDamagedStock,
    getStockForWarehouseVariety, deleteDamagedStock, updateDamagedStockReference
} from './services/inventory-service.js';
import { getWarehousesForDropdown, getPaddyVarietiesForDropdown } from './services/purchase-service.js';
import { makeSearchable } from './components/searchable-select.js';
import { formatDate, formatDateTime } from './utils/date-format.js';
import { getBusinessSettings } from './services/settings-service.js';

let KG_PER_MAUND = 40; // fallback until Business Settings loads

let damageWarehouseWidget, damageVarietyWidget;




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
                    v.avg_cost = await getAverageCostPerMaund(w.warehouse_id, v.variety_id, KG_PER_MAUND);
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
        transfer_out: 'Transfer Out', damage: 'Loss', adjustment: 'Gain'
    };
    return map[type] || type;
}

function movementBadgeClass(type) {
    if (type === 'purchase_in' || type === 'transfer_in' || type === 'adjustment') return 'movement-in';
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
                <td>${formatDateTime(m.created_at)}</td>
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

// ---------- Tab 3: Stock Adjustments (Loss / Gain) ----------
async function loadDamagedStock() {
    const tableBody = document.getElementById('damagedTableBody');
    tableBody.innerHTML = `<tr><td colspan="9" class="table-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading...</td></tr>`;

    try {
        allDamagedRecords = await getDamagedStock();

        if (!allDamagedRecords.length) {
            tableBody.innerHTML = `<tr><td colspan="9" class="table-empty">No stock adjustments recorded.</td></tr>`;
            return;
        }

        tableBody.innerHTML = allDamagedRecords.map(d => {
            const isGain = d.adjustment_type === 'gain';
            const showReference = isGain && d.reference_value !== null && d.reference_value !== undefined;
            return `
            <tr>
                <td>${formatDate(d.damage_date)}</td>
                <td><span class="badge ${isGain ? 'badge-success' : 'badge-danger'}">${isGain ? 'Gain' : 'Loss'}</span></td>
                <td>${d.warehouses?.name || '-'}</td>
                <td>${d.paddy_varieties?.name || '-'}</td>
                <td>${fmt(d.weight_kg)} KG</td>
                <td>৳${fmt(d.estimated_loss)}</td>
                <td>${showReference ? '৳' + fmt(d.reference_value) : '-'}</td>
                <td>${d.reason || '-'}</td>
                <td>
                    <div class="action-btns">
                        ${isGain ? `
                        <button class="icon-btn edit-ref-btn" data-id="${d.id}" title="Edit Reference Value">
                            <i class="fa-solid fa-pen"></i>
                        </button>` : ''}
                        <button class="icon-btn delete delete-damage-btn" data-id="${d.id}" title="Delete">
                            <i class="fa-solid fa-trash"></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        document.querySelectorAll('.delete-damage-btn').forEach(btn => {
            btn.addEventListener('click', () => handleDeleteDamage(btn.dataset.id));
        });

        document.querySelectorAll('.edit-ref-btn').forEach(btn => {
            btn.addEventListener('click', () => openEditRefModal(btn.dataset.id));
        });
    } catch (err) {
        showToast('Failed to load stock adjustments: ' + err.message, 'error');
        tableBody.innerHTML = `<tr><td colspan="9" class="table-empty">Could not load data.</td></tr>`;
    }
}




function confirmDelete(message) {
    return new Promise((resolve) => {
        const modal = document.getElementById('deleteConfirmModal');
        document.getElementById('deleteConfirmMessage').textContent = message;
        modal.classList.add('open');

        const yesBtn = document.getElementById('deleteConfirmYesBtn');
        const cancelBtn = document.getElementById('deleteConfirmCancelBtn');
        const closeBtn = document.getElementById('deleteConfirmClose');

        function cleanup(result) {
            modal.classList.remove('open');
            yesBtn.removeEventListener('click', onYes);
            cancelBtn.removeEventListener('click', onCancel);
            closeBtn.removeEventListener('click', onCancel);
            resolve(result);
        }
        function onYes() { cleanup(true); }
        function onCancel() { cleanup(false); }

        yesBtn.addEventListener('click', onYes);
        cancelBtn.addEventListener('click', onCancel);
        closeBtn.addEventListener('click', onCancel);
    });
}

async function handleDeleteDamage(damageId) {
    const record = allDamagedRecords.find(d => d.id === damageId);
    if (!record) return;

    const isGain = record.adjustment_type === 'gain';

    // Safety check: only needed for Gain records. Deleting a Gain reverses
    // it (subtracts stock) - if that paddy has already been sold or used
    // elsewhere, this would push the warehouse's stock negative. Loss
    // deletions always ADD stock back, so they never need this check.
    if (isGain) {
        try {
            const stock = await getStockForWarehouseVariety(record.warehouse_id, record.paddy_variety_id);
            const stockAfterDelete = Number(stock.current_weight_kg) - Number(record.weight_kg);

            if (stockAfterDelete < -0.01) {
                showToast(
                    `Cannot delete: this paddy has already been sold or used elsewhere. Current stock for this warehouse/variety is only ${fmt(stock.current_weight_kg)} KG, not enough to remove this gain of ${fmt(record.weight_kg)} KG.`,
                    'error'
                );
                return;
            }
        } catch (err) {
            showToast('Could not verify stock before delete: ' + err.message, 'error');
            return;
        }
    }

    const confirmed = await confirmDelete(`Delete this ${isGain ? 'gain' : 'loss'} record (${fmt(record.weight_kg)} KG)? This will reverse the stock change.`);
    if (!confirmed) return;

    try {
        await deleteDamagedStock(
            record.id,
            record.warehouse_id,
            record.paddy_variety_id,
            Number(record.weight_kg),
            record.adjustment_type
        );
        showToast('Adjustment record deleted and stock reversed.');
        loadDamagedStock();
        loadCurrentStock();
    } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
    }
}

// ---------- Edit Reference Value Modal (Gain only) ----------
const editRefModal = document.getElementById('editRefModal');
const editRefForm = document.getElementById('editRefForm');
let currentEditRefRecord = null;

function updateEditRefTotalValue() {
    if (!currentEditRefRecord) return;
    const pricePerMaund = parseFloat(document.getElementById('editRefPricePerMaund').value) || 0;
    const total = (Number(currentEditRefRecord.weight_kg) / KG_PER_MAUND) * pricePerMaund;
    document.getElementById('editRefTotalValue').textContent = `৳${fmt(total)}`;
}

function openEditRefModal(damageId) {
    const record = allDamagedRecords.find(d => d.id === damageId);
    if (!record) return;

    currentEditRefRecord = record;
    document.getElementById('editRefContext').textContent =
        `${record.warehouses?.name || '-'} - ${record.paddy_varieties?.name || '-'} - ${fmt(record.weight_kg)} KG (${formatDate(record.damage_date)})`;
    document.getElementById('editRefPricePerMaund').value = record.reference_price_per_maund || '';
    updateEditRefTotalValue();
    editRefModal.classList.add('open');
}

document.getElementById('editRefPricePerMaund').addEventListener('input', updateEditRefTotalValue);
document.getElementById('editRefModalClose').addEventListener('click', () => editRefModal.classList.remove('open'));
document.getElementById('editRefCancelBtn').addEventListener('click', () => editRefModal.classList.remove('open'));
editRefModal.addEventListener('click', (e) => { if (e.target === editRefModal) editRefModal.classList.remove('open'); });

editRefForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentEditRefRecord) return;

    const pricePerMaund = parseFloat(document.getElementById('editRefPricePerMaund').value) || 0;
    const referenceValue = pricePerMaund > 0 ? (Number(currentEditRefRecord.weight_kg) / KG_PER_MAUND) * pricePerMaund : null;

    const submitBtn = document.getElementById('editRefSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';

    try {
        await updateDamagedStockReference(
            currentEditRefRecord.id,
            pricePerMaund > 0 ? pricePerMaund : null,
            referenceValue
        );
        showToast('Reference value updated.');
        editRefModal.classList.remove('open');
        loadDamagedStock();
    } catch (err) {
        showToast('Update failed: ' + err.message, 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Save';
    }
});

// ---------- Stock Adjustment Modal ----------
const damageModal = document.getElementById('damageModal');
const damageForm = document.getElementById('damageForm');

function getSelectedAdjustmentType() {
    return document.querySelector('input[name="adjustmentType"]:checked')?.value || 'loss';
}




async function loadDamageDropdowns() {
    const [warehouses, varieties] = await Promise.all([
        getWarehousesForDropdown(),
        getPaddyVarietiesForDropdown()
    ]);

    document.getElementById('damageWarehouse').innerHTML = '<option value="">Select warehouse</option>' +
        warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    document.getElementById('damageVariety').innerHTML = '<option value="">Select variety</option>' +
        varieties.map(v => `<option value="${v.id}">${v.name}</option>`).join('');

    if (!damageWarehouseWidget) {
        damageWarehouseWidget = makeSearchable('damageWarehouse', { placeholder: 'Search warehouse...' });
        damageVarietyWidget = makeSearchable('damageVariety', { placeholder: 'Search variety...' });
    } else {
        damageWarehouseWidget.refresh();
        damageVarietyWidget.refresh();
    }
}





document.getElementById('addDamageBtn').addEventListener('click', () => {
    damageForm.reset();
    document.querySelector('input[name="adjustmentType"][value="loss"]').checked = true;
    document.getElementById('damageDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('damageStockInfoBox').style.display = 'none';
    document.getElementById('damageWeightWarning').style.display = 'none';
    document.getElementById('gainRefPricePerMaund').value = '';
    document.getElementById('gainRefTotalValue').textContent = '৳0';
    currentDamageAvailableStock = 0;
    damageWarehouseWidget?.refresh();
    damageVarietyWidget?.refresh();
    updateEstimatedValueHint();
    damageModal.classList.add('open');
});




document.getElementById('damageModalClose').addEventListener('click', () => damageModal.classList.remove('open'));
document.getElementById('damageCancelBtn').addEventListener('click', () => damageModal.classList.remove('open'));
damageModal.addEventListener('click', (e) => { if (e.target === damageModal) damageModal.classList.remove('open'); });

function updateEstimatedValueHint() {
    const isGain = getSelectedAdjustmentType() === 'gain';
    const hintBox = document.getElementById('estimatedValueHint');
    document.getElementById('referencePriceGroup').style.display = isGain ? 'block' : 'none';

    if (isGain) {
        hintBox.innerHTML = `<i class="fa-solid fa-circle-info"></i> এই মান এখনই Profit & Loss-এ আয় হিসেবে যোগ হবে, এবং পরে এই ধান বিক্রি করলে সেই বিক্রির খরচ (COGS) হিসেবেও একই মান ধরা হবে — অর্থাৎ সামগ্রিক লাভে দুইবার যোগ হয় না। <strong>ধান সত্যিই বিনামূল্যে (ফ্রি) পাওয়া হলে এখানে ৳০ বসান</strong> — তাহলে এখন কিছু যোগ হবে না, বরং যেদিন বিক্রি হবে সেদিন সেই Sale-এর নিজের Profit-এ এই লাভটা দেখা যাবে।`;
    } else {
        hintBox.innerHTML = `<i class="fa-solid fa-circle-info"></i> এই মান এখনই Profit & Loss-এ খরচ (Loss) হিসেবে বিয়োগ হবে।`;
    }
}

function updateGainRefTotalValue() {
    const weightKg = parseFloat(document.getElementById('damageWeight').value) || 0;
    const pricePerMaund = parseFloat(document.getElementById('gainRefPricePerMaund').value) || 0;
    const total = (weightKg / KG_PER_MAUND) * pricePerMaund;
    document.getElementById('gainRefTotalValue').textContent = `৳${fmt(total)}`;
}

document.getElementById('gainRefPricePerMaund').addEventListener('input', updateGainRefTotalValue);
document.getElementById('damageWeight').addEventListener('input', updateGainRefTotalValue);

document.querySelectorAll('input[name="adjustmentType"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.getElementById('damageWeightWarning').style.display = 'none';
        refreshDamageStockInfo();
        updateEstimatedValueHint();
    });
});





let currentDamageAvgCost = 0;

async function refreshDamageStockInfo() {
    const warehouseId = document.getElementById('damageWarehouse').value;
    const varietyId = document.getElementById('damageVariety').value;
    const infoBox = document.getElementById('damageStockInfoBox');
    const isGain = getSelectedAdjustmentType() === 'gain';

    if (!warehouseId || !varietyId) {
        infoBox.style.display = 'none';
        currentDamageAvailableStock = 0;
        currentDamageAvgCost = 0;
        return;
    }

    infoBox.style.display = 'block';
    infoBox.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Checking stock...`;

    try {
        const stock = await getStockForWarehouseVariety(warehouseId, varietyId);
        currentDamageAvailableStock = Number(stock.current_weight_kg || 0);
        currentDamageAvgCost = await getAverageCostPerMaund(warehouseId, varietyId, KG_PER_MAUND);

        const color = (!isGain && currentDamageAvailableStock <= 0) ? 'var(--color-danger)' : 'var(--text-primary)';
        infoBox.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i> Available in warehouse: <strong style="color:${color};">${fmt(currentDamageAvailableStock)} KG</strong> &nbsp;|&nbsp; Avg cost: <strong>৳${fmt(currentDamageAvgCost)}/Md</strong>`;

        validateDamageWeight();
        autoFillEstimatedValue();
    } catch (err) {
        infoBox.innerHTML = 'Could not check stock.';
    }
}

function autoFillEstimatedValue() {
    const weightKg = parseFloat(document.getElementById('damageWeight').value) || 0;
    if (weightKg <= 0 || currentDamageAvgCost <= 0) return;

    const estimatedValue = (weightKg / KG_PER_MAUND) * currentDamageAvgCost;
    document.getElementById('damageLoss').value = estimatedValue.toFixed(2);
}





function validateDamageWeight() {
    const isGain = getSelectedAdjustmentType() === 'gain';
    const warningBox = document.getElementById('damageWeightWarning');

    if (isGain) {
        warningBox.style.display = 'none';
        return;
    }

    const weight = parseFloat(document.getElementById('damageWeight').value) || 0;

    if (weight > currentDamageAvailableStock) {
        warningBox.style.display = 'block';
        warningBox.textContent = `Cannot record ${fmt(weight)} KG loss — only ${fmt(currentDamageAvailableStock)} KG available in this warehouse for this variety.`;
    } else {
        warningBox.style.display = 'none';
    }
}

document.getElementById('damageWarehouse').addEventListener('change', refreshDamageStockInfo);
document.getElementById('damageVariety').addEventListener('change', refreshDamageStockInfo);



document.getElementById('damageWeight').addEventListener('input', () => {
    validateDamageWeight();
    autoFillEstimatedValue();
});

damageForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const adjustmentType = getSelectedAdjustmentType();
    const isGain = adjustmentType === 'gain';

    const gainRefPricePerMaund = parseFloat(document.getElementById('gainRefPricePerMaund').value) || 0;
    const weightKg = parseFloat(document.getElementById('damageWeight').value) || 0;

    const damageData = {
        adjustment_type: adjustmentType,
        warehouse_id: document.getElementById('damageWarehouse').value,
        paddy_variety_id: document.getElementById('damageVariety').value,
        weight_kg: weightKg,
        damage_date: document.getElementById('damageDate').value,
        estimated_loss: parseFloat(document.getElementById('damageLoss').value) || 0,
        reason: document.getElementById('damageReason').value.trim(),
        // Memo only - manually entered, not system-calculated. Never used in any
        // cost/profit calculation - purely a reference figure so a ৳0 Gain's
        // approximate value (entered by you) isn't lost from view entirely.
        reference_price_per_maund: isGain && gainRefPricePerMaund > 0 ? gainRefPricePerMaund : null,
        reference_value: isGain && gainRefPricePerMaund > 0 ? (weightKg / KG_PER_MAUND) * gainRefPricePerMaund : null,
    };

    if (!damageData.warehouse_id || !damageData.paddy_variety_id || damageData.weight_kg <= 0) {
        showToast('Please fill Warehouse, Variety, and Weight.', 'error');
        return;
    }

    if (!isGain && damageData.weight_kg > currentDamageAvailableStock) {
        showToast(`Cannot record loss: only ${fmt(currentDamageAvailableStock)} KG available in stock for this warehouse/variety.`, 'error');
        return;
    }

    const submitBtn = document.getElementById('damageSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        const profile = getCurrentProfile();
        await createDamagedStock(damageData, profile?.id);
        showToast(`Stock ${isGain ? 'gain' : 'loss'} recorded successfully.`);
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
try {
    const business = await getBusinessSettings();
    if (business?.kg_per_maund) KG_PER_MAUND = Number(business.kg_per_maund);
} catch (err) {
    // Keep the fallback of 40 if settings can't be loaded for some reason
}

await loadDamageDropdowns();
loadCurrentStock();
                     
