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
    orderBy,
    Timestamp,
    getDoc,
    signOut,
    onAuthStateChanged
} from './firebase.js';

// Global state
let currentUser = null;
let chats = [];
let selectedChatId = null;
let selectedProperty = null;
let unsubscribeChats = null;
let unsubscribeMessages = null;

// DOM Elements
const chatList = document.getElementById('chatList');
const chatTitle = document.getElementById('chatTitle');
const chatMessages = document.getElementById('chatMessages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const suggestedMessages = document.getElementById('suggestedMessages');
const unreadCountBadge = document.getElementById('unreadCount');
const themeToggle = document.getElementById('theme-toggle');
const loginBtn = document.getElementById('loginBtn');
const registerBtn = document.getElementById('registerBtn');
const writePropertyLink = document.getElementById('writePropertyLink');
const createAnnounceLink = document.getElementById('createAnnounceLink');
const currentYearEl = document.getElementById('currentYear');

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    currentYearEl.textContent = new Date().getFullYear();
    setupEventListeners();
    checkThemePreference();
    initAuthListener();
    
    // Check if we're being redirected from a property to start a chat
    const urlParams = new URLSearchParams(window.location.search);
    const propertyId = urlParams.get('propertyId');
    const ownerId = urlParams.get('ownerId');
    
    if (propertyId && ownerId) {
        // We're being redirected to start a chat about a specific property
        localStorage.setItem('pendingChat', JSON.stringify({ propertyId, ownerId }));
    }
});

// Check theme preference
function checkThemePreference() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.checked = savedTheme === 'dark';
    document.getElementById('theme-label').textContent = savedTheme === 'dark' ? 'Dark' : 'Light';
}

// Toggle theme
function toggleTheme() {
    const theme = themeToggle.checked ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    document.getElementById('theme-label').textContent = theme === 'dark' ? 'Dark' : 'Light';
}

// Auth listener
function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user ? await getUserData(user.uid) : null;
        updateAuthUI();
        
        if (currentUser) {
            await initChats();
            
            // Handle pending chat creation
            const pendingChat = localStorage.getItem('pendingChat');
            if (pendingChat) {
                const { propertyId, ownerId } = JSON.parse(pendingChat);
                await createOrOpenChat(propertyId, ownerId);
                localStorage.removeItem('pendingChat');
                
                // Clear URL parameters
                window.history.replaceState({}, document.title, window.location.pathname);
            }
        } else {
            chatList.innerHTML = '<div class="p-4 text-center text-muted"><i class="bi bi-chat-dots display-4 d-block mb-3"></i>Please log in to view your chats</div>';
            chatMessages.innerHTML = '<div class="p-5 text-center text-muted"><i class="bi bi-chat-square-text display-1 d-block mb-3"></i>Select a chat to start messaging</div>';
            messageForm.classList.add('d-none');
            suggestedMessages.classList.add('d-none');
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
            alert('Logged out successfully');
        };
        registerBtn.innerHTML = '<i class="bi bi-person-circle"></i>';
        registerBtn.title = 'Profile';
        registerBtn.classList.remove('btn-primary');
        registerBtn.classList.add('text-now-primary', 'fs-4');
        registerBtn.onclick = () => window.location.href = 'profile.html';
        writePropertyLink.style.display = currentUser.isOwner ? 'block' : 'none';
        createAnnounceLink.style.display = currentUser.isAnnouncer ? 'block' : 'none';
    } else {
        loginBtn.innerHTML = 'Login';
        loginBtn.classList.remove('btn-danger');
        loginBtn.classList.add('btn-outline-primary');
        loginBtn.onclick = () => window.location.href = 'index.html';
        registerBtn.innerHTML = 'Register';
        registerBtn.classList.remove('btn-outline-primary', 'fs-4', 'text-now-primary');
        registerBtn.classList.add('btn-primary');
        registerBtn.onclick = () => window.location.href = 'index.html';
        writePropertyLink.style.display = 'none';
        createAnnounceLink.style.display = 'none';
    }
}

// Setup event listeners
function setupEventListeners() {
    themeToggle.addEventListener('change', toggleTheme);
    messageForm.addEventListener('submit', handleSendMessage);
    
    // Suggested messages
    suggestedMessages.querySelectorAll('.suggested-message').forEach(span => {
        span.addEventListener('click', () => {
            messageInput.value = span.textContent;
            handleSendMessage(new Event('submit'));
        });
    });
}

