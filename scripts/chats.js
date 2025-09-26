import {
    auth,
    db,
    collection,
    addDoc,
    getDocs,
    updateDoc,
    deleteDoc,
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
let unsubscribeChats = null;
let unsubscribeMessages = null;
let replyingToId = null;
let editingMessageId = null;

// DOM Elements
const chatList = document.getElementById('chatList');
const chatTitle = document.getElementById('chatTitle');
const chatMessages = document.getElementById('chatMessages');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const suggestedMessages = document.getElementById('suggestedMessages');
const unreadCountBadge = document.getElementById('unreadCount');
const themeToggle = document.getElementById('theme-toggle');
const themeLabel = document.getElementById('theme-label');
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
});

// Auth listener
function initAuthListener() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user ? await getUserData(user.uid) : null;
        updateAuthUI();
        if (currentUser) {
            await initChats();
        } else {
            chatList.innerHTML = '<div class="p-3 text-center">Please log in to view chats.</div>';
            chatMessages.innerHTML = '';
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
    }
}

// Setup event listeners
function setupEventListeners() {
    themeToggle.addEventListener('change', toggleTheme);
    messageForm.addEventListener('submit', handleSendMessage);
    suggestedMessages.querySelectorAll('.suggested-message').forEach(span => {
        span.addEventListener('click', () => {
            messageInput.value = span.textContent;
            replyingToId = null; // Clear reply context for suggested messages
            handleSendMessage(new Event('submit'));
        });
    });
}

// Initialize chats
async function initChats() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const propertyId = urlParams.get('propertyId');
        const ownerId = urlParams.get('ownerId');

        if (propertyId && ownerId && currentUser.uid !== ownerId) {
            await startChat(propertyId, ownerId);
        }

        if (unsubscribeChats) unsubscribeChats();
        const q = query(
            collection(db, 'chats'),
            where(currentUser.isOwner ? 'ownerId' : 'userId', '==', currentUser.uid),
            orderBy('lastMessageTime', 'desc')
        );
        unsubscribeChats = onSnapshot(q, async (snapshot) => {
            try {
                chats = [];
                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    const property = await getProperty(data.propertyId);
                    chats.push({ id: doc.id, ...data, propertyTitle: property?.title || 'Unknown Property' });
                }
                renderChatList();
                const totalUnread = chats.reduce((sum, chat) => sum + (currentUser.isOwner ? chat.unreadByOwner || 0 : chat.unreadByUser || 0), 0);
                unreadCountBadge.textContent = totalUnread;
                unreadCountBadge.style.display = totalUnread > 0 ? 'inline' : 'none';
                if (propertyId && ownerId) {
                    const chat = chats.find(c => c.propertyId === propertyId && (c.userId === currentUser.uid || c.ownerId === currentUser.uid));
                    if (chat) selectChat(chat.id);
                }
            } catch (err) {
                console.error('Error processing chats snapshot:', err);
                chatList.innerHTML = '<div class="p-3 text-center">Error loading chats. Please try again later.</div>';
            }
        }, (err) => {
            console.error('Error in chats listener:', err);
            chatList.innerHTML = '<div class="p-3 text-center">Error loading chats. Please ensure Firestore indexes are set up correctly.</div>';
        });
    } catch (err) {
        console.error('Error initializing chats:', err);
        chatList.innerHTML = '<div class="p-3 text-center">Error initializing chats. Please try again.</div>';
    }
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

// Start a new chat
async function startChat(propertyId, ownerId) {
    try {
        const q = query(
            collection(db, 'chats'),
            where('propertyId', '==', propertyId),
            where('userId', '==', currentUser.uid),
            where('ownerId', '==', ownerId)
        );
        const snapshot = await getDocs(q);
        if (!snapshot.empty) return; // Chat already exists

        await addDoc(collection(db, 'chats'), {
            propertyId,
            userId: currentUser.uid,
            ownerId,
            lastMessage: '',
            lastMessageTime: Timestamp.now(),
            unreadByUser: 0,
            unreadByOwner: 0
        });
    } catch (err) {
        console.error('Error starting chat:', err);
        alert('Failed to start chat');
    }
}

