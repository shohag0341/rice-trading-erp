import { supabase } from './services/supabase-client.js';
import { updatePassword } from './services/auth-service.js';

const checkingState = document.getElementById('checkingState');
const invalidState = document.getElementById('invalidState');
const resetForm = document.getElementById('resetForm');
const pageSubtitle = document.getElementById('pageSubtitle');
const errorText = document.getElementById('errorText');
const resetBtn = document.getElementById('resetBtn');
const resetBtnText = document.getElementById('resetBtnText');

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function showForm() {
    checkingState.style.display = 'none';
    invalidState.style.display = 'none';
    resetForm.style.display = 'block';
}

function showInvalid() {
    checkingState.style.display = 'none';
    resetForm.style.display = 'none';
    pageSubtitle.textContent = 'Link problem';
    invalidState.style.display = 'block';
}

// Supabase's JS SDK reads the recovery token out of the URL on page load and,
// if valid, fires a PASSWORD_RECOVERY auth event with a live session — that's
// our signal the link is legitimate and the form can be shown.
supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'PASSWORD_RECOVERY' && session) {
        showForm();
    }
});

// Fallback: if no PASSWORD_RECOVERY event has fired shortly after load
// (bad/expired link, or link already used), show the invalid-link state.
setTimeout(async () => {
    if (resetForm.style.display === 'block') return; // already shown, do nothing

    const { data } = await supabase.auth.getSession();
    if (data.session) {
        showForm();
    } else {
        showInvalid();
    }
}, 2500);

resetForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorText.style.display = 'none';

    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    if (newPassword.length < 6) {
        errorText.textContent = 'Password must be at least 6 characters.';
        errorText.style.display = 'block';
        return;
    }
    if (newPassword !== confirmPassword) {
        errorText.textContent = 'Passwords do not match.';
        errorText.style.display = 'block';
        return;
    }

    resetBtn.disabled = true;
    resetBtnText.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        await updatePassword(newPassword);
        showToast('Password updated successfully! Please sign in.', 'success');

        // Sign out of the temporary recovery session so they log in fresh
        // with the new password, then send them to the login page.
        await supabase.auth.signOut();
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1200);
    } catch (err) {
        resetBtn.disabled = false;
        resetBtnText.textContent = 'Set New Password';
        errorText.textContent = err.message || 'Could not update password.';
        errorText.style.display = 'block';
        showToast('Failed to update password.', 'error');
    }
});