// Initialize chats
async function initChats() {
    try {
        if (unsubscribeChats) unsubscribeChats();
        
        // Query for chats where user is either the owner or the user
        const q1 = query(
            collection(db, 'chats'),
            where('ownerId', '==', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );
        
        const q2 = query(
            collection(db, 'chats'),
            where('userId', '==', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );
        
        // Listen to both queries
        let ownerChats = [];
        let userChats = [];
        
        onSnapshot(q1, async (snapshot) => {
            ownerChats = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const property = await getProperty(data.propertyId);
                const otherUser = await getUserData(data.userId);
                return {
                    id: docSnap.id,
                    ...data,
                    propertyTitle: property?.title || 'Unknown Property',
                    otherUserName: otherUser?.displayName || otherUser?.email || 'Unknown User',
                    role: 'owner'
                };
            }));
            updateChatsList(ownerChats, userChats);
        });
        
        onSnapshot(q2, async (snapshot) => {
            userChats = await Promise.all(snapshot.docs.map(async (docSnap) => {
                const data = docSnap.data();
                const property = await getProperty(data.propertyId);
                const otherUser = await getUserData(data.ownerId);
                return {
                    id: docSnap.id,
                    ...data,
                    propertyTitle: property?.title || 'Unknown Property',
                    otherUserName: otherUser?.displayName || otherUser?.email || 'Unknown User',
                    role: 'user'
                };
            }));
            updateChatsList(ownerChats, userChats);
        });
        
    } catch (err) {
        console.error('Error initializing chats:', err);
        chatList.innerHTML = '<div class="p-4 text-center text-danger"><i class="bi bi-exclamation-triangle display-4 d-block mb-3"></i>Error loading chats. Please refresh the page.</div>';
    }
}

// Update chats list
function updateChatsList(ownerChats, userChats) {
    chats = [...ownerChats, ...userChats].sort((a, b) => 
        (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0)
    );
    
    renderChatList();
    updateUnreadCount();
}

// Update unread count
function updateUnreadCount() {
    const totalUnread = chats.reduce((sum, chat) => {
        return sum + (chat.role === 'owner' ? (chat.unreadByOwner || 0) : (chat.unreadByUser || 0));
    }, 0);
    
    unreadCountBadge.textContent = totalUnread;
    unreadCountBadge.style.display = totalUnread > 0 ? 'inline' : 'none';
}

// Get property data
async function getProperty(propertyId) {
    try {
        const docRef = doc(db, 'properties', propertyId);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (err) {
        console.error('Error fetching property:', err);
        return null;
    }
}

// Create or open existing chat
async function createOrOpenChat(propertyId, ownerId) {
    try {
        // Check if chat already exists
        const existingChatQuery = query(
            collection(db, 'chats'),
            where('propertyId', '==', propertyId),
            where('userId', '==', currentUser.uid),
            where('ownerId', '==', ownerId)
        );
        
        const existingChatSnapshot = await getDocs(existingChatQuery);
        
        if (!existingChatSnapshot.empty) {
            // Chat exists, select it
            const existingChat = existingChatSnapshot.docs[0];
            selectChat(existingChat.id);
            return;
        }
        
        // Create new chat
        const property = await getProperty(propertyId);
        const owner = await getUserData(ownerId);
        
        if (!property || !owner) {
            alert('Error: Property or owner not found');
            return;
        }
        
        const chatDoc = await addDoc(collection(db, 'chats'), {
            propertyId,
            userId: currentUser.uid,
            ownerId,
            lastMessage: '',
            lastMessageTime: Timestamp.now(),
            unreadByUser: 0,
            unreadByOwner: 0,
            createdAt: Timestamp.now()
        });
        
        // Show suggested messages for new chat
        suggestedMessages.classList.remove('d-none');
        
        // Select the new chat
        selectChat(chatDoc.id);
        
    } catch (err) {
        console.error('Error creating/opening chat:', err);
        alert('Failed to start chat. Please try again.');
    }
}

// Render chat list
function renderChatList() {
    if (chats.length === 0) {
        chatList.innerHTML = '<div class="p-4 text-center text-muted text-now"><i class="bi bi-chat-dots display-4 d-block mb-3"></i>No chats yet.<br><small>Visit a property and click "Chat Owner" to start a conversation.</small></div>';
        return;
    }
    
    chatList.innerHTML = chats.map(chat => {
        const unreadCount = chat.role === 'owner' ? (chat.unreadByOwner || 0) : (chat.unreadByUser || 0);
        const isSelected = selectedChatId === chat.id;
        
        return `
            <div class="chat-item ${isSelected ? 'active' : ''} ${unreadCount > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                <div class="d-flex align-items-start">
                    <div class="flex-grow-1">
                        <h6 class="mb-1 fw-bold">${chat.propertyTitle}</h6>
                        <p class="mb-1 text-muted small text-now">Chat with ${chat.otherUserName}</p>
                        <p class="mb-0 text-muted small text-now">${chat.lastMessage || 'No messages yet'}</p>
                    </div>
                    <div class="text-end">
                        ${unreadCount > 0 ? `<span class="badge bg-primary rounded-pill">${unreadCount}</span>` : ''}
                        ${chat.lastMessageTime ? `<div class="text-muted small text-now">${formatTime(chat.lastMessageTime)}</div>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    // Add event listeners
    chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => {
            selectChat(item.dataset.chatId);
        });
    });
}

