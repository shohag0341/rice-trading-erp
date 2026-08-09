import { loginUser, getCurrentSession, sendPasswordReset } from './services/auth-service.js';

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const loginBtnText = document.getElementById('loginBtnText');
const errorText = document.getElementById('errorText');
const forgotPasswordLink = document.getElementById('forgotPasswordLink');

// Forgot Password modal elements
const fpModalOverlay = document.getElementById('fpModalOverlay');
const fpModalClose = document.getElementById('fpModalClose');
const fpForm = document.getElementById('fpForm');
const fpEmail = document.getElementById('fpEmail');
const fpErrorText = document.getElementById('fpErrorText');
const fpSendBtn = document.getElementById('fpSendBtn');
const fpSendBtnText = document.getElementById('fpSendBtnText');

// If already logged in, redirect straight to dashboard
(async function checkExistingSession() {
    const session = await getCurrentSession();
    if (session) {
        window.location.href = 'dashboard.html';
    }
})();

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-circle-exclamation' : 'fa-triangle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function setLoading(isLoading) {
    loginBtn.disabled = isLoading;
    loginBtnText.innerHTML = isLoading
        ? '<span class="spinner"></span> Signing in...'
        : 'Sign In';
}

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorText.style.display = 'none';

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        errorText.textContent = 'Please fill in both fields.';
        errorText.style.display = 'block';
        return;
    }

    setLoading(true);

    try {
        await loginUser(email, password);
        showToast('Login successful! Redirecting...', 'success');
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 800);
    } catch (err) {
        setLoading(false);
        errorText.textContent = err.message || 'Invalid email or password.';
        errorText.style.display = 'block';
        showToast('Login failed. Please check your credentials.', 'error');
    }
});

// ---------- Forgot Password modal ----------
function openForgotPasswordModal() {
    fpForm.reset();
    fpErrorText.style.display = 'none';

    // Pre-fill with whatever email they'd already typed on the login form
    const typedEmail = document.getElementById('email').value.trim();
    if (typedEmail) fpEmail.value = typedEmail;

    fpModalOverlay.classList.add('open');
}

function closeForgotPasswordModal() {
    fpModalOverlay.classList.remove('open');
}

forgotPasswordLink.addEventListener('click', openForgotPasswordModal);
fpModalClose.addEventListener('click', closeForgotPasswordModal);
fpModalOverlay.addEventListener('click', (e) => {
    if (e.target === fpModalOverlay) closeForgotPasswordModal();
});

fpForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    fpErrorText.style.display = 'none';

    const email = fpEmail.value.trim();
    if (!email) {
        fpErrorText.textContent = 'Please enter your email.';
        fpErrorText.style.display = 'block';
        return;
    }

    fpSendBtn.disabled = true;
    fpSendBtnText.innerHTML = '<span class="spinner"></span> Sending...';

    try {
        await sendPasswordReset(email);
        showToast('Password reset email sent! Check your inbox.', 'success');
        closeForgotPasswordModal();
    } catch (err) {
        fpErrorText.textContent = err.message || 'Could not send reset email.';
        fpErrorText.style.display = 'block';
    } finally {
        fpSendBtn.disabled = false;
        fpSendBtnText.textContent = 'Send Reset Link';
    }
});
