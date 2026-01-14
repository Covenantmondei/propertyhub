const API_BASE_URL = 'https://myproperty-backend-three.vercel.app';

// Get all state elements
const loadingState = document.getElementById('loading-state');
const successState = document.getElementById('success-state');
const alreadyVerifiedState = document.getElementById('already-verified-state');
const errorState = document.getElementById('error-state');
const resendSuccessState = document.getElementById('resend-success-state');
const errorMessage = document.getElementById('error-message');

// State management
function showState(state) {
    // Hide all states
    const allStates = [
        loadingState,
        successState,
        alreadyVerifiedState,
        errorState,
        resendSuccessState
    ];
    
    allStates.forEach(s => s.classList.add('hidden'));
    
    // Show the requested state
    state.classList.remove('hidden');
}

// Get token from URL
function getTokenFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('token');
}

// Verify email with the token
async function verifyEmail(token) {
    if (!token) {
        showError('No verification token found. Please check your email link.');
        return;
    }

    console.log('Attempting to verify email with token:', token);
    console.log('API URL:', `${API_BASE_URL}/auth/verify-email?token=${token}`);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify-email?token=${token}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        const data = await response.json();
        console.log('Response data:', data);

        if (response.ok) {
            // Check if already verified
            if (data.message === 'Email already verified') {
                showState(alreadyVerifiedState);
            } else {
                // Success
                showState(successState);
                
                // Auto-redirect to login after 2 seconds
                setTimeout(() => {
                    window.location.href = 'login.html';
                }, 2000);
            }
        } else {
            // Handle error responses
            showError(data.detail || 'Failed to verify email. Please try again.');
        }
    } catch (error) {
        console.error('Verification error:', error);
        console.error('Error details:', error.message, error.stack);
        showError('Network error. Please check your connection and try again.');
    }
}

// Show error state with custom message
function showError(message) {
    errorMessage.textContent = message;
    showState(errorState);
}

// Resend verification email
async function resendVerification() {
    const button = event.target;
    const originalText = button.innerHTML;
    
    // Disable button and show loading
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';

    try {
        // You'll need to implement this endpoint in your backend
        // For now, we'll show a message asking users to request a new link
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Show success state
        showState(resendSuccessState);
        
        // Note: In a real implementation, you'd need to either:
        // 1. Store the email in localStorage during registration
        // 2. Create a backend endpoint that accepts the token and resends email
        // 3. Redirect to a page where user can enter their email
        
    } catch (error) {
        console.error('Resend error:', error);
        alert('Failed to resend verification email. Please contact support or try registering again.');
        
        // Re-enable button
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

// Initialize verification on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = getTokenFromURL();
    
    if (!token) {
        showError('No verification token found in the URL. Please check the link in your email.');
        return;
    }

    // Start verification
    verifyEmail(token);
});

// Add visual feedback for page navigation
window.addEventListener('beforeunload', () => {
    document.body.style.opacity = '0';
});

// Handle browser back button
window.addEventListener('popstate', () => {
    // Optionally redirect to home or login
    window.location.href = 'index.html';
});

// Optional: Add keyboard navigation
document.addEventListener('keydown', (e) => {
    // Press 'L' to go to login
    if (e.key === 'l' || e.key === 'L') {
        const loginBtn = document.querySelector('a[href="login.html"]');
        if (loginBtn && !loginBtn.classList.contains('hidden')) {
            window.location.href = 'login.html';
        }
    }
    
    // Press 'H' to go to home
    if (e.key === 'h' || e.key === 'H') {
        const homeBtn = document.querySelector('a[href="index.html"]');
        if (homeBtn && !homeBtn.classList.contains('hidden')) {
            window.location.href = 'index.html';
        }
    }
});

// Optional: Add analytics tracking
function trackVerificationEvent(eventName, success = true) {
    // Add your analytics code here
    console.log(`Event: ${eventName}, Success: ${success}`);
    
    // Example for Google Analytics
    if (typeof gtag !== 'undefined') {
        gtag('event', eventName, {
            'event_category': 'email_verification',
            'event_label': success ? 'success' : 'failed'
        });
    }
}

// Export for use in HTML
window.resendVerification = resendVerification;
