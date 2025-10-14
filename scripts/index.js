  import {
    auth,
    db,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    doc,
    query,
    where,
    onSnapshot,
    arrayUnion,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from './firebase.js';

// Global state
let currentUser = null;
let properties = [];
let fuse;
let unsubscribeUnreadCount = null;

// DOM Elements
const featuredPropertiesContainer = document.getElementById('featuredProperties');
const propertyModal = new bootstrap.Modal(document.getElementById('propertyModal'));
const propertyModalTitle = document.getElementById('propertyModalTitle');
const propertyModalBody = document.getElementById('propertyModalBody');
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
const forSaleCheck = document.getElementById('forSaleCheck');
const forRentCheck = document.getElementById('forRentCheck');
const forLandCheck = document.getElementById('forLandCheck');
const verifiedCheck = document.getElementById('verifiedCheck');
const unreadCountBadge = document.getElementById('unreadCount');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentYearEl.textContent = new Date().getFullYear();
    setupEventListeners();
    checkThemePreference();
    initAuthListener();
    try {
        await loadProperties();
        initFuse();
        loadFeaturedProperties();
    } catch (err) {
        console.error('Failed to load properties:', err);
        alert('Error loading data. Check Firebase config.');
    }
});

// Auth listener
function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user ? await getUserData(user.uid) : null;
        updateAuthUI();
        updateUnreadCount();
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
        unreadCountBadge.style.display = 'none';
    }
}

// Update unread message count
function updateUnreadCount() {
    if (unsubscribeUnreadCount) unsubscribeUnreadCount();
    if (!currentUser) {
        unreadCountBadge.style.display = 'none';
        return;
    }
    const q = query(
        collection(db, 'chats'),
        where(currentUser.isOwner ? 'ownerId' : 'userId', '==', currentUser.uid)
    );
    unsubscribeUnreadCount = onSnapshot(q, (snapshot) => {
        const totalUnread = snapshot.docs.reduce((sum, doc) => {
            const data = doc.data();
            return sum + (currentUser.isOwner ? data.unreadByOwner || 0 : data.unreadByUser || 0);
        }, 0);
        unreadCountBadge.textContent = totalUnread;
        unreadCountBadge.style.display = totalUnread > 0 ? 'inline' : 'none';
    });
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

    // Checkbox filters
    [verifiedCheck, landCheck, houseCheck].forEach(checkbox => {
        checkbox.addEventListener('change', handleSearch);
    });

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

    // Carousel
    const carouselEl = document.getElementById('heroCarousel');
    const carousel = new bootstrap.Carousel(carouselEl, { interval: 5000, pause: false });
    const pauseBtn = document.getElementById('carouselPauseBtn');
    let isPlaying = true;
    pauseBtn.addEventListener('click', () => {
        if (isPlaying) {
            carousel.pause();
            pauseBtn.innerHTML = '<i class="bi bi-play-fill"></i>';
        } else {
            carousel.cycle();
            pauseBtn.innerHTML = '<i class="bi bi-pause-fill"></i>';
        }
        isPlaying = !isPlaying;
    });
}

// Load all properties
async function loadProperties() {
    const q = query(collection(db, 'properties'));
    onSnapshot(q, (snapshot) => {
        properties = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        initFuse();
        loadFeaturedProperties();
    });
}

// Init Fuse
function initFuse() {
    fuse = new Fuse(properties, {
        keys: ['title', 'description', 'location', 'tags', 'price'],
        threshold: 0.3,
        includeScore: true
    });
}

// Load featured properties
function loadFeaturedProperties(searchTerm = '', page = 1, pageSize = 6) {
    let displayProps = properties;
    if (searchTerm) {
        const result = fuse.search(searchTerm);
        displayProps = result.map(r => r.item);
        searchTitle.textContent = `Results for "${searchTerm}"`;
    } else {
        searchTitle.textContent = 'Properties';
    }

    // Apply filters
    const landChecked = landCheck.checked;
    const houseChecked = houseCheck.checked;
    const verifiedChecked = verifiedCheck.checked;

    // Category filtering
    if (landChecked || houseChecked) {
        displayProps = displayProps.filter(p => 
            (landChecked && p.category === 'land') ||
            (houseChecked && p.category === 'house')
        );
    }
    
    // Verified filtering
    if (verifiedChecked) {
        displayProps = displayProps.filter(p => p.isVerified === true);
    }

    // Pagination logic
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedProps = displayProps.slice(start, end);

    featuredPropertiesContainer.innerHTML = paginatedProps.length ?
        paginatedProps.map(createPropertyCard).join('') :
        `<div class="col-12 text-center py-5"><i class="bi bi-search display-1 text-muted"></i><h3 class="mt-3">No properties found</h3><p>Try adjusting your search or filters</p></div>`;

    // Add pagination controls
    const totalPages = Math.ceil(displayProps.length / pageSize);
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
    featuredPropertiesContainer.appendChild(paginationContainer);

    // Add event listeners for pagination
    paginationContainer.querySelectorAll('.page-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const newPage = parseInt(e.target.dataset.page);
            if (newPage) loadFeaturedProperties(searchTerm, newPage, pageSize);
        });
    });

    // Add click handlers for property cards
    featuredPropertiesContainer.querySelectorAll('.property-card').forEach(card => {
        card.addEventListener('click', () => showPropertyDetails(card.dataset.id));
    });
}

