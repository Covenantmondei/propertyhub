// Chat JavaScript

let currentConversationId = null;
let conversations = [];
let websocket = null;
let currentUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Chat page loaded');
    
    // Check authentication
    if (!isAuthenticated()) {
        showNotification('Please login to access messages', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    currentUser = getUser();
    
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
        setTimeout(async () => {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.error('Error requesting notification permission:', error);
            }
        }, 1000);
    }
    
    // Initialize chat
    initializeChat();
    
    // Setup event listeners
    setupEventListeners();
    
    // Connect WebSocket
    connectWebSocket();
    
    // Auto-refresh conversations every 30 seconds
    setInterval(loadConversations, 30000);
});

async function initializeChat() {
    await loadConversations();
    
    // Check if there's a conversation ID in URL
    const urlParams = new URLSearchParams(window.location.search);
    const conversationId = urlParams.get('conversation');
    
    if (conversationId) {
        await loadConversation(parseInt(conversationId));
    }
}

function setupEventListeners() {
    // Mobile nav toggle
    const navToggle = document.getElementById('navToggle');
    const navMenu = document.getElementById('navMenu');
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // Profile button
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            const user = getUser();
            if (user) {
                if (user.role === 'agent') {
                    window.location.href = 'agent-dashboard.html';
                } else if (user.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    window.location.href = 'home.html';
                }
            }
        });
    }
    
    // List property button (for agents)
    const listPropertyBtn = document.getElementById('list-property-btn');
    if (listPropertyBtn) {
        const user = getUser();
        if (user && user.role === 'agent') {
            listPropertyBtn.style.display = 'block';
            listPropertyBtn.addEventListener('click', () => {
                window.location.href = 'new-property.html';
            });
        }
    }
    
    // Refresh conversations button
    // Refresh button removed from UI
    
    // Search conversations
    document.getElementById('conversation-search').addEventListener('input', (e) => {
        filterConversations(e.target.value);
    });
    
    // Message input
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-message-btn');
    
    messageInput.addEventListener('input', () => {
        // Auto-resize textarea
        messageInput.style.height = 'auto';
        messageInput.style.height = messageInput.scrollHeight + 'px';
        
        // Enable/disable send button
        sendBtn.disabled = !messageInput.value.trim();
    });
    
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (!sendBtn.disabled) {
                sendMessage();
            }
        }
    });
    
    sendBtn.addEventListener('click', sendMessage);
    
    // Close chat button (mobile)
    document.getElementById('close-chat-btn').addEventListener('click', () => {
        closeActiveChat();
    });
    
    // View property button
    document.getElementById('view-property-btn').addEventListener('click', () => {
        if (currentConversationId) {
            const conv = conversations.find(c => c.id === currentConversationId);
            if (conv) {
                window.open(`property.html?id=${conv.property_id}`, '_blank');
            }
        }
    });
    
    // Add mobile back button handler
    document.getElementById('mobile-back-btn')?.addEventListener('click', closeActiveChat);
}

async function loadConversations() {
    const loadingEl = document.getElementById('conversations-loading');
    const emptyEl = document.getElementById('conversations-empty');
    const listEl = document.getElementById('conversations-list');
    
    try {
        // Don't show loading on refresh, only on initial load
        
        conversations = await apiCall('/chat/conversations');
        
        loadingEl.style.display = 'none';
        
        if (conversations.length === 0) {
            emptyEl.style.display = 'flex';
            // Clear any existing items
            Array.from(listEl.children).forEach(child => {
                if (!child.id.includes('loading') && !child.id.includes('empty')) {
                    child.remove();
                }
            });
        } else {
            emptyEl.style.display = 'none';
            renderConversations(conversations);
        }
        
    } catch (error) {
        console.error('Failed to load conversations:', error);
        loadingEl.style.display = 'none';
        showNotification('Failed to load conversations', 'error');
    }
}

