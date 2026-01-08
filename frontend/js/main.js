const API_BASE_URL = 'http://127.0.0.1:8000';
window.API_BASE_URL = API_BASE_URL;

// Initialize theme and footer on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeTheme();
    initializeMobileMenu();
    updateActiveNavLink();
    initializeFooter();
    initializeUserRoleUI();
    initializeProfileButton();
});

// Theme Management
function initializeTheme() {
    const theme = localStorage.getItem('theme') || 'light';
    document.documentElement.classList.toggle('dark', theme === 'dark');
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        updateThemeIcons(theme);
        themeToggle.addEventListener('click', toggleTheme);
    }
}

function toggleTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    const theme = isDark ? 'dark' : 'light';
    localStorage.setItem('theme', theme);
    updateThemeIcons(theme);
}

function updateThemeIcons(theme) {
    const sunIcon = document.querySelector('.sun-icon');
    const moonIcon = document.querySelector('.moon-icon');
    
    if (sunIcon && moonIcon) {
        if (theme === 'dark') {
            sunIcon.classList.add('hidden');
            moonIcon.classList.remove('hidden');
        } else {
            sunIcon.classList.remove('hidden');
            moonIcon.classList.add('hidden');
        }
    }
}

// Mobile Menu Management
function initializeMobileMenu() {
    const menuToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu');
    const menuIcon = document.querySelector('.menu-icon');
    const closeIcon = document.querySelector('.close-icon');
    
    if (menuToggle && mobileMenu) {
        menuToggle.addEventListener('click', () => {
            const isActive = mobileMenu.classList.toggle('active');
            
            if (menuIcon && closeIcon) {
                menuIcon.classList.toggle('hidden', isActive);
                closeIcon.classList.toggle('hidden', !isActive);
            }
        });
        
        // Close mobile menu when clicking on a link
        const mobileLinks = mobileMenu.querySelectorAll('a');
        mobileLinks.forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('active');
                if (menuIcon && closeIcon) {
                    menuIcon.classList.remove('hidden');
                    closeIcon.classList.add('hidden');
                }
            });
        });
    }
}

// Update active navigation link
function updateActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'home.html';
    const navLinks = document.querySelectorAll('.nav-link');
    
    navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage || (currentPage === '' && href === 'home.html')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

// Token refresh in progress flag to prevent multiple refresh attempts
let isRefreshing = false;
let refreshSubscribers = [];

// Add callback to queue for when token is refreshed
function subscribeTokenRefresh(callback) {
    refreshSubscribers.push(callback);
}

// Notify all subscribers when token is refreshed
function onTokenRefreshed(token) {
    refreshSubscribers.forEach(callback => callback(token));
    refreshSubscribers = [];
}

// Refresh the access token using refresh token
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem('refreshToken');
    
    if (!refreshToken) {
        console.error('No refresh token available');
        // Redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = 'login.html';
        throw new Error('No refresh token available');
    }

    try {
        const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                refresh_token: refreshToken
            })
        });

        if (!response.ok) {
            throw new Error('Token refresh failed');
        }

        const data = await response.json();
        
        // Store new tokens
        localStorage.setItem('authToken', data.access_token);
        if (data.refresh_token) {
            localStorage.setItem('refreshToken', data.refresh_token);
        }

        console.log('Token refreshed successfully');
        return data.access_token;
    } catch (error) {
        console.error('Failed to refresh token:', error);
        // Clear tokens and redirect to login
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        
        // Show notification if available
        if (typeof showToast === 'function') {
            showToast('Session expired. Please login again.', 'warning');
        }
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        
        throw error;
    }
}

// API Utility Functions with automatic token refresh
async function apiCall(endpoint, options = {}, retryCount = 0) {
    try {
        const token = localStorage.getItem('authToken');
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers
        });

        // Handle 401 Unauthorized - Token expired
        if (response.status === 401 && retryCount === 0) {
            console.log('Token expired, attempting refresh...');
            
            // If already refreshing, wait for it to complete
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    subscribeTokenRefresh((token) => {
                        // Retry the original request with new token
                        apiCall(endpoint, options, 1)
                            .then(resolve)
                            .catch(reject);
                    });
                });
            }

            // Start refresh process
            isRefreshing = true;
            
            try {
                const newToken = await refreshAccessToken();
                isRefreshing = false;
                
                // Notify all waiting requests
                onTokenRefreshed(newToken);
                
                // Retry the original request with new token
                return await apiCall(endpoint, options, 1);
            } catch (refreshError) {
                isRefreshing = false;
                throw refreshError;
            }
        }

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

