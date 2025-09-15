import { auth, db, collection, addDoc, getDoc, updateDoc, doc, onAuthStateChanged, query, where, getDocs } from './firebase.js';
import { uploadToCloudinary } from './cloudinary.js';

let currentUser = null;
let editProperty = null;
let pendingFiles = [];

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

// Input validation
function validateInputs(formData, files, existingImages = []) {
    if (!formData.title.trim() || formData.title.length > 100) {
        showError('Title is required and must be 100 characters or less.');
        return false;
    }
    if (!formData.description.trim() || formData.description.length > 1000) {
        showError('Description is required and must be 1000 characters or less.');
        return false;
    }
    if (!formData.price || formData.price <= 0) {
        showError('Price must be a positive number.');
        return false;
    }
    if (!formData.location.trim()) {
        showError('Location is required.');
        return false;
    }
    if (!formData.type) {
        showError('Property type is required.');
        return false;
    }
    if (!formData.bedrooms || formData.bedrooms <= 0) {
        showError('Bedrooms must be a positive number.');
        return false;
    }
    if (!formData.bathrooms || formData.bathrooms <= 0) {
        showError('Bathrooms must be a positive number.');
        return false;
    }
    if (!formData.area || formData.area <= 0) {
        showError('Area must be a positive number.');
        return false;
    }
    if (!formData.tags.length) {
        showError('At least one tag is required.');
        return false;
    }
    const totalMedia = existingImages.length + files.length;
    if (totalMedia < 3) {
        showError('At least 3 media files are required.');
        return false;
    }
    if (totalMedia > 8) {
        showError('Maximum of 8 media files allowed.');
        return false;
    }
    for (const file of files) {
        if (file.type.startsWith('video/') && file.size > 10 * 1024 * 1024) {
            showError('Video files must be 10MB or less.');
            return false;
        }
        if (file.type.startsWith('image/') && file.size > 5 * 1024 * 1024) {
            showError('Image files must be 5MB or less before compression.');
            return false;
        }
    }
    return true;
}

// Initialize auth state listener
onAuthStateChanged(auth, async (user) => {
    showLoading('loadingSpinner');
    currentUser = user;
    if (!currentUser) {
        showError('You must be logged in to create or edit properties.');
        setTimeout(() => window.location.href = 'index.html', 2000);
        return;
    }

    try {
        const userData = await getUserData(currentUser.uid);
        if (!userData || !userData.isOwner) {
            showError('Only property owners can create or edit properties.');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }

        applySavedTheme();
        const urlParams = new URLSearchParams(window.location.search);
        const propertyId = urlParams.get('id');
        if (propertyId) {
            await loadPropertyForEdit(propertyId);
        } else {
            loadEditDataFromLocalStorage();
        }
        setupMediaInput();
    } catch (err) {
        showError('Error initializing page: ' + err.message);
        setTimeout(() => window.location.href = 'index.html', 2000);
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
            return snapshot.docs[0].data();
        }
        return null;
    } catch (err) {
        throw new Error('Failed to fetch user data: ' + err.message);
    }
}

