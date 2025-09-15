import { auth, db, collection, addDoc, getDoc, updateDoc, doc, onAuthStateChanged } from './firebase.js';
import { uploadToCloudinary } from './cloudinary.js';

let currentUser = null;
let editProperty = null;

onAuthStateChanged(auth, async (user) => {
    currentUser = user ? await getUserData(user.uid) : null;
    if (!currentUser || !currentUser.isOwner) {
        alert('Only owners can create properties. Set isOwner: true in Firestore if needed.');
        window.location.href = 'index.html';
    }
    loadEditData();
});

async function getUserData(uid) {
    const snap = await getDoc(doc(db, 'users', uid)); // Use doc ID as uid
    return snap.exists() ? snap.data() : null;
}

function loadEditData() {
    const stored = localStorage.getItem('editProperty');
    if (stored) {
        editProperty = JSON.parse(stored);
        document.getElementById('formTitle').textContent = 'Edit Property';
        document.getElementById('propertyId').value = editProperty.id;
        document.getElementById('title').value = editProperty.title;
        document.getElementById('description').value = editProperty.description;
        document.getElementById('price').value = editProperty.price;
        document.getElementById('location').value = editProperty.location;
        document.getElementById('type').value = editProperty.type;
        document.getElementById('bedrooms').value = editProperty.bedrooms;
        document.getElementById('bathrooms').value = editProperty.bathrooms;
        document.getElementById('area').value = editProperty.area;
        document.getElementById('tags').value = editProperty.tags?.join(', ');
        document.getElementById('uploadedUrls').innerHTML = editProperty.images?.map(url => `<small>Uploaded: ${url.split('/').pop()}</small>`).join('<br>');
        document.getElementById('cancelEdit').style.display = 'inline-block';
        localStorage.removeItem('editProperty');
    }
}

document.getElementById('cancelEdit').addEventListener('click', () => window.location.href = 'index.html');

document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const formData = {
        title: document.getElementById('title').value,
        description: document.getElementById('description').value,
        price: parseInt(document.getElementById('price').value),
        location: document.getElementById('location').value,
        type: document.getElementById('type').value,
        bedrooms: parseInt(document.getElementById('bedrooms').value),
        bathrooms: parseInt(document.getElementById('bathrooms').value),
        area: parseInt(document.getElementById('area').value),
        tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean),
        ownerId: currentUser.uid,
        rating: 0,
        featured: true,
        reviews: [],
        images: editProperty?.images || [] // Keep existing for edit
    };

    // Handle media uploads
    const files = document.getElementById('mediaFiles').files;
    if (files.length > 0) {
        const urls = await Promise.all(Array.from(files).map(async file => {
            try {
                return await uploadToCloudinary(file);
            } catch (err) {
                alert(err.message);
                return null;
            }
        })).then(urls => urls.filter(Boolean));
        formData.images = [...formData.images, ...urls];
    }

    try {
        if (editProperty) {
            await updateDoc(doc(db, 'properties', editProperty.id), formData);
            alert('Property updated!');
        } else {
            await addDoc(collection(db, 'properties'), formData);
            alert('Property added!');
        }
        window.location.href = 'index.html';
    } catch (err) {
        alert('Error: ' + err.message);
    }
});