import { uploadToCloudinary } from './cloudinary.js';
import { auth, db, updateDoc, collection, query, where, onSnapshot, doc, updateEmail, updatePassword, onAuthStateChanged } from './firebase.js';

let currentUser = null;
let userDocId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        alert('Please log in');
        window.location.href = 'index.html';
        return;
    }
    currentUser = user;
    const userData = await getUserData(user.uid);
    if (userData) {
        userDocId = userData.docId; // Store doc ID
        document.getElementById('name').value = userData.name || '';
        document.getElementById('email').value = userData.email || '';
        document.getElementById('phone').value = userData.phone || '';
        document.getElementById('isOwner').checked = userData.isOwner || false;
        document.getElementById('currentRent').value = userData.currentRent || '';
        document.getElementById('currentResidence').value = userData.currentResidence || '';
        if (userData.profilePic) {
            document.getElementById('profilePicPreview').src = userData.profilePic;
            document.getElementById('profilePicPreview').style.display = 'block';
        }
        loadUserProperties(user.uid);
    }
});

// Get user data
async function getUserData(uid) {
    const q = query(collection(db, 'users'), where('uid', '==', uid));
    const snapshot = await getDocs(q);
    if (snapshot.docs.length) {
        return { docId: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return null;
}

// Load user properties
function loadUserProperties(uid) {
    const q = query(collection(db, 'properties'), where('ownerId', '==', uid));
    onSnapshot(q, (snapshot) => {
        const properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        const container = document.getElementById('userProperties');
        container.innerHTML = properties.length ? 
            properties.map(prop => `
                <div class="col-md-4 mb-4">
                    <div class="card h-100">
                        <img src="${prop.images?.[0] || 'media/property1.webp'}" class="card-img-top" alt="${prop.title}">
                        <div class="card-body">
                            <h6>${prop.title}</h6>
                            <p class="text-now-primary fw-bold">$${prop.price?.toLocaleString()}</p>
                            <button class="btn btn-warning btn-sm" onclick="editProperty('${prop.id}')">Edit</button>
                            <button class="btn btn-danger btn-sm" onclick="deleteProperty('${prop.id}')">Delete</button>
                        </div>
                    </div>
                </div>
            `).join('') : 
            '<p>No properties listed.</p>';
    });
}

// Profile form submit
document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser || !userDocId) return;

    const updates = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        isOwner: document.getElementById('isOwner').checked,
        currentRent: document.getElementById('currentRent').value || '',
        currentResidence: document.getElementById('currentResidence').value || ''
    };

    const file = document.getElementById('profilePic').files[0];
    if (file) {
        try {
            updates.profilePic = await uploadToCloudinary(file, 0.5); // 500KB max for profile pic
            document.getElementById('profilePicPreview').src = updates.profilePic;
            document.getElementById('profilePicPreview').style.display = 'block';
        } catch (err) {
            alert('Profile picture upload failed: ' + err.message);
        }
    }

    const newPassword = document.getElementById('newPassword').value;
    try {
        if (updates.email !== currentUser.email) {
            await updateEmail(currentUser, updates.email);
        }
        if (newPassword) {
            await updatePassword(currentUser, newPassword);
        }
        await updateDoc(doc(db, 'users', userDocId), updates);
        alert('Profile updated!');
    } catch (err) {
        alert('Update failed: ' + err.message);
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
    const property = properties.find(p => p.id === id);
    if (!property || currentUser.uid !== property.ownerId) return alert('Not authorized');
    localStorage.setItem('editProperty', JSON.stringify(property));
    window.location.href = 'creator.html';
};

window.deleteProperty = async (id) => {
    if (!confirm('Delete this property?')) return;
    try {
        await deleteDoc(doc(db, 'properties', id));
        alert('Property deleted');
    } catch (err) {
        alert('Delete failed: ' + err.message);
    }
};