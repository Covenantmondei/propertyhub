const BACKEND_URL = 'http://127.0.0.1:8000';

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is already logged in
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        // Check if user is already an admin
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role === 'admin') {
            window.location.href = 'admin.html';
        } else {
            window.location.href = 'home.html';
        }
        return;
    }
    
    setupAdminSignupPage();
});

function setupAdminSignupPage() {
    const adminSignupForm = document.getElementById('admin-signup-form');
    adminSignupForm.addEventListener('submit', performAdminSignup);
    
    initializePasswordToggles();
    
    const passwordField = document.getElementById('admin-password');
    const confirmPasswordField = document.getElementById('admin-confirm-password');
    
    passwordField.addEventListener('input', checkPasswordStrength);
    confirmPasswordField.addEventListener('input', verifyPasswordsMatch);
}

function initializePasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    toggleButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const fieldId = btn.getAttribute('data-target');
            const passwordField = document.getElementById(fieldId);
            const showIcon = btn.querySelector('.icon-eye');
            const hideIcon = btn.querySelector('.icon-eye-off');
            
            const isPassword = passwordField.type === 'password';
            passwordField.type = isPassword ? 'text' : 'password';
            
            if (isPassword) {
                showIcon.classList.add('hidden');
                hideIcon.classList.remove('hidden');
            } else {
                showIcon.classList.remove('hidden');
                hideIcon.classList.add('hidden');
            }
        });
    });
}

function checkPasswordStrength() {
    const passwordValue = document.getElementById('admin-password').value;
    const strengthDisplay = document.getElementById('password-strength');
    
    if (!passwordValue) {
        strengthDisplay.classList.remove('active');
        return;
    }
    
    strengthDisplay.classList.add('active');
    
    const checks = [
        { text: 'At least 8 characters', valid: pwd => pwd.length >= 8 },
        { text: 'One uppercase letter', valid: pwd => /[A-Z]/.test(pwd) },
        { text: 'One lowercase letter', valid: pwd => /[a-z]/.test(pwd) },
        { text: 'One number', valid: pwd => /\d/.test(pwd) },
        { text: 'One special character', valid: pwd => /[!@#$%^&*(),.?":{}|<>]/.test(pwd) }
    ];
    
    const passedChecks = checks.filter(c => c.valid(passwordValue)).length;
    const strengthPercent = passedChecks === 0 ? 0 : Math.min(100, (passedChecks / checks.length) * 100);
    
    const strengthLevels = ['Weak', 'Fair', 'Good', 'Strong', 'Strong'];
    const colorPalette = ['#ef4444', '#f59e0b', '#3b82f6', '#10b981', '#10b981'];
    const levelIndex = Math.min(Math.floor(passedChecks), 4);
    
    strengthDisplay.innerHTML = `
        <div class="strength-bar">
            <div class="strength-fill" style="width: ${strengthPercent}%; background-color: ${colorPalette[levelIndex]}"></div>
        </div>
        <div class="strength-text">
            <span>Password strength</span>
            <span style="color: ${colorPalette[levelIndex]}">${strengthLevels[levelIndex]}</span>
        </div>
        <div class="strength-requirements">
            ${checks.map(check => `
                <div class="strength-requirement ${check.valid(passwordValue) ? 'met' : ''}">
                    ${check.text}
                </div>
            `).join('')}
        </div>
    `;
}

function verifyPasswordsMatch() {
    const pwd = document.getElementById('admin-password').value;
    const confirmPwd = document.getElementById('admin-confirm-password').value;
    const matchMessage = document.getElementById('password-match-message');
    
    if (confirmPwd && pwd !== confirmPwd) {
        matchMessage.textContent = 'Passwords do not match';
        matchMessage.classList.add('show');
    } else {
        matchMessage.classList.remove('show');
    }
}

async function performAdminSignup(event) {
    event.preventDefault();
    
    const firstNameInput = document.getElementById('admin-first-name').value.trim();
    const lastNameInput = document.getElementById('admin-last-name').value.trim();
    const usernameInput = document.getElementById('admin-username').value.trim();
    const emailInput = document.getElementById('admin-email').value.trim();
    const passwordInput = document.getElementById('admin-password').value;
    const confirmPwdInput = document.getElementById('admin-confirm-password').value;
    const termsCheckbox = document.getElementById('admin-terms');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    // Validation
    if (!termsCheckbox.checked) {
        showAlert('Please accept the administrator terms and conditions', 'error', 'Terms Required');
        return;
    }
    
    if (passwordInput !== confirmPwdInput) {
        showAlert('Passwords do not match', 'error', 'Validation Error');
        return;
    }
    
    if (!usernameInput) {
        showAlert('Username is required', 'error', 'Validation Error');
        return;
    }
    
    if (passwordInput.length < 8) {
        showAlert('Password must be at least 8 characters long', 'error', 'Validation Error');
        return;
    }
    
    // Disable submit button
    submitBtn.disabled = true;
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating admin account...';
    
    try {
        const signupResponse = await fetch(`${BACKEND_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: emailInput,
                first_name: firstNameInput || null,
                last_name: lastNameInput || null,
                username: usernameInput,
                password: passwordInput,
                role: 'admin' // Set role as admin
            })
        });
        
        const responseData = await signupResponse.json();
        
        if (!signupResponse.ok) {
            throw new Error(responseData.detail || 'Admin registration failed');
        }
        
        // Show success message
        showStep('success');
        
        // Log the registration
        console.log('Admin account created successfully:', {
            username: usernameInput,
            email: emailInput,
            role: 'admin'
        });
        
        // Optional: Show success alert
        showAlert('Admin account created successfully! Please check your email to verify your account.', 'success', 'Registration Successful');
        
    } catch (err) {
        console.error('Admin signup error:', err);
        showAlert(err.message || 'Admin registration failed. Please try again.', 'error', 'Registration Failed');
        
        // Re-enable submit button
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
    }
}

function showStep(stepName) {
    const allSteps = document.querySelectorAll('.auth-step');
    allSteps.forEach(step => step.classList.remove('active'));
    
    const targetStep = document.getElementById(`${stepName}-step`);
    if (targetStep) {
        targetStep.classList.add('active');
    }
    
    const authCard = document.getElementById('auth-card');
    const stepHeights = {
        'admin-signup': '920px',
        'success': '420px'
    };
    
    authCard.style.height = stepHeights[stepName] || '920px';
}

// Export for use in HTML inline handlers
window.showStep = showStep;
