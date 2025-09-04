if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("service-worker.js")
    .then(() => console.log("Service Worker registered"))
    .catch((err) => console.log("SW registration failed:", err));
}

// Dummy database
        const dummyDb = {
            users: [
                {
                    id: 1,
                    name: "John Doe",
                    email: "john@example.com",
                    password: "password123",
                    phone: "+1234567890",
                    isOwner: true
                },
                {
                    id: 2,
                    name: "Jane Smith",
                    email: "jane@example.com",
                    password: "password123",
                    phone: "+0987654321",
                    isOwner: false
                }
            ],
            properties: [
                {
                    id: 1,
                    title: "Modern Downtown Apartment",
                    description: "Beautiful modern apartment in the heart of downtown. Features floor-to-ceiling windows, high-end finishes, and stunning city views.",
                    price: 450000,
                    location: "Downtown",
                    type: "Apartment",
                    bedrooms: 2,
                    bathrooms: 2,
                    area: 1200,
                    tags: ["modern", "downtown", "luxury", "view"],
                    images: ["property1.webp", "property2.webp", "property3.webp"],
                    ownerId: 1,
                    rating: 4.5,
                    reviews: [
                        {
                            userId: 2,
                            userName: "Jane Smith",
                            rating: 5,
                            comment: "Amazing apartment with great views!",
                            date: "2023-05-15"
                        }
                    ]
                },
                {
                    id: 2,
                    title: "Suburban Family Home",
                    description: "Spacious family home in a quiet suburban neighborhood. Features a large backyard, updated kitchen, and finished basement.",
                    price: 650000,
                    location: "Suburbia",
                    type: "House",
                    bedrooms: 4,
                    bathrooms: 3,
                    area: 2400,
                    tags: ["family", "suburban", "backyard", "updated"],
                    images: ["property2.webp", "property1.webp", "property3.webp"],
                    ownerId: 1,
                    rating: 4.2,
                    reviews: [
                        {
                            userId: 2,
                            userName: "Jane Smith",
                            rating: 4,
                            comment: "Nice family home with plenty of space.",
                            date: "2023-06-20"
                        }
                    ]
                },
                {
                    id: 3,
                    title: "Lakeside Cottage",
                    description: "Charming cottage on the lake. Perfect for weekend getaways or as a permanent residence for those who love water views.",
                    price: 350000,
                    location: "Lakeside",
                    type: "Cottage",
                    bedrooms: 3,
                    bathrooms: 2,
                    area: 1500,
                    tags: ["lake", "cottage", "waterfront", "getaway"],
                    images: ["property3.webp", "property2.webp", "property1.webp"],
                    ownerId: 1,
                    rating: 4.8,
                    reviews: [
                        {
                            userId: 2,
                            userName: "Jane Smith",
                            rating: 5,
                            comment: "Absolutely loved the lake views!",
                            date: "2023-07-05"
                        }
                    ]
                }
            ]
        };

        // Current user state
        let currentUser = null;

        // DOM Elements
        const featuredPropertiesContainer = document.getElementById('featuredProperties');
        const propertyModal = new bootstrap.Modal(document.getElementById('propertyModal'));
        const propertyModalTitle = document.getElementById('propertyModalTitle');
        const propertyModalBody = document.getElementById('propertyModalBody');
        const loginModal = new bootstrap.Modal(document.getElementById('loginModal'));
        const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
        const themeToggle = document.getElementById('theme-toggle');
        const themeLabel = document.getElementById('theme-label');

        // Initialize the application
        document.addEventListener('DOMContentLoaded', function() {
            loadFeaturedProperties();
            setupEventListeners();
            checkThemePreference();
        });

        // Set up event listeners
        function setupEventListeners() {
            // Theme toggle
            themeToggle.addEventListener('change', toggleTheme);
            
            // Login/Register buttons
            document.getElementById('loginBtn').addEventListener('click', () => loginModal.show());
            document.getElementById('registerBtn').addEventListener('click', () => registerModal.show());
            
            // Switch between login and register modals
            document.getElementById('switchToRegister').addEventListener('click', function(e) {
                e.preventDefault();
                loginModal.hide();
                registerModal.show();
            });
            
            document.getElementById('switchToLogin').addEventListener('click', function(e) {
                e.preventDefault();
                registerModal.hide();
                loginModal.show();
            });
            
            // Form submissions
            document.getElementById('loginForm').addEventListener('submit', handleLogin);
            document.getElementById('registerForm').addEventListener('submit', handleRegister);
            
            // Search functionality
            document.getElementById('searchBtn').addEventListener('click', handleSearch);
            document.getElementById('searchInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    handleSearch();
                }
            });
        }

        // Load featured properties
        function loadFeaturedProperties() {
            featuredPropertiesContainer.innerHTML = '';
            
            dummyDb.properties.forEach(property => {
                const propertyCard = createPropertyCard(property);
                featuredPropertiesContainer.appendChild(propertyCard);
            });
        }

        // Create property card HTML
        function createPropertyCard(property) {
            const col = document.createElement('div');
            col.className = 'col-md-4 mb-4';
            
            // Generate star ratings
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.floor(property.rating)) {
                    stars += '<i class="bi bi-star-fill rating"></i>';
                } else if (i === Math.ceil(property.rating) && !Number.isInteger(property.rating)) {
                    stars += '<i class="bi bi-star-half rating"></i>';
                } else {
                    stars += '<i class="bi bi-star rating"></i>';
                }
            }
            
            col.innerHTML = `
                <div class="card h-100 property-card" data-id="${property.id}">
                    <img src="media/${property.images[0]}" class="property-image" alt="${property.title}">
                    <div class="card-body">
                        <h5 class="card-title">${property.title}</h5>
                        <p class="card-text text-now-primary fw-bold">$${property.price.toLocaleString()}</p>
                        <p class="card-text">
                            <i class="bi bi-geo-alt"></i> ${property.location}
                            <span class="ms-3"><i class="bi bi-house-door"></i> ${property.type}</span>
                        </p>
                        <p class="card-text">
                            <i class="bi bi-door-closed"></i> ${property.bedrooms} beds
                            <span class="ms-3"><i class="bi bi-droplet"></i> ${property.bathrooms} baths</span>
                            <span class="ms-3"><i class="bi bi-arrows-fullscreen"></i> ${property.area} sq ft</span>
                        </p>
                        <div class="mb-2">
                            ${stars} <span class="ms-1">${property.rating}</span>
                        </div>
                        <div class="mb-2">
                            ${property.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
                        </div>
                    </div>
                    <div class="card-footer bg-transparent">
                        <button class="btn btn-primary w-100 view-details-btn">View Details</button>
                    </div>
                </div>
            `;
            
            // Add event listener to view details button
            col.querySelector('.view-details-btn').addEventListener('click', () => {
                showPropertyDetails(property.id);
            });
            
            return col;
        }

        // Show property details in modal
        function showPropertyDetails(propertyId) {
            const property = dummyDb.properties.find(p => p.id === propertyId);
            if (!property) return;
            
            const owner = dummyDb.users.find(u => u.id === property.ownerId);
            
            // Generate star ratings
            let stars = '';
            for (let i = 1; i <= 5; i++) {
                if (i <= Math.floor(property.rating)) {
                    stars += '<i class="bi bi-star-fill rating"></i>';
                } else if (i === Math.ceil(property.rating) && !Number.isInteger(property.rating)) {
                    stars += '<i class="bi bi-star-half rating"></i>';
                } else {
                    stars += '<i class="bi bi-star rating"></i>';
                }
            }
            
            // Generate reviews HTML
            const reviewsHTML = property.reviews.map(review => {
                let reviewStars = '';
                for (let i = 1; i <= 5; i++) {
                    reviewStars += i <= review.rating ? 
                        '<i class="bi bi-star-fill rating"></i>' : 
                        '<i class="bi bi-star rating"></i>';
                }
                
                return `
                    <div class="comment">
                        <div class="d-flex justify-content-between">
                            <h6>${review.userName}</h6>
                            <small class="text-muted">${review.date}</small>
                        </div>
                        <div class="mb-2">${reviewStars}</div>
                        <p>${review.comment}</p>
                    </div>
                `;
            }).join('');
            
            propertyModalTitle.textContent = property.title;
            propertyModalBody.innerHTML = `
                <div class="row">
                    <div class="col-md-7">
                        <div id="propertyCarousel" class="carousel slide" data-bs-ride="carousel">
                            <div class="carousel-inner">
                                ${property.images.map((img, index) => `
                                    <div class="carousel-item ${index === 0 ? 'active' : ''}">
                                        <img src="media/${img}" class="property-detail-image w-100" alt="${property.title}">
                                    </div>
                                `).join('')}
                            </div>
                            <button class="carousel-control-prev" type="button" data-bs-target="#propertyCarousel" data-bs-slide="prev">
                                <span class="carousel-control-prev-icon" aria-hidden="true"></span>
                                <span class="visually-hidden">Previous</span>
                            </button>
                            <button class="carousel-control-next" type="button" data-bs-target="#propertyCarousel" data-bs-slide="next">
                                <span class="carousel-control-next-icon" aria-hidden="true"></span>
                                <span class="visually-hidden">Next</span>
                            </button>
                        </div>
                    </div>
                    <div class="col-md-5">
                        <h3 class="text-now-primary">$${property.price.toLocaleString()}</h3>
                        <p class="mb-2"><i class="bi bi-geo-alt"></i> ${property.location}</p>
                        <div class="d-flex mb-3">
                            <span class="me-3"><i class="bi bi-door-closed"></i> ${property.bedrooms} beds</span>
                            <span class="me-3"><i class="bi bi-droplet"></i> ${property.bathrooms} baths</span>
                            <span><i class="bi bi-arrows-fullscreen"></i> ${property.area} sq ft</span>
                        </div>
                        <div class="mb-3">
                            ${stars} <span class="ms-1">${property.rating} (${property.reviews.length} reviews)</span>
                        </div>
                        <div class="mb-3">
                            ${property.tags.map(tag => `<span class="badge bg-secondary me-1">${tag}</span>`).join('')}
                        </div>
                        <p>${property.description}</p>
                        <div class="d-grid gap-2">
                            <a href="https://wa.me/${owner.phone}?text=Hi, I'm interested in your property: ${property.title}" 
                               class="btn btn-success" target="_blank">
                                <i class="bi bi-whatsapp"></i> Contact Owner via WhatsApp
                            </a>
                            <button class="btn btn-accent" id="showReviewFormBtn">Add Review</button>
                        </div>
                    </div>
                </div>
                <hr>
                <div class="row mt-4">
                    <div class="col-12">
                        <h4>Reviews</h4>
                        <div class="comment-section" id="reviewsContainer">
                            ${reviewsHTML || '<p>No reviews yet.</p>'}
                        </div>
                    </div>
                </div>
                <div class="row mt-4 d-none" id="reviewFormContainer">
                    <div class="col-12">
                        <h5>Add Your Review</h5>
                        <form id="reviewForm">
                            <div class="mb-3">
                                <label class="form-label">Rating</label>
                                <div class="rating-input">
                                    <i class="bi bi-star fs-4 rating" data-value="1"></i>
                                    <i class="bi bi-star fs-4 rating" data-value="2"></i>
                                    <i class="bi bi-star fs-4 rating" data-value="3"></i>
                                    <i class="bi bi-star fs-4 rating" data-value="4"></i>
                                    <i class="bi bi-star fs-4 rating" data-value="5"></i>
                                </div>
                                <input type="hidden" id="reviewRating" value="5">
                            </div>
                            <div class="mb-3">
                                <label for="reviewComment" class="form-label">Comment</label>
                                <textarea class="form-control" id="reviewComment" rows="3" required></textarea>
                            </div>
                            <button type="submit" class="btn btn-primary">Submit Review</button>
                            <button type="button" class="btn btn-secondary" id="cancelReviewBtn">Cancel</button>
                        </form>
                    </div>
                </div>
            `;
            
            // Add event listeners for review functionality
            if (currentUser) {
                const showReviewFormBtn = propertyModalBody.querySelector('#showReviewFormBtn');
                const reviewFormContainer = propertyModalBody.querySelector('#reviewFormContainer');
                const cancelReviewBtn = propertyModalBody.querySelector('#cancelReviewBtn');
                const reviewForm = propertyModalBody.querySelector('#reviewForm');
                const ratingStars = propertyModalBody.querySelectorAll('.rating-input .bi-star');
                
                showReviewFormBtn.addEventListener('click', () => {
                    reviewFormContainer.classList.remove('d-none');
                });
                
                cancelReviewBtn.addEventListener('click', () => {
                    reviewFormContainer.classList.add('d-none');
                });
                
                ratingStars.forEach(star => {
                    star.addEventListener('click', () => {
                        const value = parseInt(star.getAttribute('data-value'));
                        propertyModalBody.querySelector('#reviewRating').value = value;
                        
                        ratingStars.forEach(s => {
                            const starValue = parseInt(s.getAttribute('data-value'));
                            if (starValue <= value) {
                                s.classList.add('bi-star-fill');
                                s.classList.remove('bi-star');
                            } else {
                                s.classList.add('bi-star');
                                s.classList.remove('bi-star-fill');
                            }
                        });
                    });
                });
                
                reviewForm.addEventListener('submit', function(e) {
                    e.preventDefault();
                    const rating = parseInt(propertyModalBody.querySelector('#reviewRating').value);
                    const comment = propertyModalBody.querySelector('#reviewComment').value;
                    
                    // Add the review
                    property.reviews.push({
                        userId: currentUser.id,
                        userName: currentUser.name,
                        rating: rating,
                        comment: comment,
                        date: new Date().toISOString().split('T')[0]
                    });
                    
                    // Update the rating average
                    const totalRating = property.reviews.reduce((sum, review) => sum + review.rating, 0);
                    property.rating = totalRating / property.reviews.length;
                    
                    // Show success message and reload details
                    alert('Review submitted successfully!');
                    propertyModal.hide();
                    showPropertyDetails(propertyId);
                    propertyModal.show();
                });
            } else {
                propertyModalBody.querySelector('#showReviewFormBtn').addEventListener('click', () => {
                    alert('Please login to add a review.');
                    propertyModal.hide();
                    loginModal.show();
                });
            }
            
            propertyModal.show();
        }

        // Handle search
        function handleSearch() {
            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const forSale = document.getElementById('forSaleCheck').checked;
            const forRent = document.getElementById('forRentCheck').checked;
            
            // Filter properties based on search criteria
            const filteredProperties = dummyDb.properties.filter(property => {
                const matchesSearch = property.title.toLowerCase().includes(searchTerm) ||
                                     property.description.toLowerCase().includes(searchTerm) ||
                                     property.location.toLowerCase().includes(searchTerm) ||
                                     property.tags.some(tag => tag.toLowerCase().includes(searchTerm));
                
                // For simplicity, we'll assume all properties are for sale in this demo
                const matchesType = (forSale && property.type !== 'Rental') || 
                                  (forRent && property.type === 'Rental');
                
                return matchesSearch && matchesType;
            });
            
            // Display filtered results
            featuredPropertiesContainer.innerHTML = '';
            
            if (filteredProperties.length === 0) {
                featuredPropertiesContainer.innerHTML = `
                    <div class="col-12 text-center py-5">
                        <i class="bi bi-search display-1 text-muted"></i>
                        <h3 class="mt-3">No properties found</h3>
                        <p>Try adjusting your search criteria</p>
                    </div>
                `;
            } else {
                filteredProperties.forEach(property => {
                    const propertyCard = createPropertyCard(property);
                    featuredPropertiesContainer.appendChild(propertyCard);
                });
            }
        }

        // Handle login
        function handleLogin(e) {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;
            
            const user = dummyDb.users.find(u => u.email === email && u.password === password);
            
            if (user) {
                currentUser = user;
                alert(`Welcome back, ${user.name}!`);
                loginModal.hide();
                updateAuthUI();
            } else {
                alert('Invalid email or password');
            }
        }

        // Handle registration
        function handleRegister(e) {
            e.preventDefault();
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const phone = document.getElementById('registerPhone').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('registerConfirmPassword').value;
            
            if (password !== confirmPassword) {
                alert('Passwords do not match');
                return;
            }
            
            if (dummyDb.users.some(u => u.email === email)) {
                alert('Email already registered');
                return;
            }
            
            // Create new user
            const newUser = {
                id: Math.max(...dummyDb.users.map(u => u.id)) + 1,
                name: name,
                email: email,
                password: password,
                phone: phone,
                isOwner: false
            };
            
            dummyDb.users.push(newUser);
            currentUser = newUser;
            
            alert('Registration successful! You are now logged in.');
            registerModal.hide();
            updateAuthUI();
        }

        // Update UI based on authentication status
        function updateAuthUI() {
            if (currentUser) {
                document.getElementById('loginBtn').textContent = currentUser.name;
                document.getElementById('registerBtn').textContent = 'Logout';
                
                document.getElementById('registerBtn').addEventListener('click', function() {
                    currentUser = null;
                    alert('You have been logged out');
                    updateAuthUI();
                });
            } else {
                document.getElementById('loginBtn').textContent = 'Login';
                document.getElementById('registerBtn').textContent = 'Register';
            }
        }

        // Theme functionality
        function checkThemePreference() {
            const savedTheme = localStorage.getItem('theme') || 'light';
            if (savedTheme === 'dark') {
                document.documentElement.setAttribute('data-theme', 'dark');
                themeToggle.checked = true;
                themeLabel.textContent = 'Light Mode';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                themeToggle.checked = false;
                themeLabel.textContent = 'Dark Mode';
            }
        }

        function toggleTheme() {
            if (themeToggle.checked) {
                document.documentElement.setAttribute('data-theme', 'dark');
                localStorage.setItem('theme', 'dark');
                themeLabel.textContent = 'Light Mode';
            } else {
                document.documentElement.setAttribute('data-theme', 'light');
                localStorage.setItem('theme', 'light');
                themeLabel.textContent = 'Dark Mode';
            }
        }