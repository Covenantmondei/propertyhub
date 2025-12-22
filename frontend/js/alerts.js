/**
 * Modern Alert & Modal System
 * Replaces native browser alerts with beautiful custom modals
 */

class AlertSystem {
    constructor() {
        this.overlay = null;
        this.toastContainer = null;
        this.init();
    }

    init() {
        // Create toast container
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container';
        document.body.appendChild(this.toastContainer);
    }

    /**
     * Show a simple alert message
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {string} title - Optional title
     */
    alert(message, type = 'info', title = null) {
        return new Promise((resolve) => {
            this.createOverlay();

            const icons = {
                success: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>',
                error: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>',
                warning: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
                info: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
            };

            const titles = {
                success: title || 'Success',
                error: title || 'Error',
                warning: title || 'Warning',
                info: title || 'Information'
            };

            const container = document.createElement('div');
            container.className = `alert-container ${type}`;
            container.innerHTML = `
                <div class="alert-header">
                    <div class="alert-icon">${icons[type]}</div>
                    <div class="alert-header-content">
                        <h3 class="alert-title">${titles[type]}</h3>
                        <p class="alert-message">${message}</p>
                    </div>
                </div>
                <div class="alert-footer">
                    <button class="alert-btn alert-btn-primary" data-action="ok">OK</button>
                </div>
            `;

            this.overlay.appendChild(container);
            setTimeout(() => this.overlay.classList.add('active'), 10);

            // Handle button click
            container.querySelector('[data-action="ok"]').addEventListener('click', () => {
                this.closeOverlay();
                resolve(true);
            });

            // Handle overlay click
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.closeOverlay();
                    resolve(true);
                }
            });
        });
    }

    /**
     * Show a confirmation dialog
     * @param {string} message - The message to display
     * @param {object} options - Options: { title, confirmText, cancelText, type }
     */
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            this.createOverlay();

            const {
                title = 'Confirm Action',
                confirmText = 'Confirm',
                cancelText = 'Cancel',
                type = 'confirm',
                danger = false
            } = options;

            const icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>';

            const container = document.createElement('div');
            container.className = `alert-container ${type}`;
            container.innerHTML = `
                <div class="alert-header">
                    <div class="alert-icon">${icon}</div>
                    <div class="alert-header-content">
                        <h3 class="alert-title">${title}</h3>
                        <p class="alert-message">${message}</p>
                    </div>
                </div>
                <div class="alert-footer">
                    <button class="alert-btn alert-btn-secondary" data-action="cancel">${cancelText}</button>
                    <button class="alert-btn ${danger ? 'alert-btn-danger' : 'alert-btn-primary'}" data-action="confirm">${confirmText}</button>
                </div>
            `;

            this.overlay.appendChild(container);
            setTimeout(() => this.overlay.classList.add('active'), 10);

            // Handle button clicks
            container.querySelector('[data-action="confirm"]').addEventListener('click', () => {
                this.closeOverlay();
                resolve(true);
            });

            container.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                this.closeOverlay();
                resolve(false);
            });

            // Handle overlay click
            this.overlay.addEventListener('click', (e) => {
                if (e.target === this.overlay) {
                    this.closeOverlay();
                    resolve(false);
                }
            });

            // Handle Escape key
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    this.closeOverlay();
                    resolve(false);
                    document.removeEventListener('keydown', handleEscape);
                }
            };
            document.addEventListener('keydown', handleEscape);
        });
    }

    /**
     * Show a prompt dialog with input
     * @param {string} message - The message to display
     * @param {object} options - Options: { title, defaultValue, placeholder, inputType }
     */
    prompt(message, options = {}) {
        return new Promise((resolve) => {
            this.createOverlay();

            const {
                title = 'Input Required',
                defaultValue = '',
                placeholder = '',
                inputType = 'text',
                confirmText = 'Submit',
                cancelText = 'Cancel'
            } = options;

            const icon = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>';

            const container = document.createElement('div');
            container.className = 'alert-container info';
            container.innerHTML = `
                <div class="alert-header">
                    <div class="alert-icon">${icon}</div>
                    <div class="alert-header-content">
                        <h3 class="alert-title">${title}</h3>
                        <p class="alert-message">${message}</p>
                    </div>
                </div>
                <div class="alert-body">
                    <div class="alert-input-group">
                        ${inputType === 'textarea' 
                            ? `<textarea class="alert-textarea" placeholder="${placeholder}">${defaultValue}</textarea>`
                            : `<input type="${inputType}" class="alert-input" value="${defaultValue}" placeholder="${placeholder}">`
                        }
                    </div>
                </div>
                <div class="alert-footer">
                    <button class="alert-btn alert-btn-secondary" data-action="cancel">${cancelText}</button>
                    <button class="alert-btn alert-btn-primary" data-action="submit">${confirmText}</button>
                </div>
            `;

            this.overlay.appendChild(container);
            setTimeout(() => this.overlay.classList.add('active'), 10);

            const input = container.querySelector('.alert-input, .alert-textarea');
            input.focus();

            // Handle button clicks
            container.querySelector('[data-action="submit"]').addEventListener('click', () => {
                const value = input.value.trim();
                this.closeOverlay();
                resolve(value || null);
            });

            container.querySelector('[data-action="cancel"]').addEventListener('click', () => {
                this.closeOverlay();
                resolve(null);
            });

            // Handle Enter key (only for input, not textarea)
            if (inputType !== 'textarea') {
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        const value = input.value.trim();
                        this.closeOverlay();
                        resolve(value || null);
                    }
                });
            }
        });
    }

    /**
     * Show a toast notification
     * @param {string} message - The message to display
     * @param {string} type - Type: 'success', 'error', 'warning', 'info'
     * @param {object} options - Options: { title, duration }
     */
    toast(message, type = 'info', options = {}) {
        const {
            title = null,
            duration = 4000
        } = options;

        const icons = {
            success: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            error: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>',
            warning: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>',
            info: '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>'
        };

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div class="toast-icon">${icons[type]}</div>
            <div class="toast-content">
                ${title ? `<div class="toast-title">${title}</div>` : ''}
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="20" height="20">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
            </button>
            ${duration > 0 ? '<div class="toast-progress"></div>' : ''}
        `;

        this.toastContainer.appendChild(toast);

        // Handle close button
        toast.querySelector('.toast-close').addEventListener('click', () => {
            this.removeToast(toast);
        });

        // Auto remove after duration
        if (duration > 0) {
            setTimeout(() => {
                this.removeToast(toast);
            }, duration);
        }

        return toast;
    }

    /**
     * Remove a toast notification
     */
    removeToast(toast) {
        toast.style.animation = 'slideOutRight 0.3s ease forwards';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }

    /**
     * Create overlay
     */
    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'alert-overlay';
        document.body.appendChild(this.overlay);
    }

    /**
     * Close overlay
     */
    closeOverlay() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
            setTimeout(() => {
                if (this.overlay && this.overlay.parentNode) {
                    this.overlay.parentNode.removeChild(this.overlay);
                }
                this.overlay = null;
            }, 300);
        }
    }
}

// Create global instance
const alertSystem = new AlertSystem();

// Export convenience functions
window.showAlert = (message, type = 'info', title = null) => {
    return alertSystem.alert(message, type, title);
};

window.showConfirm = (message, options = {}) => {
    return alertSystem.confirm(message, options);
};

window.showPrompt = (message, options = {}) => {
    return alertSystem.prompt(message, options);
};

window.showToast = (message, type = 'info', options = {}) => {
    return alertSystem.toast(message, type, options);
};

// Add slide out animation
const style = document.createElement('style');
style.textContent = `
    @keyframes slideOutRight {
        to {
            transform: translateX(calc(100% + 1rem));
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

console.log('Alert system loaded successfully');