// Create property card
function createPropertyCard(property) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(property.rating || 0)) stars += '<i class="bi bi-star-fill rating"></i>';
        else if (i === Math.ceil(property.rating || 0) && !Number.isInteger(property.rating || 0)) stars += '<i class="bi bi-star-half rating"></i>';
        else stars += '<i class="bi bi-star rating"></i>';
    }

    return `
        <div class="col-md-4 mb-4">
            <div class="card h-100 property-card" style="cursor:pointer" data-id="${property.id}">
                <img src="${property.images?.[0] || 'media/property1.webp'}" class="property-image card-img-top" alt="${property.title}">
                <div class="card-body">
                    <h6 class="card-title">${property.title}</h6>
                    <div class="d-flex justify-content-between">
                        <p class="card-text text-now-primary fw-bold">$${property.price?.toLocaleString() || 0}</p>
                        <div class="card-text d-flex gap-2 flex-wrap" style="font-size:12px">
                            ${property.type !== 'Land' ? `
                                <span><i class="bi bi-door-closed"></i> ${property.bedrooms || 0} beds</span>
                                <span class="ms-3"><i class="bi bi-droplet"></i> ${property.bathrooms || 0} baths</span>
                            ` : ''}
                            <span class="ms-3"><i class="bi bi-arrows-fullscreen"></i> ${property.area || 0} sq ft</span>
                        </div>
                    </div>
                    <div class="mt-2">${stars} <small>${(property.rating || 0).toFixed(1)} (${property.reviews?.length || 0} reviews)</small></div>
                    ${property.verified ? '<span class="badge bg-success mt-2">Verified</span>' : ''}
                </div>
            </div>
        </div>
    `;
}

// Handle search
function handleSearch() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    loadFeaturedProperties(searchTerm, 1);
}