// Make apiCall globally accessible for other scripts
window.apiCall = apiCall;

// Formatting Functions
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
        maximumFractionDigits: 0
    }).format(amount);
}

function formatDate(dateString) {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
}

function formatNumber(num) {
    return new Intl.NumberFormat('en-US').format(num);
}

// Notification System (uses new alert system if available, falls back to simple notification)
function showNotification(message, type = 'info') {
    // If new alert system is available, use it
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }
    
    // Fallback to simple notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const colors = {
        success: 'rgb(34, 197, 94)',
        error: 'rgb(239, 68, 68)',
        info: 'rgb(59, 130, 246)',
        warning: 'rgb(245, 158, 11)'
    };
    
    notification.style.cssText = `
        position: fixed;
        top: 1.5rem;
        right: 1.5rem;
        padding: 1rem 1.5rem;
        background-color: ${colors[type] || colors.info};
        color: white;
        border-radius: 0.5rem;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
        z-index: 9999;
        animation: slideIn 0.3s ease-out;
        max-width: 400px;
        font-size: 0.875rem;
    `;
    
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Authentication Functions
function isAuthenticated() {
    return !!localStorage.getItem('authToken');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
}

async function logout() {
    try {
        // Show confirmation dialog if available
        let confirmed = true;
        if (typeof showConfirm === 'function') {
            confirmed = await showConfirm(
                'Are you sure you want to logout?',
                { title: 'Logout', confirmText: 'Logout', danger: true }
            );
        } else {
            confirmed = confirm('Are you sure you want to logout?');
        }
        
        if (!confirmed) {
            return;
        }

        // Call backend logout endpoint to blacklist token
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                await fetch(`${API_BASE_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Backend logout failed:', error);
                // Continue with client-side logout even if backend fails
            }
        }

        // Stop notification polling
        if (typeof notificationManager !== 'undefined' && notificationManager.stopPolling) {
            notificationManager.stopPolling();
        }

        // Clear all auth data
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('lastUnreadMessages');
        
        // Clear session storage as well
        sessionStorage.clear();

        // Show success message
        if (typeof showToast === 'function') {
            showToast('Logged out successfully', 'success');
        } else {
            showNotification('Logged out successfully', 'success');
        }

        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even on error
        localStorage.clear();
        sessionStorage.clear();
        
        if (typeof showToast === 'function') {
            showToast('Logged out', 'info');
        }
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

// Make logout globally accessible
window.logout = logout;

// URL Parameter Functions
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

function getAllUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    const params = {};
    for (const [key, value] of urlParams.entries()) {
        params[key] = value;
    }
    return params;
}

// Image Loading with Fallback
function loadImage(imgElement, src, fallback = 'https://via.placeholder.com/400x300?text=Property+Image') {
    imgElement.src = src;
    imgElement.onerror = () => {
        imgElement.src = fallback;
    };
}

// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Animation Styles
const animationStyles = document.createElement('style');
animationStyles.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }

    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
    
    @keyframes fadeIn {
        from {
            opacity: 0;
        }
        to {
            opacity: 1;
        }
    }
    
    @keyframes fadeOut {
        from {
            opacity: 1;
        }
        to {
            opacity: 0;
        }
    }
`;
document.head.appendChild(animationStyles);

// Footer Management
function initializeFooter() {
    const logoutBtn = document.getElementById('logout-btn');
    
    if (logoutBtn) {
        // Show logout button if user is authenticated
        if (isAuthenticated()) {
            logoutBtn.classList.add('visible');
        }
        
        // Add click handler
        logoutBtn.addEventListener('click', logout);
    }
}

// User Role-based UI Management
function initializeUserRoleUI() {
    const user = getUser();
    if (!user) return;

    // Elements that should only show for agents
    const agentOnlyElements = [
        'list-property-btn',
        'list-property-mobile',
        'list-property-hero',
        'add-property-btn'
    ];

    // Elements that should only show for buyers
    const buyerOnlyElements = [
        'smart-match-btn',
        'smart-match-hero-btn',
        'floating-smart-match'
    ];

    // Show agent-specific elements only if user is an agent
    if (user.role === 'agent') {
        agentOnlyElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = '';
            }
        });
        // Hide buyer-only elements for agents
        buyerOnlyElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = 'none';
            }
        });
    }

    // Show buyer-specific elements for buyers
    if (user.role === 'buyer') {
        buyerOnlyElements.forEach(elementId => {
            const element = document.getElementById(elementId);
            if (element) {
                element.style.display = '';
            }
        });
    }
}

