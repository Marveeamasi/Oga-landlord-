import { uploadToCloudinary } from './cloudinary.js';
import { auth, db, updateDoc, collection, query, where, onSnapshot, doc, getDocs, updateEmail, updatePassword, onAuthStateChanged } from './firebase.js';

let currentUser = null;
let userDocId = null;
let viewedUser = null;
let isEditing = false;

const showLoading = (id) => document.getElementById(id).classList.remove('d-none');
const hideLoading = (id) => document.getElementById(id).classList.add('d-none');
const showError = (message) => {
    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = message;
    errorDiv.classList.remove('d-none');
    setTimeout(() => errorDiv.classList.add('d-none'), 5000);
};
const showSuccess = (message) => {
    const successDiv = document.getElementById('successMessage');
    successDiv.textContent = message;
    successDiv.classList.remove('d-none');
    setTimeout(() => successDiv.classList.add('d-none'), 5000);
};

// Apply saved theme from localStorage
function applySavedTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

onAuthStateChanged(auth, async (user) => {
    showLoading('loadingSpinner');
    currentUser = user;
    const urlParams = new URLSearchParams(window.location.search);
    const userId = urlParams.get('id') || user?.uid;

    if (!userId) {
        showError('No user specified');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    try {
        viewedUser = await getUserData(userId);
        if (!viewedUser) {
            showError('User not found');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        userDocId = viewedUser.docId;
        applySavedTheme();
        displayUserProfile(viewedUser);
        if (userId === user?.uid) {
            document.getElementById('editProfileBtn').style.display = 'block';
        }
        loadUserProperties(userId);
    } catch (err) {
        showError('Error loading profile: ' + err.message);
    } finally {
        hideLoading('loadingSpinner');
    }
});

// Get user data
async function getUserData(uid) {
    try {
        const q = query(collection(db, 'users'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        if (snapshot.docs.length) {
            return { docId: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }
        return null;
    } catch (err) {
        throw new Error('Failed to fetch user data: ' + err.message);
    }
}

// Display user profile
function displayUserProfile(userData) {
    document.getElementById('nameDisplay').textContent = userData.name || 'Not provided';
    document.getElementById('emailDisplay').textContent = userData.email || 'Not provided';
    document.getElementById('phoneDisplay').textContent = userData.phone || 'Not provided';
    document.getElementById('isOwnerDisplay').textContent = userData.isOwner ? 'Property Owner' : 'Tenant';
    document.getElementById('currentRentDisplay').textContent = userData.currentRent ? `$${parseFloat(userData.currentRent).toLocaleString()}` : 'Not provided';
    document.getElementById('currentResidenceDisplay').textContent = userData.currentResidence || 'Not provided';
    document.getElementById('profilePicDisplay').src = userData.profilePic || 'media/user.webp';
}

// Load user properties
function loadUserProperties(uid) {
    showLoading('propertiesLoading');
    const q = query(collection(db, 'properties'), where('ownerId', '==', uid));
    onSnapshot(q, (snapshot) => {
        try {
            const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const container = document.getElementById('userProperties');
            container.innerHTML = properties.length ? 
                properties.map(prop => `
                    <div class="col-md-4 mb-4">
                        <div class="card h-100">
                            <img src="${prop.images?.[0] || 'media/property1.webp'}" class="card-img-top" alt="${prop.title}">
                            <div class="card-body">
                                <h6>${prop.title}</h6>
                                <p class="text-now-primary fw-bold">$${prop.price?.toLocaleString() || 'N/A'}</p>
                                ${currentUser?.uid === uid ? `
                                    <button class="btn btn-warning btn-sm" onclick="editProperty('${prop.id}')">Edit</button>
                                    <button class="btn btn-danger btn-sm" onclick="deleteProperty('${prop.id}')">Delete</button>
                                ` : ''}
                            </div>
                        </div>
                    </div>
                `).join('') : 
                '<p>No properties listed.</p>';
        } catch (err) {
            showError('Error loading properties: ' + err.message);
        } finally {
            hideLoading('propertiesLoading');
        }
    }, (err) => {
        showError('Error subscribing to properties: ' + err.message);
        hideLoading('propertiesLoading');
    });
}

// Toggle edit mode
document.getElementById('editProfileBtn').addEventListener('click', () => {
    isEditing = true;
    document.getElementById('profileDisplay').classList.add('d-none');
    document.getElementById('profileForm').classList.remove('d-none');
    document.getElementById('editProfileBtn').style.display = 'none';

    // Populate form with current data
    document.getElementById('name').value = viewedUser.name || '';
    document.getElementById('email').value = viewedUser.email || '';
    document.getElementById('phone').value = viewedUser.phone || '';
    document.getElementById('isOwner').checked = viewedUser.isOwner || false;
    document.getElementById('currentRent').value = viewedUser.currentRent || '';
    document.getElementById('currentResidence').value = viewedUser.currentResidence || '';
    if (viewedUser.profilePic) {
        document.getElementById('profilePicPreview').src = viewedUser.profilePic;
        document.getElementById('profilePicPreview').style.display = 'block';
    }
});

// Cancel edit
document.getElementById('cancelEditBtn').addEventListener('click', () => {
    isEditing = false;
    document.getElementById('profileDisplay').classList.remove('d-none');
    document.getElementById('profileForm').classList.add('d-none');
    document.getElementById('editProfileBtn').style.display = 'block';
    document.getElementById('profileForm').reset();
    document.getElementById('profilePicPreview').style.display = 'none';
});

// Profile form submit
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !userDocId || currentUser.uid !== viewedUser.uid) {
        showError('Not authorized to update this profile');
        return;
    }

    showLoading('formLoading');
    const updates = {
        name: document.getElementById('name').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        isOwner: document.getElementById('isOwner').checked,
        currentRent: document.getElementById('currentRent').value.trim() || '',
        currentResidence: document.getElementById('currentResidence').value.trim() || ''
    };

    const file = document.getElementById('profilePic').files[0];
    try {
        if (file) {
            updates.profilePic = await uploadToCloudinary(file, 0.5);
            document.getElementById('profilePicPreview').src = updates.profilePic;
            document.getElementById('profilePicPreview').style.display = 'block';
        }

        const newPassword = document.getElementById('newPassword').value.trim();
        if (updates.email !== currentUser.email) {
            await updateEmail(currentUser, updates.email);
        }
        if (newPassword) {
            await updatePassword(currentUser, newPassword);
        }
        await updateDoc(doc(db, 'users', userDocId), updates);
        viewedUser = { ...viewedUser, ...updates };
        displayUserProfile(viewedUser);
        isEditing = false;
        document.getElementById('profileDisplay').classList.remove('d-none');
        document.getElementById('profileForm').classList.add('d-none');
        document.getElementById('editProfileBtn').style.display = 'block';
        document.getElementById('profileForm').reset();
        document.getElementById('profilePicPreview').style.display = 'none';
        showSuccess('Profile updated successfully!');
    } catch (err) {
        showError('Update failed: ' + err.message);
    } finally {
        hideLoading('formLoading');
    }
});

// Password toggle
document.querySelectorAll('.toggle-password').forEach(icon => {
    icon.addEventListener('click', () => {
        const targetId = icon.dataset.target;
        const input = document.getElementById(targetId);
        const type = input.getAttribute('type') === 'password' ? 'text' : 'password';
        input.setAttribute('type', type);
        icon.classList.toggle('bi-eye');
        icon.classList.toggle('bi-eye-slash');
    });
});

// Global functions for property actions
window.editProperty = (id) => {
    const property = viewedUser.properties?.find(p => p.id === id);
    if (!property || currentUser?.uid !== property.ownerId) {
        showError('Not authorized to edit this property');
        return;
    }
    localStorage.setItem('editProperty', JSON.stringify(property));
    window.location.href = 'creator.html';
};

window.deleteProperty = async (id) => {
    if (!confirm('Are you sure you want to delete this property?')) return;
    try {
        await deleteDoc(doc(db, 'properties', id));
        showSuccess('Property deleted successfully');
    } catch (err) {
        showError('Delete failed: ' + err.message);
    }
};