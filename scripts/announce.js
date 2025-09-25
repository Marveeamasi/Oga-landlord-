import {
    auth,
    db,
    collection,
    addDoc,
    updateDoc,
    doc,
    query,
    where,
    getDocs,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut
} from './firebase.js';

// Global state
let currentUser = null;
let editAnnouncement = null;

// DOM Elements
const announceForm = document.getElementById('announceForm');
const formTitle = document.getElementById('formTitle');
const submitBtn = document.getElementById('submitBtn');
const formLoader = document.getElementById('formLoader');
const formError = document.getElementById('formError');
const formSuccess = document.getElementById('formSuccess');
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const writePropertyLink = document.getElementById('writePropertyLink');
const createAnnounceLink = document.getElementById('createAnnounceLink');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const currentYearEl = document.getElementById('currentYear');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    currentYearEl.textContent = new Date().getFullYear();
    setupEventListeners();
    checkThemePreference();
    initAuthListener();
    checkEditMode();
});

// Auth listener
function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user ? await getUserData(user.uid) : null;
        updateAuthUI();
        if (!currentUser || !currentUser.isAnnouncer) {
            loginModal.show();
            alert('You must be logged in as an announcer to access this page.');
            setTimeout(() => window.location.href = 'announcements.html', 2000);
        }
    });
}

// Get user data
async function getUserData(uid) {
    try {
        const q = query(collection(db, 'users'), where('uid', '==', uid));
        const snapshot = await getDocs(q);
        return snapshot.docs[0]?.data() || null;
    } catch (err) {
        console.error('Error fetching user:', err);
        return null;
    }
}

// Update auth UI
function updateAuthUI() {
    if (currentUser) {
        loginBtn.innerHTML = 'Logout';
        loginBtn.onclick = async () => {
            await signOut(auth);
            alert('Logged out');
        };
        registerBtn.innerHTML = '<i class="bi bi-person-circle"></i>';
        registerBtn.title = 'Profile';
        registerBtn.classList.remove('btn-primary');
        registerBtn.classList.add('text-now-primary');
        registerBtn.classList.add('fs-4');
        registerBtn.onclick = () => window.location.href = 'profile.html';
        writePropertyLink.style.display = currentUser.isOwner ? 'block' : 'none';
        createAnnounceLink.style.display = currentUser.isAnnouncer ? 'block' : 'none';
    } else {
        loginBtn.innerHTML = 'Login';
        loginBtn.classList.remove('btn-danger');
        loginBtn.classList.add('btn-outline-primary');
        loginBtn.onclick = () => loginModal.show();
        registerBtn.innerHTML = 'Register';
        registerBtn.classList.remove('btn-outline-primary');
        registerBtn.classList.remove('fs-4');
        registerBtn.classList.remove('text-now-primary');
        registerBtn.classList.add('btn-primary');
        registerBtn.onclick = () => registerModal.show();
        writePropertyLink.style.display = 'none';
        createAnnounceLink.style.display = 'none';
    }
}

// Event listeners
function setupEventListeners() {
    themeToggle.addEventListener('change', toggleTheme);
    loginBtn.addEventListener('click', () => loginModal.show());
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    announceForm.addEventListener('submit', handleSubmit);
}

// Check edit mode
function checkEditMode() {
    const editData = localStorage.getItem('editAnnouncement');
    if (editData) {
        editAnnouncement = JSON.parse(editData);
        formTitle.textContent = 'Edit Announcement';
        submitBtn.textContent = 'Update';
        document.getElementById('announceTitle').value = editAnnouncement.title;
        document.getElementById('announceContent').value = editAnnouncement.content;
        document.getElementById('announceLink').value = editAnnouncement.link || '';
    }
}

// Handle form submission
async function handleSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('announceTitle').value.trim();
    const content = document.getElementById('announceContent').value.trim();
    const link = document.getElementById('announceLink').value.trim();

    formError.classList.add('d-none');
    formSuccess.classList.add('d-none');
    submitBtn.disabled = true;
    formLoader.classList.remove('d-none');

    try {
        if (!title || !content) {
            throw new Error('Title and content are required');
        }
        if (link && !/^https?:\/\/[^\s$.?#].[^\s]*$/.test(link)) {
            throw new Error('Please enter a valid URL');
        }

        if (editAnnouncement) {
            // Update existing announcement
            await updateDoc(doc(db, 'announcements', editAnnouncement.id), {
                title,
                content,
                link: link || '',
                updatedAt: new Date().toISOString().split('T')[0]
            });
            localStorage.removeItem('editAnnouncement');
            formSuccess.textContent = 'Announcement updated successfully!';
        } else {
            // Create new announcement
            await addDoc(collection(db, 'announcements'), {
                title,
                content,
                link: link || '',
                authorId: currentUser.uid,
                authorName: currentUser.name || currentUser.email,
                createdAt: new Date().toISOString().split('T')[0]
            });
            formSuccess.textContent = 'Announcement created successfully!';
        }

        formSuccess.classList.remove('d-none');
        announceForm.reset();
        setTimeout(() => window.location.href = 'announcements.html', 2000);
    } catch (err) {
        formError.textContent = err.message;
        formError.classList.remove('d-none');
    } finally {
        submitBtn.disabled = false;
        formLoader.classList.add('d-none');
    }
}

// Login
async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const loginBtn = document.getElementById('loginSubmitBtn');
    const loader = document.getElementById('loginLoader');
    const errorDiv = document.getElementById('loginError');

    errorDiv.classList.add('d-none');
    errorDiv.textContent = '';
    loginBtn.disabled = true;
    loader.classList.remove('d-none');

    try {
        if (!email || !password) {
            throw new Error('Please fill in all fields');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }

        await signInWithEmailAndPassword(auth, email, password);
        loginModal.hide();
        document.getElementById('loginForm').reset();
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('d-none');
    } finally {
        loginBtn.disabled = false;
        loader.classList.add('d-none');
    }
}

// Theme
function checkThemePreference() {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    themeToggle.checked = saved === 'dark';
    themeLabel.textContent = saved === 'dark' ? 'Light Mode' : 'Dark Mode';
}

function toggleTheme() {
    const isDark = themeToggle.checked;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeLabel.textContent = isDark ? 'Light Mode' : 'Dark Mode';
}