function renderConversations(conversationsList) {
    const listEl = document.getElementById('conversations-list');
    
    // Clear existing conversation items (keep loading and empty states)
    Array.from(listEl.children).forEach(child => {
        if (!child.id.includes('loading') && !child.id.includes('empty')) {
            child.remove();
        }
    });
    
    conversationsList.forEach(conv => {
        const item = createConversationItem(conv);
        listEl.appendChild(item);
    });
}

function createConversationItem(conv) {
    const div = document.createElement('div');
    div.className = 'conversation-item';
    if (currentConversationId === conv.id) {
        div.classList.add('active');
    }
    div.dataset.conversationId = conv.id;
    
    const initials = conv.other_user_name.split(' ').map(n => n[0]).join('').toUpperCase();
    const timeAgo = formatTimeAgo(conv.last_message_at);
    
    div.innerHTML = `
        <div class="conversation-avatar">${initials}</div>
        <div class="conversation-details">
            <div class="conversation-header">
                <span class="conversation-name">${conv.other_user_name}</span>
                <span class="conversation-time">${timeAgo}</span>
            </div>
            <div class="conversation-property">${conv.property_title}</div>
            <div class="conversation-preview">${conv.last_message_preview || 'No messages yet'}</div>
        </div>
        ${conv.unread_count > 0 ? `<span class="unread-badge">${conv.unread_count}</span>` : ''}
    `;
    
    div.addEventListener('click', () => loadConversation(conv.id));
    
    return div;
}

async function loadConversation(conversationId) {
    currentConversationId = conversationId;
    
    // Update active state in sidebar
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
        if (parseInt(item.dataset.conversationId) === conversationId) {
            item.classList.add('active');
        }
    });
    
    // Show chat area
    document.getElementById('chat-welcome').style.display = 'none';
    document.getElementById('active-chat').style.display = 'flex';
    
    // Show loading
    const messagesContainer = document.getElementById('messages-container');
    const loadingEl = document.getElementById('messages-loading');
    loadingEl.style.display = 'flex';
    
    // Hide sidebar on mobile
    if (window.innerWidth <= 768) {
        document.querySelector('.conversations-sidebar').classList.add('hidden');
    }
    
    try {
        const conversationData = await apiCall(`/chat/conversations/${conversationId}`);
        
        loadingEl.style.display = 'none';
        
        // Update header
        const initials = conversationData.other_user_name.split(' ').map(n => n[0]).join('').toUpperCase();
        const avatarEl = document.getElementById('chat-user-avatar');
        avatarEl.innerHTML = `<span>${initials}</span>`;
        
        const userNameEl = document.getElementById('chat-user-name');
        userNameEl.textContent = conversationData.other_user_name;
        
        // Store other user ID and setup profile click handler
        window.currentChatUserId = conversationData.other_user_id;
        window.currentChatUserRole = conversationData.other_user_role || 'buyer'; // Assume buyer if not specified
        
        // Add click handler to view profile
        userNameEl.onclick = () => viewChatUserProfile();
        userNameEl.style.cursor = 'pointer';
        
        document.getElementById('chat-property-info').textContent = conversationData.property_title;
        
        // Render messages
        renderMessages(conversationData.messages);
        
        // Update conversation item to remove unread badge
        const convItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
        if (convItem) {
            const badge = convItem.querySelector('.unread-badge');
            if (badge) badge.remove();
        }
        
        // Update conversation in local array
        const convIndex = conversations.findIndex(c => c.id === conversationId);
        if (convIndex !== -1) {
            conversations[convIndex].unread_count = 0;
        }
        
    } catch (error) {
        console.error('Failed to load conversation:', error);
        loadingEl.style.display = 'none';
        showNotification('Failed to load conversation', 'error');
    }
}