// Load property for editing
async function loadPropertyForEdit(propertyId) {
    try {
        const propertyDoc = await getDoc(doc(db, 'properties', propertyId));
        if (!propertyDoc.exists()) {
            showError('Property not found.');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        editProperty = { id: propertyDoc.id, ...propertyDoc.data() };
        if (editProperty.ownerId !== currentUser.uid) {
            showError('You are not authorized to edit this property.');
            setTimeout(() => window.location.href = 'index.html', 2000);
            return;
        }
        document.getElementById('formTitle').textContent = 'Edit Property';
        document.getElementById('submitBtn').textContent = 'Save Update';
        document.getElementById('propertyId').value = editProperty.id;
        document.getElementById('title').value = editProperty.title || '';
        document.getElementById('description').value = editProperty.description || '';
        document.getElementById('price').value = editProperty.price || '';
        document.getElementById('location').value = editProperty.location || '';
        document.getElementById('type').value = editProperty.type || '';
        document.getElementById('bedrooms').value = editProperty.bedrooms || '';
        document.getElementById('bathrooms').value = editProperty.bathrooms || '';
        document.getElementById('area').value = editProperty.area || '';
        document.getElementById('tags').value = editProperty.tags?.join(', ') || '';
        updateMediaPreviews(editProperty.images || [], []);
        document.getElementById('cancelEdit').style.display = 'inline-block';
    } catch (err) {
        showError('Error loading property: ' + err.message);
        setTimeout(() => window.location.href = 'index.html', 2000);
    }
}

// Load edit data from localStorage
function loadEditDataFromLocalStorage() {
    const stored = localStorage.getItem('editProperty');
    if (stored) {
        editProperty = JSON.parse(stored);
        document.getElementById('formTitle').textContent = 'Edit Property';
        document.getElementById('submitBtn').textContent = 'Save Update';
        document.getElementById('propertyId').value = editProperty.id;
        document.getElementById('title').value = editProperty.title || '';
        document.getElementById('description').value = editProperty.description || '';
        document.getElementById('price').value = editProperty.price || '';
        document.getElementById('location').value = editProperty.location || '';
        document.getElementById('type').value = editProperty.type || '';
        document.getElementById('bedrooms').value = editProperty.bedrooms || '';
        document.getElementById('bathrooms').value = editProperty.bathrooms || '';
        document.getElementById('area').value = editProperty.area || '';
        document.getElementById('tags').value = editProperty.tags?.join(', ') || '';
        updateMediaPreviews(editProperty.images || [], []);
        document.getElementById('cancelEdit').style.display = 'inline-block';
        localStorage.removeItem('editProperty');
    }
}

// Update media previews
function updateMediaPreviews(uploadedUrls, pendingFiles) {
    const mediaPreviews = document.getElementById('mediaPreviews');
    mediaPreviews.innerHTML = '';
    uploadedUrls.forEach((url, index) => {
        const isVideo = url.match(/\.(mp4|webm|ogg)$/i);
        const previewDiv = document.createElement('div');
        previewDiv.className = 'media-preview';
        previewDiv.dataset.url = url;
        previewDiv.innerHTML = `
            ${isVideo ? `<video src="${url}" controls></video>` : `<img src="${url}" alt="Uploaded media">`}
            <button type="button" class="remove-btn" onclick="removeMedia('${url}', true)"><i class="bi bi-trash3"></i></button>
            <button type="button" class="replace-btn" onclick="replaceMedia(${index}, true)"><i class="bi bi-nintendo-switch"></i></button>
        `;
        mediaPreviews.appendChild(previewDiv);
    });
    pendingFiles.forEach((file, index) => {
        const isVideo = file.type.startsWith('video/');
        const previewUrl = URL.createObjectURL(file);
        const previewDiv = document.createElement('div');
        previewDiv.className = 'media-preview';
        previewDiv.dataset.fileIndex = index;
        previewDiv.innerHTML = `
            ${isVideo ? `<video src="${previewUrl}" controls></video>` : `<img src="${previewUrl}" alt="Pending media">`}
            <button type="button" class="remove-btn" onclick="removeMedia(${index}, false)"><i class="bi bi-trash3"></i></button>
            <button type="button" class="replace-btn" onclick="replaceMedia(${index}, false)"><i class="bi bi-nintendo-switch"></i></button>
            <span class="pending-label">Pending</span>
        `;
        mediaPreviews.appendChild(previewDiv);
    });
}

// Setup media input with drag-and-drop
function setupMediaInput() {
    const mediaInput = document.getElementById('mediaFiles');
    const addMediaBtn = document.getElementById('addMediaBtn');
    const dropzone = document.getElementById('mediaDropzone');

    addMediaBtn.addEventListener('click', () => mediaInput.click());

    mediaInput.addEventListener('change', () => handleMediaFiles(mediaInput.files));

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        handleMediaFiles(files);
    });
}

