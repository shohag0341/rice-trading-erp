import { initLayout, getCurrentProfile } from './layout.js';
import { updateOwnProfile, uploadAvatar } from './services/profile-service.js';
import { getCurrentSession } from './services/auth-service.js';

const profile = await initLayout('myprofile');
const session = await getCurrentSession();

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const icon = type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation';
    toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
}

function renderProfileHeader(p) {
    const initials = (p?.full_name || 'U').split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    const avatarHtml = p?.photo_url
        ? `<img src="${p.photo_url}" class="profile-avatar-lg" style="object-fit:cover;">`
        : `<div class="profile-avatar-lg">${initials}</div>`;

    document.getElementById('myProfileHeader').innerHTML = `
        <div class="avatar-upload-wrapper" id="avatarUploadWrapper" style="position:relative; cursor:pointer;">
            ${avatarHtml}
            <div class="avatar-edit-btn"><i class="fa-solid fa-camera"></i></div>
        </div>
        <div class="profile-info">
            <div class="profile-name">${p?.full_name || 'User'}</div>
            <div class="profile-meta">
                <span><i class="fa-solid fa-shield"></i> ${p?.role || '-'}</span>
                ${p?.phone ? `<span><i class="fa-solid fa-phone"></i> ${p.phone}</span>` : ''}
                <span><i class="fa-solid fa-envelope"></i> ${session?.user?.email || '-'}</span>
            </div>
        </div>
    `;

    document.getElementById('avatarUploadWrapper').addEventListener('click', () => {
        document.getElementById('avatarFileInput').click();
    });
}

function fillForm(p) {
    document.getElementById('myProfileFullName').value = p?.full_name || '';
    document.getElementById('myProfilePhone').value = p?.phone || '';
    document.getElementById('myProfileEmail').value = session?.user?.email || '';
    document.getElementById('myProfileRole').value = p?.role || '';
}

renderProfileHeader(profile);
fillForm(profile);

// ---------- Avatar upload ----------
document.getElementById('avatarFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
        showToast('Image must be under 3MB.', 'error');
        return;
    }

    try {
        showToast('Uploading photo...');
        const updated = await uploadAvatar(profile.id, file);
        renderProfileHeader(updated);
        showToast('Profile photo updated.');
    } catch (err) {
        showToast('Upload failed: ' + err.message, 'error');
    }
});

// ---------- Save name/phone ----------
document.getElementById('myProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const fullName = document.getElementById('myProfileFullName').value.trim();
    const phone = document.getElementById('myProfilePhone').value.trim();

    if (!fullName) {
        showToast('Name is required.', 'error');
        return;
    }

    const submitBtn = document.getElementById('myProfileSaveBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner"></span> Saving...';

    try {
        await updateOwnProfile(profile.id, { full_name: fullName, phone: phone });
        showToast('Profile updated successfully.');
        setTimeout(() => location.reload(), 700);
    } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Save Changes';
    }
});
