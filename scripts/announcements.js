import {
    auth,
    db,
    collection,
    getDocs,
    query,
    where,
    onSnapshot,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    addDoc
} from './firebase.js';

// Global state
let currentUser = null;
let announcements = [];
let fuse;

// DOM Elements
const announcementsListContainer = document.getElementById('announcementsList');
const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
const searchTitle = document.querySelector('section.container h2');
const writePropertyLink = document.getElementById('writePropertyLink');
const createAnnounceLink = document.getElementById('createAnnounceLink');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const currentYearEl = document.getElementById('currentYear');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentYearEl.textContent = new Date().getFullYear();
    setupEventListeners();
    checkThemePreference();
    initAuthListener();
    try {
        await loadAnnouncements();
        initFuse();
        loadAnnouncementsList();
    } catch (err) {
        console.error('Failed to load announcements:', err);
        alert('Error loading data. Check Firebase config.');
    }
});

// Auth listener
function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user ? await getUserData(user.uid) : null;
        updateAuthUI();
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
    document.getElementById('switchToRegister').addEventListener('click', (e) => { e.preventDefault(); loginModal.hide(); registerModal.show(); });
    document.getElementById('switchToLogin').addEventListener('click', (e) => { e.preventDefault(); registerModal.hide(); loginModal.show(); });
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);

    // Search (debounced)
    let searchTimeout;
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(handleSearch, 300);
    });
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') handleSearch(); });

    // Password toggles
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
}

// Load announcements
async function loadAnnouncements() {
    const q = query(collection(db, 'announcements'));
    onSnapshot(q, (snapshot) => {
        announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        initFuse();
        loadAnnouncementsList();
    });
}

// Init Fuse
function initFuse() {
    fuse = new Fuse(announcements, {
        keys: ['title', 'content'],
        threshold: 0.3,
        includeScore: true
    });
}

// Load announcements list
function loadAnnouncementsList(searchTerm = '', page = 1, pageSize = 6) {
    let displayAnnouncements = announcements;
    if (searchTerm) {
        const result = fuse.search(searchTerm);
        displayAnnouncements = result.map(r => r.item);
        searchTitle.textContent = `Results for "${searchTerm}"`;
    } else {
        searchTitle.textContent = 'Announcements';
    }

    // Pagination logic
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedAnnouncements = displayAnnouncements.slice(start, end);

    announcementsListContainer.innerHTML = paginatedAnnouncements.length ?
        paginatedAnnouncements.map(createAnnouncementCard).join('') :
        `<div class="col-12 text-center py-5"><i class="bi bi-bell display-1 text-muted"></i><h3 class="mt-3">No announcements found</h3><p>Try adjusting your search</p></div>`;

    // Add pagination controls
    const totalPages = Math.ceil(displayAnnouncements.length / pageSize);
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'd-flex justify-content-center mt-3';
    paginationContainer.innerHTML = `
        <nav>
            <ul class="pagination">
                <li class="page-item ${page === 1 ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${page - 1}">Previous</a>
                </li>
                ${Array.from({ length: totalPages }, (_, i) => `
                    <li class="page-item ${page === i + 1 ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${i + 1}">${i + 1}</a>
                    </li>
                `).join('')}
                <li class="page-item ${page === totalPages ? 'disabled' : ''}">
                    <a class="page-link" href="#" data-page="${page + 1}">Next</a>
                </li>
            </ul>
        </nav>
    `;
    announcementsListContainer.appendChild(paginationContainer);

    // Add event listeners for pagination
    paginationContainer.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newPage = parseInt(e.target.dataset.page);
            if (newPage) loadAnnouncementsList(searchTerm, newPage, pageSize);
        });
    });

    // Add click handlers for announcements
    announcementsListContainer.querySelectorAll('.announcement-card').forEach(card => {
        card.addEventListener('click', () => {
            const link = card.dataset.link;
            if (link) window.open(link, '_blank');
        });
    });
}

// Create announcement card
function createAnnouncementCard(announcement) {
    return `
        <div class="col-md-4 mb-4">
            <div class="card h-100 announcement-card" style="cursor: pointer;" data-link="${announcement.link || '#'}">
                <div class="card-body">
                    <h6 class="card-title">${announcement.title}</h6>
                    <p class="card-text">${announcement.content.substring(0, 100)}${announcement.content.length > 100 ? '...' : ''}</p>
                    <small class="text-muted">Posted by ${announcement.authorName} on ${announcement.createdAt}</small>
                </div>
            </div>
        </div>
    `;
}

// Handle search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    loadAnnouncementsList(searchTerm, 1);
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

// Register
async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const phone = document.getElementById('registerPhone').value.trim();
    const password = document.getElementById('registerPassword').value;
    const registerBtn = document.getElementById('registerSubmitBtn');
    const loader = document.getElementById('registerLoader');
    const errorDiv = document.getElementById('registerError');

    errorDiv.classList.add('d-none');
    errorDiv.textContent = '';
    registerBtn.disabled = true;
    loader.classList.remove('d-none');

    try {
        if (!name || !email || !phone || !password) {
            throw new Error('Please fill in all fields');
        }
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters');
        }
        if (!/^\+?\d{10,15}$/.test(phone)) {
            throw new Error('Please enter a valid phone number (10-15 digits)');
        }

        const { user } = await createUserWithEmailAndPassword(auth, email, password);
        await addDoc(collection(db, 'users'), {
            uid: user.uid,
            name,
            email,
            phone,
            isOwner: false,
            isAnnouncer: false,
            currentRent: '',
            currentResidence: '',
            profilePic: ''
        });
        registerModal.hide();
        document.getElementById('registerForm').reset();
        const successDiv = document.createElement('div');
        successDiv.className = 'alert alert-success mt-3';
        successDiv.textContent = 'Registered successfully! Set as owner or announcer in profile if needed.';
        document.querySelector('#registerModal .modal-body').appendChild(successDiv);
        setTimeout(() => successDiv.remove(), 3000);
    } catch (err) {
        errorDiv.textContent = err.message;
        errorDiv.classList.remove('d-none');
    } finally {
        registerBtn.disabled = false;
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