// Profile Button Management
function initializeProfileButton() {
    const profileBtn = document.getElementById('profile-btn');
    if (!profileBtn) return;

    // Create profile dropdown
    const dropdown = document.createElement('div');
    dropdown.className = 'profile-dropdown';
    
    // Check if dark mode is active
    const isDark = document.documentElement.classList.contains('dark');
    const bgColor = isDark ? '#1f2937' : 'white';
    const textColor = isDark ? '#f9fafb' : '#111827';
    const mutedColor = isDark ? '#9ca3af' : '#6b7280';
    const borderColor = isDark ? '#374151' : '#e5e7eb';
    const hoverBg = isDark ? '#374151' : '#f3f4f6';
    
    dropdown.style.cssText = `
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 0.5rem;
        background: ${bgColor};
        border-radius: 0.5rem;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        min-width: 200px;
        opacity: 0;
        visibility: hidden;
        transform: translateY(-10px);
        transition: all 0.2s ease;
        z-index: 1000;
        border: 1px solid ${borderColor};
    `;

    const user = getUser();
    if (user) {
        dropdown.innerHTML = `
            <div style="padding: 1rem; border-bottom: 1px solid ${borderColor};">
                <div style="font-weight: 600; color: ${textColor};">${user.username || 'User'}</div>
                <div style="font-size: 0.875rem; color: ${mutedColor};">${user.role || 'buyer'}</div>
            </div>
            <div style="padding: 0.5rem;">
                ${user.role === 'agent' ? `
                    <a href="agent-dashboard.html" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border-radius: 0.375rem; color: ${textColor}; text-decoration: none; transition: background 0.2s;">
                        <svg style="width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                        Dashboard
                    </a>
                ` : ''}
                ${user.role === 'admin' ? `
                    <a href="admin.html" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border-radius: 0.375rem; color: ${textColor}; text-decoration: none; transition: background 0.2s;">
                        <svg style="width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 1v6m0 6v6m8.66-14.14l-4.23 4.23M7.57 16.91l-4.24 4.24M23 12h-6m-6 0H1m20.66 8.66l-4.23-4.23M7.57 7.09L3.34 2.86"/></svg>
                        Admin Panel
                    </a>
                ` : ''}
                <button id="profile-logout-btn" data-logout-handler="true" style="display: flex; align-items: center; gap: 0.5rem; width: 100%; padding: 0.75rem; border-radius: 0.375rem; border: none; background: none; color: #ef4444; cursor: pointer; text-align: left; transition: background 0.2s; font-family: inherit; font-size: inherit;">
                    <svg style="width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                    Logout
                </button>
            </div>
        `;
    } else {
        dropdown.innerHTML = `
            <div style="padding: 0.5rem;">
                <a href="login.html" style="display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem; border-radius: 0.375rem; color: ${textColor}; text-decoration: none; transition: background 0.2s;">
                    <svg style="width: 18px; height: 18px; stroke: currentColor; fill: none; stroke-width: 2;" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
                    Login
                </a>
            </div>
        `;
    }

    // Position dropdown relative to button
    profileBtn.style.position = 'relative';
    profileBtn.appendChild(dropdown);

    // Toggle dropdown
    profileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.visibility === 'visible';
        
        if (isVisible) {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
        } else {
            dropdown.style.opacity = '1';
            dropdown.style.visibility = 'visible';
            dropdown.style.transform = 'translateY(0)';
        }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!profileBtn.contains(e.target)) {
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
        }
    });

    // Handle logout from dropdown
    const logoutBtn = dropdown.querySelector('#profile-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            // Close dropdown first
            dropdown.style.opacity = '0';
            dropdown.style.visibility = 'hidden';
            dropdown.style.transform = 'translateY(-10px)';
            
            // Call logout function
            await logout();
        });
    }

    // Add hover effects to dropdown links
    const dropdownLinks = dropdown.querySelectorAll('a, button');
    dropdownLinks.forEach(link => {
        link.addEventListener('mouseenter', function() {
            this.style.background = hoverBg;
        });
        link.addEventListener('mouseleave', function() {
            this.style.background = 'transparent';
        });
    });
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

