// Shared styled confirmation modal — replaces the browser's native confirm() popup.
// Injects its markup into <body> once (reuses the .modal-overlay / .modal-box / .modal-header /
// .modal-body / .modal-footer classes already loaded via css/farmers.css on every page, so no
// HTML or CSS changes are needed on any page to use this).
//
// Usage:
//   import { confirmAction } from './components/confirm-modal.js';
//   const ok = await confirmAction({
//       title: 'Delete Farmer?',
//       message: 'Delete farmer "Karim"? This cannot be undone.',
//       confirmText: 'Delete'
//   });
//   if (!ok) return;

let modalEl = null;
let resolvePromise = null;

function ensureModal() {
    if (modalEl) return;

    modalEl = document.createElement('div');
    modalEl.className = 'modal-overlay';
    modalEl.id = 'globalConfirmModal';
    modalEl.innerHTML = `
        <div class="modal-box" style="max-width:360px;">
            <div class="modal-header">
                <h3 id="globalConfirmTitle">Confirm</h3>
                <button type="button" class="modal-close" id="globalConfirmCloseBtn"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div class="modal-body">
                <p id="globalConfirmMessage" style="font-size:14px; color:var(--text-primary); line-height:1.5;"></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn-secondary" id="globalConfirmCancelBtn">Cancel</button>
                <button type="button" id="globalConfirmYesBtn" style="border:none; padding:10px 18px; border-radius:var(--radius-sm); font-weight:600; cursor:pointer; color:#fff;">Confirm</button>
            </div>
        </div>
    `;
    document.body.appendChild(modalEl);

    const close = (result) => {
        modalEl.classList.remove('open');
        if (resolvePromise) {
            resolvePromise(result);
            resolvePromise = null;
        }
    };

    modalEl.querySelector('#globalConfirmCloseBtn').addEventListener('click', () => close(false));
    modalEl.querySelector('#globalConfirmCancelBtn').addEventListener('click', () => close(false));
    modalEl.querySelector('#globalConfirmYesBtn').addEventListener('click', () => close(true));
    modalEl.addEventListener('click', (e) => { if (e.target === modalEl) close(false); });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modalEl.classList.contains('open')) close(false);
    });
}

/**
 * Shows a styled confirmation modal in place of confirm().
 * @param {Object} options
 * @param {string} [options.title='Are you sure?']
 * @param {string} [options.message='']
 * @param {string} [options.confirmText='Confirm']
 * @param {boolean} [options.danger=true] - red confirm button (delete-style) vs blue (neutral action)
 * @returns {Promise<boolean>} resolves true if confirmed, false if cancelled/closed
 */
export function confirmAction(options = {}) {
    ensureModal();

    const {
        title = 'Are you sure?',
        message = '',
        confirmText = 'Confirm',
        danger = true
    } = options;

    modalEl.querySelector('#globalConfirmTitle').textContent = title;
    modalEl.querySelector('#globalConfirmMessage').textContent = message;

    const yesBtn = modalEl.querySelector('#globalConfirmYesBtn');
    yesBtn.textContent = confirmText;
    yesBtn.style.background = danger ? 'var(--color-danger)' : 'var(--color-primary)';

    modalEl.classList.add('open');

    return new Promise((resolve) => {
        resolvePromise = resolve;
    });
}
