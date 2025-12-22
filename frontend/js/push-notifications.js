class PushNotificationService {
    constructor() {
        this.isSupported = 'Notification' in window && 'serviceWorker' in navigator;
        this.permission = this.isSupported ? Notification.permission : 'denied';
    }

    async requestPermission() {
        if (!this.isSupported) {
            console.warn('Push notifications are not supported in this browser');
            return false;
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

    async showNotification(title, options = {}) {
        if (!this.isSupported) {
            return false;
        }

        if (this.permission !== 'granted') {
            const granted = await this.requestPermission();
            if (!granted) {
                return false;
            }
        }

        const defaultOptions = {
            icon: '/assets/logo.png',
            badge: '/assets/badge.png',
            vibrate: [200, 100, 200],
            requireInteraction: false,
            ...options
        };

        try {
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                const registration = await navigator.serviceWorker.ready;
                await registration.showNotification(title, defaultOptions);
            } else {
                new Notification(title, defaultOptions);
            }
            return true;
        } catch (error) {
            console.error('Error showing notification:', error);
            return false;
        }
    }

    // For admin - check for new pending items
    async checkForPendingApprovals() {
        try {
            const response = await fetch(`${API_BASE_URL}/admin/dashboard`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                }
            });

            if (!response.ok) return;

            const stats = await response.json();
            
            const pendingCount = stats.pending_approvals || 0;
            const storedCount = parseInt(localStorage.getItem('lastPendingCount') || '0');

            if (pendingCount > storedCount) {
                const newItems = pendingCount - storedCount;
                await this.showNotification('New Pending Approvals', {
                    body: `You have ${newItems} new item(s) awaiting approval`,
                    icon: '/assets/notification-icon.png',
                    tag: 'pending-approvals',
                    data: { url: '/admin.html' },
                    actions: [
                        { action: 'view', title: 'View Dashboard' },
                        { action: 'dismiss', title: 'Dismiss' }
                    ]
                });
            }

            localStorage.setItem('lastPendingCount', pendingCount.toString());
        } catch (error) {
            console.error('Error checking pending approvals:', error);
        }
    }

    startPolling(intervalMinutes = 5) {
        // Check immediately
        this.checkForPendingApprovals();

        // Then check every X minutes
        return setInterval(() => {
            this.checkForPendingApprovals();
        }, intervalMinutes * 60 * 1000);
    }

    stopPolling(intervalId) {
        if (intervalId) {
            clearInterval(intervalId);
        }
    }
}

// Initialize service
const pushService = new PushNotificationService();

// Auto-request permission for admins on login
if (typeof window !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        const userRole = localStorage.getItem('userRole');
        if (userRole === 'admin' && pushService.permission === 'default') {
            // Wait a bit before asking for permission
            setTimeout(() => {
                pushService.requestPermission();
            }, 2000);
        }
    });
}