// Show property details
async function showPropertyDetails(id) {
    if (!currentUser) {
        alert('Please log in to view property details');
        loginModal.show();
        return;
    }

    const property = properties.find(p => p.id === id);
    if (!property) return;

    const owner = await getUserData(property.ownerId);
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        if (i <= Math.floor(property.rating || 0)) stars += '<i class="bi bi-star-fill rating"></i>';
        else if (i === Math.ceil(property.rating || 0) && !Number.isInteger(property.rating || 0)) stars += '<i class="bi bi-star-half rating"></i>';
        else stars += '<i class="bi bi-star rating"></i>';
    }

    const reviewsHTML = (property.reviews || []).map(review => {
        let reviewStars = '';
        for (let i = 1; i <= 5; i++) reviewStars += i <= review.rating ? '<i class="bi bi-star-fill rating"></i>' : '<i class="bi bi-star rating"></i>';
        return `
            <div class="comment mb-3">
                <div class="d-flex justify-content-between">
                    <h6>${review.userName}</h6>
                    <small class="text-muted">${review.date}</small>
                </div>
                <div class="mb-2">${reviewStars}</div>
                <p>${review.comment}</p>
            </div>
        `;
    }).join('') || '<p>No reviews yet.</p>';

    propertyModalTitle.textContent = property.title;
    propertyModalBody.innerHTML = `
        <div class="row">
            <div class="col-md-7">
                <div id="propertyCarousel" class="carousel slide">
<div class="carousel-inner">
    ${property.images?.map((mediaItem, index) => {
        const isVideo = mediaItem.toLowerCase().match(/\.(mp4|webm|ogg|mov|avi)$/);
        if (isVideo) {
            return `<div class="carousel-item ${index === 0 ? 'active' : ''}">
                <video class="property-detail-image w-100" controls>
                    <source src="${mediaItem}" type="video/mp4">
                    Your browser does not support the video tag.
                </video>
            </div>`;
        } else {
            return `<div class="carousel-item ${index === 0 ? 'active' : ''}">
                <img src="${mediaItem}" class="property-detail-image w-100" alt="${property.title}">
            </div>`;
        }
    }).join('') || ''}
</div>

                    <button class="carousel-control-prev" type="button" data-bs-target="#propertyCarousel" data-bs-slide="prev"><span class="carousel-control-prev-icon"></span></button>
                    <button class="carousel-control-next" type="button" data-bs-target="#propertyCarousel" data-bs-slide="next"><span class="carousel-control-next-icon"></span></button>
                </div>
            </div>
            <div class="col-md-5">
                <h3 class="text-now">$${property.price?.toLocaleString()}</h3>
                <p class="mb-2"><i class="bi bi-geo-alt"></i> ${property.location}</p>
                <div class="d-flex mb-3">
                    ${property.type !== 'Land' ? `
                        <span class="me-3"><i class="bi bi-door-closed"></i> ${property.bedrooms || 0} beds</span>
                        <span class="me-3"><i class="bi bi-droplet"></i> ${property.bathrooms || 0} baths</span>
                    ` : ''}
                    <span><i class="bi bi-arrows-fullscreen"></i> ${property.area || 0} sq ft</span>
                </div>
                <div class="mb-3">${stars} <span class="ms-1">${(property.rating || 0).toFixed(1)} (${property.reviews?.length || 0} reviews)</span></div>
                <div class="mb-3">${(property.tags || []).map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}</div>
                <p>${property.description}</p>
                ${property.verified ? '<span class="badge bg-success mb-3">Verified</span>' : ''}
                <div class="d-grid gap-2">
                    ${currentUser.uid !== property.ownerId ? `
                        <a href="chats.html?propertyId=${property.id}&ownerId=${property.ownerId}" class="btn btn-success">
                            <i class="bi bi-chat-dots"></i> Chat Owner for this Property
                        </a>
                    ` : ''}
                    ${currentUser && currentUser.uid === property.ownerId ? `<button class="btn btn-warning" onclick="editProperty('${property.id}')">Edit Property</button>` : ''}
                    <button class="btn btn-accent" id="showReviewFormBtn">Add Review</button>
                </div>
            </div>
        </div>
        <hr>
        <h4>Reviews</h4>
        <div id="reviewsContainer">${reviewsHTML}</div>
        <div class="row mt-4 d-none" id="reviewFormContainer">
            <div class="col-12">
                <h5>Add Your Review</h5>
                <form id="reviewForm">
                    <div class="mb-3">
                        <label class="form-label">Rating</label>
                        <div class="rating-input">
                            <i class="bi bi-star fs-4 rating" data-value="1"></i><i class="bi bi-star fs-4 rating" data-value="2"></i><i class="bi bi-star fs-4 rating" data-value="3"></i><i class="bi bi-star fs-4 rating" data-value="4"></i><i class="bi bi-star fs-4 rating" data-value="5"></i>
                        </div>
                        <input type="hidden" id="reviewRating" value="5">
                    </div>
                    <div class="mb-3">
                        <label for="reviewComment" class="form-label">Comment</label>
                        <textarea class="form-control" id="reviewComment" rows="3" required></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary">Submit</button>
                    <button type="button" class="btn btn-secondary" id="cancelReviewBtn">Cancel</button>
                </form>
            </div>
        </div>
    `;

    if (currentUser) {
        const showBtn = propertyModalBody.querySelector('#showReviewFormBtn');
        const formContainer = propertyModalBody.querySelector('#reviewFormContainer');
        const cancelBtn = propertyModalBody.querySelector('#cancelReviewBtn');
        const form = propertyModalBody.querySelector('#reviewForm');
        const starsEls = propertyModalBody.querySelectorAll('.rating-input .bi-star');

        showBtn.addEventListener('click', () => formContainer.classList.remove('d-none'));
        cancelBtn.addEventListener('click', () => formContainer.classList.add('d-none'));

        starsEls.forEach(star => star.addEventListener('click', (e) => {
            const val = parseInt(e.target.dataset.value);
            document.getElementById('reviewRating').value = val;
            starsEls.forEach(s => {
                const sv = parseInt(s.dataset.value);
                s.className = sv <= val ? 'bi bi-star-fill fs-4 rating' : 'bi bi-star fs-4 rating';
            });
        }));

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const rating = parseInt(document.getElementById('reviewRating').value);
            const comment = document.getElementById('reviewComment').value;
            const newReview = { userId: currentUser.uid, userName: currentUser.name || currentUser.email, rating, comment, date: new Date().toISOString().split('T')[0] };

            await updateDoc(doc(db, 'properties', id), {
                reviews: arrayUnion(newReview)
            });
            const allReviews = [...(property.reviews || []), newReview];
            const avg = allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;
            await updateDoc(doc(db, 'properties', id), { rating: avg, reviews: allReviews });

            alert('Review added!');
            propertyModal.hide();
            showPropertyDetails(id);
        });
    } else {
        propertyModalBody.querySelector('#showReviewFormBtn').addEventListener('click', () => {
            alert('Login to review');
            propertyModal.hide();
            loginModal.show();
        });
    }

    propertyModal.show();
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

// Edit property redirect
window.editProperty = async (id) => {
    const property = properties.find(p => p.id === id);
    if (!property || currentUser.uid !== property.ownerId) return alert('Not authorized');
    localStorage.setItem('editProperty', JSON.stringify(property));
    window.location.href = 'creator.html';
};