// View the profile of the user you're chatting with
function viewChatUserProfile() {
    if (!window.currentChatUserId) {
        showNotification('User information not available', 'error');
        return;
    }
    
    const currentUserData = getUser();
    
    // If current user is a buyer viewing an agent's profile
    if (currentUserData.role === 'buyer' && window.currentChatUserRole === 'agent') {
        window.location.href = `agent-profile.html?agent_id=${window.currentChatUserId}`;
    }
    // If current user is an agent viewing a buyer's profile
    else if (currentUserData.role === 'agent' && window.currentChatUserRole === 'buyer') {
        // Show buyer profile modal or navigate to buyer profile page
        showBuyerProfileModal(window.currentChatUserId);
    }
    else {
        showNotification('Profile viewing not available for this user type', 'info');
    }
}

// Show buyer profile information in a modal
async function showBuyerProfileModal(buyerId) {
    try {
        const buyer = await apiCall(`/auth/users/${buyerId}`);
        
        if (!buyer || !buyer.first_name) {
            showNotification('Failed to load buyer profile', 'error');
            return;
        }
        
        // Construct full name from first_name and last_name
        const fullName = `${buyer.first_name || ''} ${buyer.last_name || ''}`.trim();
        const initials = `${buyer.first_name?.[0] || ''}${buyer.last_name?.[0] || ''}`.toUpperCase();
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            padding: 20px;
        `;
        
        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 30px;
            max-width: 500px;
            width: 100%;
            max-height: 80vh;
            overflow-y: auto;
            position: relative;
        `;
        
        modalContent.innerHTML = `
            <button onclick="this.closest('.modal-overlay').remove()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
            
            <div style="text-align: center; margin-bottom: 25px;">
                <div style="width: 80px; height: 80px; border-radius: 50%; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); display: inline-flex; align-items: center; justify-content: center; color: white; font-size: 32px; font-weight: bold; margin-bottom: 15px;">
                    ${initials}
                </div>
                <h2 style="margin: 0 0 5px 0; color: #2d3748;">${fullName}</h2>
                <p style="color: #718096; margin: 0;">Buyer</p>
            </div>
            
            <div style="background: #f7fafc; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
                <div style="margin-bottom: 15px;">
                    <label style="display: block; color: #4a5568; font-size: 14px; margin-bottom: 5px; font-weight: 500;">Email</label>
                    <p style="margin: 0; color: #2d3748;">${buyer.email}</p>
                </div>
                
                ${buyer.phone ? `
                <div style="margin-bottom: 15px;">
                    <label style="display: block; color: #4a5568; font-size: 14px; margin-bottom: 5px; font-weight: 500;">Phone</label>
                    <p style="margin: 0; color: #2d3748;">${buyer.phone}</p>
                </div>
                ` : ''}
                
                <div style="margin-bottom: 15px;">
                    <label style="display: block; color: #4a5568; font-size: 14px; margin-bottom: 5px; font-weight: 500;">Member Since</label>
                    <p style="margin: 0; color: #2d3748;">${new Date(buyer.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                
                ${buyer.is_verified ? `
                <div style="display: inline-flex; align-items: center; background: #c6f6d5; color: #22543d; padding: 6px 12px; border-radius: 20px; font-size: 14px; font-weight: 500;">
                    <span style="margin-right: 5px;">✓</span> Verified Buyer
                </div>
                ` : ''}
            </div>
        `;
        
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
    } catch (error) {
        console.error('Failed to load buyer profile:', error);
        showNotification('Failed to load buyer profile', 'error');
    }
}

function renderMessages(messages) {
    const container = document.getElementById('messages-container');
    
    // Clear existing messages (except loading indicator)
    Array.from(container.children).forEach(child => {
        if (child.id !== 'messages-loading') {
            child.remove();
        }
    });
    
    let lastDate = null;
    
    messages.forEach(msg => {
        const msgDate = new Date(msg.created_at).toDateString();
        
        // Add date divider if date changed
        if (msgDate !== lastDate) {
            container.appendChild(createDateDivider(msg.created_at));
            lastDate = msgDate;
        }
        
        container.appendChild(createMessageElement(msg));
    });
    
    // Scroll to bottom
    scrollToBottom();
}