// Format time
function formatTime(timestamp) {
    if (!timestamp || !timestamp.seconds) return '';
    
    const date = new Date(timestamp.seconds * 1000);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 24 * 60 * 60 * 1000) { // Less than 24 hours
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
        return date.toLocaleDateString();
    }
}

// Select a chat
async function selectChat(chatId) {
    selectedChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    selectedProperty = await getProperty(chat.propertyId);
    
    // Update UI
    chatTitle.textContent = `${chat.propertyTitle} - Chat with ${chat.otherUserName}`;
    messageForm.classList.remove('d-none');
    
    // Show/hide suggested messages based on whether there are existing messages
    suggestedMessages.classList.toggle('d-none', !!chat.lastMessage);
    
    // Update chat list to show selection
    renderChatList();
    
    // Mark messages as read
    const currentUnread = chat.role === 'owner' ? (chat.unreadByOwner || 0) : (chat.unreadByUser || 0);
    if (currentUnread > 0) {
        const updateField = chat.role === 'owner' ? 'unreadByOwner' : 'unreadByUser';
        await updateDoc(doc(db, 'chats', chatId), {
            [updateField]: 0
        });
    }
    
    // Load messages
    loadMessages(chatId);
}

// Load messages for selected chat
function loadMessages(chatId) {
    if (unsubscribeMessages) unsubscribeMessages();
    
    const messagesQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        orderBy('timestamp', 'asc')
    );
    
    unsubscribeMessages = onSnapshot(messagesQuery, (snapshot) => {
        const messages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        renderMessages(messages);
        
        // Scroll to bottom
        setTimeout(() => {
            chatMessages.scrollTop = chatMessages.scrollHeight;
        }, 100);
    });
}

// Render messages
function renderMessages(messages) {
    if (messages.length === 0) {
        chatMessages.innerHTML = `
            <div class="p-4 text-center text-muted">
                <i class="bi bi-chat-square-text display-4 d-block mb-3"></i>
                No messages yet. Start the conversation!
            </div>
        `;
        return;
    }
    
    chatMessages.innerHTML = messages.map(message => {
        const isMe = message.senderId === currentUser.uid;
        const messageDate = new Date(message.timestamp.seconds * 1000);
        
        return `
            <div class="message ${isMe ? 'sent' : 'received'} mb-3">
                <div class="message-bubble">
                    <p class="mb-0">${escapeHtml(message.content)}</p>
                </div>
                <div class="message-time text-muted small ${isMe ? 'text-end' : 'text-start'}">
                    ${messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
            </div>
        `;
    }).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Handle sending message
async function handleSendMessage(e) {
    e.preventDefault();
    
    const content = messageInput.value.trim();
    if (!content || !selectedChatId) return;
    
    try {
        const chat = chats.find(c => c.id === selectedChatId);
        if (!chat) return;
        
        // Add message to subcollection
        await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
            content,
            senderId: currentUser.uid,
            senderName: currentUser.displayName || currentUser.email,
            timestamp: Timestamp.now()
        });
        
        // Update chat document
        const otherUserUnreadField = chat.role === 'owner' ? 'unreadByUser' : 'unreadByOwner';
        await updateDoc(doc(db, 'chats', selectedChatId), {
            lastMessage: content,
            lastMessageTime: Timestamp.now(),
            [otherUserUnreadField]: (chat[otherUserUnreadField] || 0) + 1
        });
        
        // Clear input
        messageInput.value = '';
        
        // Hide suggested messages after first message
        suggestedMessages.classList.add('d-none');
        
    } catch (err) {
        console.error('Error sending message:', err);
        alert('Failed to send message. Please try again.');
    }
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (unsubscribeChats) unsubscribeChats();
    if (unsubscribeMessages) unsubscribeMessages();
});