class NotificationManager {
    constructor() {
        this.isSupported = 'Notification' in window;
        this.permission = this.isSupported ? Notification.permission : 'denied';
        this.updateInterval = null;
    }

    async requestPermission() {
        if (!this.isSupported) {
            console.warn('Browser notifications not supported');
            return false;
        }

        if (this.permission === 'granted') {
            return true;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    async showBrowserNotification(title, options = {}) {
        if (!this.isSupported || this.permission !== 'granted') {
            return false;
        }

        const defaultOptions = {
            icon: '/assets/logo.png',
            badge: '/assets/badge.png',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            ...options
        };

        try {
            const notification = new Notification(title, defaultOptions);
            
            notification.onclick = () => {
                window.focus();
                if (options.url) {
                    window.location.href = options.url;
                }
                notification.close();
            };
            
            return true;
        } catch (error) {
            console.error('Error showing notification:', error);
            return false;
        }
    }

    async checkUnreadMessages() {
        try {
            const stats = await apiCall('/chat/stats');
            const unreadCount = stats.unread_messages_count || 0;
            
            // Update badge
            this.updateMessagesBadge(unreadCount);
            
            // Check if there are new messages
            const lastCount = parseInt(localStorage.getItem('lastUnreadMessages') || '0');
            if (unreadCount > lastCount) {
                const newMessages = unreadCount - lastCount;
                await this.showBrowserNotification('New Message', {
                    body: `You have ${newMessages} new message(s)`,
                    tag: 'new-messages',
                    url: 'chat.html'
                });
            }
            
            localStorage.setItem('lastUnreadMessages', unreadCount.toString());
            return unreadCount;
        } catch (error) {
            console.error('Error checking unread messages:', error);
            return 0;
        }
    }

    async checkNotifications() {
        try {
            const notifications = await apiCall('/chat/notifications?unread_only=true');
            const unreadCount = notifications.length;
            
            // Update badge
            this.updateNotificationsBadge(unreadCount);
            
            return unreadCount;
        } catch (error) {
            console.error('Error checking notifications:', error);
            return 0;
        }
    }

    updateMessagesBadge(count) {
        const badges = document.querySelectorAll('#messages-badge');
        badges.forEach(badge => {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    updateNotificationsBadge(count) {
        const badges = document.querySelectorAll('#notifications-badge');
        badges.forEach(badge => {
            if (count > 0) {
                badge.textContent = count > 99 ? '99+' : count;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
            }
        });
    }

    startPolling(intervalSeconds = 30) {
        // Check immediately
        this.checkUnreadMessages();
        this.checkNotifications();

        // Then check every X seconds
        this.updateInterval = setInterval(() => {
            this.checkUnreadMessages();
            this.checkNotifications();
        }, intervalSeconds * 1000);
    }

    stopPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Initialize notification manager
const notificationManager = new NotificationManager();

// Auto-start polling when authenticated
document.addEventListener('DOMContentLoaded', async () => {
    if (isAuthenticated()) {
        const user = getUser();
        
        // Request permission after a short delay
        setTimeout(async () => {
            await notificationManager.requestPermission();
            
            // Start polling for updates
            notificationManager.startPolling(30); // Check every 30 seconds
        }, 2000);

        // Setup notifications button click handler (for all users - agents and buyers)
        const notificationsBtn = document.getElementById('notifications-btn');
        if (notificationsBtn) {
            notificationsBtn.style.display = 'inline-block';
            notificationsBtn.addEventListener('click', showNotificationsPanel);
        }
    }
});

// Show notifications panel
async function showNotificationsPanel() {
    try {
        const notifications = await apiCall('/chat/notifications?limit=10');
        
        if (notifications.length === 0) {
            showToast('No notifications', 'info');
            return;
        }

        // Create notifications list HTML
        const notificationsHTML = notifications.map(notif => `
            <div class="notification-item ${notif.is_read ? 'read' : 'unread'}" style="
                padding: 1rem;
                border-bottom: 1px solid #e5e7eb;
                cursor: pointer;
                ${!notif.is_read ? 'background: #eff6ff;' : ''}
            " data-notification-id="${notif.id}" 
               data-notification-type="${notif.notification_type || 'message'}"
               data-conversation-id="${notif.conversation_id || ''}"
               data-related-id="${notif.related_id || ''}">
                <div style="font-weight: 600; margin-bottom: 0.25rem;">${notif.title}</div>
                <div style="font-size: 0.875rem; color: #6b7280; margin-bottom: 0.5rem;">${notif.body}</div>
                <div style="font-size: 0.75rem; color: #9ca3af;">${formatTimeAgo(notif.created_at)}</div>
            </div>
        `).join('');

        // Create modal content
        const modalContent = `
            <div style="max-height: 500px; overflow-y: auto;">
                ${notificationsHTML}
            </div>
            <div style="padding: 1rem; border-top: 1px solid #e5e7eb; text-align: center;">
                <button id="mark-all-read-btn" style="
                    padding: 0.5rem 1rem;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 0.5rem;
                    cursor: pointer;
                ">Mark All as Read</button>
            </div>
        `;

        // Show custom modal (you can integrate with your existing alert system)
        // Use setTimeout to attach event listeners after modal is rendered
        setTimeout(() => {
            // Add click handler to mark all as read button
            const markAllBtn = document.getElementById('mark-all-read-btn');
            if (markAllBtn) {
                markAllBtn.addEventListener('click', markAllNotificationsRead);
            }

            // Add click handlers to notification items
            document.querySelectorAll('.notification-item').forEach(item => {
                item.addEventListener('click', async () => {
                    const notifId = item.dataset.notificationId;
                    const notifType = item.dataset.notificationType;
                    const conversationId = item.dataset.conversationId;
                    const relatedId = item.dataset.relatedId;
                    
                    // Mark as read
                    try {
                        await apiCall(`/chat/notifications/${notifId}`, { method: 'PATCH' });
                        notificationManager.checkNotifications();
                        
                        // Close modal
                        const overlay = document.querySelector('.alert-overlay');
                        if (overlay) overlay.remove();
                        
                        // Navigate based on notification type
                        if (notifType === 'message' && conversationId) {
                            window.location.href = `chat.html?conversation=${conversationId}`;
                        } else if (notifType.startsWith('visit_') && relatedId) {
                            // Visit-related notifications
                            window.location.href = `visits.html`;
                        } else {
                            // Default: refresh current page
                            window.location.reload();
                        }
                    } catch (error) {
                        console.error('Error handling notification:', error);
                    }
                });
            });
        }, 100);

        await showAlert(modalContent, 'info', 'Notifications');

    } catch (error) {
        console.error('Error loading notifications:', error);
        showToast('Failed to load notifications', 'error');
    }
}

async function markAllNotificationsRead() {
    try {
        await apiCall('/chat/notifications/all', { method: 'PATCH' });
        notificationManager.checkNotifications();
        showToast('All notifications marked as read', 'success');
        
        // Close modal if using custom alert system
        const overlay = document.querySelector('.alert-overlay');
        if (overlay) overlay.remove();
        
        // Reload notifications panel to show updated state
        setTimeout(() => {
            showNotificationsPanel();
        }, 500);
    } catch (error) {
        console.error('Error marking notifications as read:', error);
        showToast('Failed to mark notifications as read', 'error');
    }
}

// Make it globally accessible
window.markAllNotificationsRead = markAllNotificationsRead;

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

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    notificationManager.stopPolling();
});

console.log('Main.js loaded successfully');