// Render chat list
async function renderChatList() {
    chatList.innerHTML = chats.length ? 
        chats.map(chat => {
            const unreadCount = currentUser.isOwner ? chat.unreadByOwner || 0 : chat.unreadByUser || 0;
            return `
                <div class="chat-item ${unreadCount > 0 ? 'unread' : ''}" data-chat-id="${chat.id}">
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <h6 class="mb-1">${chat.propertyTitle}</h6>
                            <p class="mb-0 text-muted" style="font-size: 0.9rem;">${chat.lastMessage || 'No messages yet'}</p>
                        </div>
                        <div class="d-flex align-items-center gap-2">
                            ${unreadCount > 0 ? `<span class="badge bg-danger">${unreadCount}</span>` : ''}
                            <button class="btn btn-sm btn-outline-danger delete-chat" data-chat-id="${chat.id}">
                                <i class="bi bi-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('') :
        '<div class="p-3 text-center">No chats yet.</div>';

    chatList.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => selectChat(item.dataset.chatId));
    });
    chatList.querySelectorAll('.delete-chat').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('Are you sure you want to delete this chat?')) {
                deleteChat(btn.dataset.chatId);
            }
        });
    });
}

// Delete a chat thread
async function deleteChat(chatId) {
    try {
        const chatRef = doc(db, 'chats', chatId);
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const messagesSnapshot = await getDocs(messagesRef);
        for (const msgDoc of messagesSnapshot.docs) {
            await deleteDoc(doc(db, 'chats', chatId, 'messages', msgDoc.id));
        }
        await deleteDoc(chatRef);
        if (selectedChatId === chatId) {
            selectedChatId = null;
            chatMessages.innerHTML = '';
            chatTitle.textContent = 'Select a chat';
            messageForm.classList.add('d-none');
            suggestedMessages.classList.add('d-none');
        }
    } catch (err) {
        console.error('Error deleting chat:', err);
        alert('Failed to delete chat');
    }
}

// Select a chat
async function selectChat(chatId) {
    selectedChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    if (!chat) return;

    chatTitle.textContent = chat.propertyTitle;
    messageForm.classList.remove('d-none');
    suggestedMessages.classList.toggle('d-none', chat.lastMessage !== '');
    if (unsubscribeMessages) unsubscribeMessages();
    const q = query(collection(db, 'chats', chatId, 'messages'), orderBy('timestamp', 'asc'));
    unsubscribeMessages = onSnapshot(q, async (snapshot) => {
        const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderMessages(messages, chat);
        // Mark messages as read
        if ((currentUser.isOwner && chat.unreadByOwner > 0) || (!currentUser.isOwner && chat.unreadByUser > 0)) {
            await updateDoc(doc(db, 'chats', chatId), {
                [currentUser.isOwner ? 'unreadByOwner' : 'unreadByUser']: 0
            });
        }
        // Scroll to bottom
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });
}

// Render messages
async function renderMessages(messages, chat) {
    chatMessages.innerHTML = messages.map((msg) => {
        const isMe = msg.senderId === currentUser.uid;
        const repliedToMsg = msg.repliedToId ? messages.find(m => m.id === msg.repliedToId) : null;
        return `
            <div class="message ${isMe ? 'me' : 'other'}" data-message-id="${msg.id}">
                ${repliedToMsg ? `
                    <div class="message-content bg-light p-2 mb-1 rounded" style="font-size: 0.9rem;">
                        <p class="mb-0 text-muted">${repliedToMsg.content}</p>
                    </div>
                ` : ''}
                <div class="message-content">
                    <p class="mb-0">${msg.content}${msg.edited ? ' <small>(edited)</small>' : ''}</p>
                </div>
                <div class="message-meta ${isMe ? 'text-end' : 'text-start'}">
                    ${new Date(msg.timestamp.toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    ${isMe ? `
                        <span class="message-actions">
                            <i class="bi bi-reply ms-2" style="cursor: pointer;" title="Reply" onclick="startReply('${msg.id}')"></i>
                            <i class="bi bi-pencil ms-2" style="cursor: pointer;" title="Edit" onclick="startEdit('${msg.id}', '${msg.content.replace(/'/g, "\\'")}')"></i>
                            <i class="bi bi-trash ms-2" style="cursor: pointer;" title="Delete" onclick="deleteMessage('${msg.id}', '${chat.id}')"></i>
                        </span>
                    ` : `
                        <span class="message-actions">
                            <i class="bi bi-reply ms-2" style="cursor: pointer;" title="Reply" onclick="startReply('${msg.id}')"></i>
                        </span>
                    `}
                </div>
            </div>
        `;
    }).join('');
}

// Start replying to a message
window.startReply = function (messageId) {
    replyingToId = messageId;
    messageInput.focus();
    messageInput.placeholder = 'Type your reply...';
};

// Start editing a message
window.startEdit = function (messageId, content) {
    editingMessageId = messageId;
    messageInput.value = content;
    messageInput.focus();
    messageInput.placeholder = 'Edit your message...';
};

// Delete a message
window.deleteMessage = async function (messageId, chatId) {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
        await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
        // Update last message
        const messagesRef = collection(db, 'chats', chatId, 'messages');
        const q = query(messagesRef, orderBy('timestamp', 'desc'));
        const snapshot = await getDocs(q);
        const lastMessage = snapshot.docs[0]?.data()?.content || '';
        await updateDoc(doc(db, 'chats', chatId), {
            lastMessage,
            lastMessageTime: Timestamp.now()
        });
    } catch (err) {
        console.error('Error deleting message:', err);
        alert('Failed to delete message');
    }
};

// Send or edit a message
async function handleSendMessage(e) {
    e.preventDefault();
    if (!selectedChatId || !messageInput.value.trim()) return;

    try {
        const chatRef = doc(db, 'chats', selectedChatId);
        const chat = chats.find(c => c.id === selectedChatId);
        if (editingMessageId) {
            // Edit existing message
            await updateDoc(doc(db, 'chats', selectedChatId, 'messages', editingMessageId), {
                content: messageInput.value.trim(),
                edited: true,
                timestamp: Timestamp.now()
            });
            editingMessageId = null;
        } else {
            // Send new message
            await addDoc(collection(db, 'chats', selectedChatId, 'messages'), {
                senderId: currentUser.uid,
                content: messageInput.value.trim(),
                timestamp: Timestamp.now(),
                repliedToId: replyingToId || null,
                edited: false
            });
            // Update unread count for the other party
            await updateDoc(chatRef, {
                lastMessage: messageInput.value.trim(),
                lastMessageTime: Timestamp.now(),
                [currentUser.isOwner ? 'unreadByUser' : 'unreadByOwner']: (currentUser.isOwner ? chat.unreadByUser || 0 : chat.unreadByOwner || 0) + 1
            });
            replyingToId = null;
        }
        messageInput.value = '';
        messageInput.placeholder = 'Type a message...';
    } catch (err) {
        console.error('Error sending/editing message:', err);
        alert('Failed to send/edit message');
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