function createDateDivider(date) {
    const div = document.createElement('div');
    div.className = 'message-date-divider';
    
    const dateObj = new Date(date);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    let dateText;
    if (dateObj.toDateString() === today.toDateString()) {
        dateText = 'Today';
    } else if (dateObj.toDateString() === yesterday.toDateString()) {
        dateText = 'Yesterday';
    } else {
        dateText = dateObj.toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });
    }
    
    div.innerHTML = `<span>${dateText}</span>`;
    return div;
}

function createMessageElement(msg) {
    const div = document.createElement('div');
    const isSent = msg.sender_id === currentUser.user_id;
    div.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(msg.created_at).toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true 
    });
    
    div.innerHTML = `
        <div class="message-bubble">
            <div class="message-content">${escapeHtml(msg.content)}</div>
            <span class="message-time">${time}</span>
        </div>
    `;
    
    return div;
}

async function sendMessage() {
    if (!currentConversationId) return;
    
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    
    if (!content) return;
    
    const sendBtn = document.getElementById('send-message-btn');
    sendBtn.disabled = true;
    input.disabled = true;
    
    try {
        const message = await apiCall(`/chat/conversations/${currentConversationId}/messages`, {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        
        // Add message to UI
        const container = document.getElementById('messages-container');
        
        // Check if we need a date divider
        const lastMessage = container.querySelector('.message:last-of-type');
        if (lastMessage) {
            const lastDate = new Date(lastMessage.dataset.date || Date.now()).toDateString();
            const currentDate = new Date().toDateString();
            if (lastDate !== currentDate) {
                container.appendChild(createDateDivider(new Date()));
            }
        } else {
            container.appendChild(createDateDivider(new Date()));
        }
        
        const msgElement = createMessageElement({
            ...message,
            sender_id: currentUser.user_id
        });
        msgElement.dataset.date = new Date().toISOString();
        container.appendChild(msgElement);
        
        // Clear input
        input.value = '';
        input.style.height = 'auto';
        
        // Update conversation preview in sidebar
        updateConversationPreview(currentConversationId, content);
        
        // Scroll to bottom
        scrollToBottom();
        
    } catch (error) {
        console.error('Failed to send message:', error);
        showNotification('Failed to send message', 'error');
    } finally {
        sendBtn.disabled = false;
        input.disabled = false;
        input.focus();
    }
}

function updateConversationPreview(conversationId, preview) {
    const convItem = document.querySelector(`[data-conversation-id="${conversationId}"]`);
    if (convItem) {
        const previewEl = convItem.querySelector('.conversation-preview');
        if (previewEl) {
            previewEl.textContent = preview;
        }
        
        const timeEl = convItem.querySelector('.conversation-time');
        if (timeEl) {
            timeEl.textContent = 'Just now';
        }
        
        // Move to top of list
        const listEl = document.getElementById('conversations-list');
        listEl.insertBefore(convItem, listEl.children[2]); // After loading and empty states
    }
}

function filterConversations(searchTerm) {
    const term = searchTerm.toLowerCase().trim();
    
    if (!term) {
        renderConversations(conversations);
        return;
    }
    
    const filtered = conversations.filter(conv => 
        conv.other_user_name.toLowerCase().includes(term) ||
        conv.property_title.toLowerCase().includes(term) ||
        (conv.last_message_preview && conv.last_message_preview.toLowerCase().includes(term))
    );
    
    renderConversations(filtered);
}

function closeActiveChat() {
    document.getElementById('chat-welcome').style.display = 'flex';
    document.getElementById('active-chat').style.display = 'none';
    currentConversationId = null;
    
    // Show sidebar on mobile
    if (window.innerWidth <= 768) {
        document.querySelector('.conversations-sidebar').classList.remove('hidden');
    }
    
    // Clear active state
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
}

function scrollToBottom() {
    const container = document.getElementById('messages-container');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}

// WebSocket Connection
function connectWebSocket() {
    if (!currentUser) return;
    
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${wsProtocol}//${window.location.hostname}:8000/chat/ws/${currentUser.user_id}`;
    
    try {
        websocket = new WebSocket(wsUrl);
        
        websocket.onopen = () => {
            console.log('WebSocket connected');
            // Send ping every 30 seconds to keep connection alive
            setInterval(() => {
                if (websocket.readyState === WebSocket.OPEN) {
                    websocket.send(JSON.stringify({ type: 'ping' }));
                }
            }, 30000);
        };
        
        websocket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            handleWebSocketMessage(data);
        };
        
        websocket.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
        
        websocket.onclose = () => {
            console.log('WebSocket disconnected, reconnecting...');
            // Reconnect after 5 seconds
            setTimeout(connectWebSocket, 5000);
        };
        
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
    }
}

function handleWebSocketMessage(data) {
    switch (data.type) {
        case 'message':
            handleNewMessage(data.data);
            break;
        case 'notification':
            handleNotification(data.data);
            break;
        case 'read_receipt':
            handleReadReceipt(data);
            break;
        case 'pong':
            // Keep-alive response
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function handleNewMessage(messageData) {
    // If message is for current conversation, add it to the chat
    if (currentConversationId === messageData.conversation_id) {
        const container = document.getElementById('messages-container');
        
        // Check if we need a date divider
        const lastMessage = container.querySelector('.message:last-of-type');
        if (lastMessage) {
            const lastDate = new Date(lastMessage.dataset.date || Date.now()).toDateString();
            const currentDate = new Date().toDateString();
            if (lastDate !== currentDate) {
                container.appendChild(createDateDivider(new Date()));
            }
        }
        
        const msgElement = createMessageElement({
            ...messageData,
            created_at: messageData.created_at
        });
        msgElement.dataset.date = messageData.created_at;
        container.appendChild(msgElement);
        
        scrollToBottom();
    } else {
        // Update unread count in sidebar
        const convItem = document.querySelector(`[data-conversation-id="${messageData.conversation_id}"]`);
        if (convItem) {
            let badge = convItem.querySelector('.unread-badge');
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'unread-badge';
                badge.textContent = '1';
                convItem.appendChild(badge);
            } else {
                badge.textContent = parseInt(badge.textContent) + 1;
            }
            
            // Update preview
            const previewEl = convItem.querySelector('.conversation-preview');
            if (previewEl) {
                previewEl.textContent = messageData.content;
            }
        }
        
        // Show browser notification
        showBrowserNotification(messageData);
    }
    
    // Play notification sound (optional)
    playNotificationSound();
}

async function showBrowserNotification(messageData) {
    // Check if user is on a different page or tab
    if (document.hidden || !document.hasFocus()) {
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                const notification = new Notification('New Message', {
                    body: `${messageData.sender_name}: ${messageData.content.substring(0, 100)}${messageData.content.length > 100 ? '...' : ''}`,
                    icon: '/assets/logo.png',
                    badge: '/assets/badge.png',
                    tag: `message-${messageData.id}`,
                    requireInteraction: false,
                    vibrate: [200, 100, 200]
                });

                notification.onclick = () => {
                    window.focus();
                    loadConversation(messageData.conversation_id);
                    notification.close();
                };

                // Auto-close after 5 seconds
                setTimeout(() => notification.close(), 5000);
            }
        } catch (error) {
            console.error('Error showing browser notification:', error);
        }
    }
}

function handleNotification(notificationData) {
    // Show toast notification
    showToast(notificationData.title, 'info');
    
    // Refresh conversations to update order
    loadConversations();
}

function handleReadReceipt(data) {
    // Mark messages as read in UI if needed
    console.log('Messages read:', data.message_ids);
}

function playNotificationSound() {
    // Optional: play a subtle notification sound
    // You can add an audio element and play it here
}

// Utility Functions
function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (websocket) {
        websocket.close();
    }
});