// Handle media files
function handleMediaFiles(files) {
    const existingImages = editProperty?.images || [];
    const totalMedia = existingImages.length + pendingFiles.length + files.length;
    if (totalMedia > 8) {
        showError('Maximum of 8 media files allowed.');
        return;
    }
    const newFiles = Array.from(files).filter(file => 
        (file.type.startsWith('image/') || file.type.startsWith('video/'))
    );
    pendingFiles = [...pendingFiles, ...newFiles];
    updateMediaPreviews(existingImages, pendingFiles);
}

// Remove media
window.removeMedia = (identifier, isUploaded) => {
    if (isUploaded) {
        if (editProperty) {
            editProperty.images = editProperty.images.filter(url => url !== identifier);
        }
    } else {
        pendingFiles = pendingFiles.filter((_, index) => index !== parseInt(identifier));
    }
    updateMediaPreviews(editProperty?.images || [], pendingFiles);
};

// Replace media
window.replaceMedia = (index, isUploaded) => {
    const mediaInput = document.createElement('input');
    mediaInput.type = 'file';
    mediaInput.accept = 'image/*,video/*';
    mediaInput.onchange = () => {
        if (mediaInput.files.length > 0) {
            const existingImages = editProperty?.images || [];
            if (existingImages.length + pendingFiles.length >= 8) {
                showError('Maximum of 8 media files allowed.');
                return;
            }
            if (isUploaded) {
                editProperty.images.splice(index, 1, ...Array.from(mediaInput.files));
                updateMediaPreviews(editProperty.images, pendingFiles);
            } else {
                pendingFiles[index] = mediaInput.files[0];
                updateMediaPreviews(existingImages, pendingFiles);
            }
        }
    };
    mediaInput.click();
};

// Form submission
document.getElementById('propertyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        showError('You must be logged in to save properties.');
        return;
    }

    showLoading('formLoading');
    const formData = {
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        price: parseInt(document.getElementById('price').value) || 0,
        location: document.getElementById('location').value.trim(),
        type: document.getElementById('type').value,
        bedrooms: parseInt(document.getElementById('bedrooms').value) || 0,
        bathrooms: parseInt(document.getElementById('bathrooms').value) || 0,
        area: parseInt(document.getElementById('area').value) || 0,
        tags: document.getElementById('tags').value.split(',').map(t => t.trim()).filter(Boolean),
        ownerId: currentUser.uid,
        rating: editProperty?.rating || 0,
        featured: editProperty?.featured || true,
        reviews: editProperty?.reviews || [],
        images: editProperty?.images || []
    };

    if (!validateInputs(formData, pendingFiles, formData.images)) {
        hideLoading('formLoading');
        return;
    }

    try {
        if (pendingFiles.length > 0) {
            const urls = await Promise.all(pendingFiles.map(async file => {
                try {
                    return await uploadToCloudinary(file, file.type.startsWith('image/') ? 0.5 : 10);
                } catch (err) {
                    showError(`Failed to upload ${file.name}: ${err.message}`);
                    return null;
                }
            })).then(urls => urls.filter(Boolean));
            formData.images = [...formData.images, ...urls];
        }

        if (editProperty) {
            await updateDoc(doc(db, 'properties', editProperty.id), formData);
            showSuccess('Property updated successfully!');
        } else {
            await addDoc(collection(db, 'properties'), formData);
            showSuccess('Property created successfully!');
        }
        localStorage.removeItem('editProperty');
        pendingFiles = [];
        setTimeout(() => window.location.href = 'index.html', 2000);
    } catch (err) {
        showError('Error saving property: ' + err.message);
    } finally {
        hideLoading('formLoading');
    }
});

// Cancel edit
document.getElementById('cancelEdit').addEventListener('click', () => {
    localStorage.removeItem('editProperty');
    pendingFiles = [];
    window.location.href = 'index.html';
});