const BACKEND_URL = 'https://myproperty-backend-seven.vercel.app';
let activeStep = 'login';

document.addEventListener('DOMContentLoaded', () => {
    const authToken = localStorage.getItem('authToken');
    if (authToken) {
        window.location.href = 'home.html';
        return;
    }
    
    setupAuthPage();
});

function setupAuthPage() {
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');
    const forgotForm = document.getElementById('forgot-password-form');
    
    loginForm.addEventListener('submit', performLogin);
    signupForm.addEventListener('submit', performSignup);
    forgotForm.addEventListener('submit', requestPasswordReset);
    
    initializePasswordToggles();
    
    const signupPasswordField = document.getElementById('signup-password');
    const confirmPasswordField = document.getElementById('signup-confirm-password');
    
    signupPasswordField.addEventListener('input', checkPasswordStrength);
    confirmPasswordField.addEventListener('input', verifyPasswordsMatch);
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
        'login': '480px',
        'signup': '920px',
        'forgot-password': '380px',
        'success': '320px'
    };
    
    authCard.style.height = stepHeights[stepName] || '480px';
    activeStep = stepName;
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
    const passwordValue = document.getElementById('signup-password').value;
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
    const pwd = document.getElementById('signup-password').value;
    const confirmPwd = document.getElementById('signup-confirm-password').value;
    const matchMessage = document.getElementById('password-match-message');
    
    if (confirmPwd && pwd !== confirmPwd) {
        matchMessage.textContent = 'Passwords do not match';
        matchMessage.classList.add('show');
    } else {
        matchMessage.classList.remove('show');
    }
}

async function performLogin(event) {
    event.preventDefault();
    
    const usernameInput = document.getElementById('login-username').value;
    const passwordInput = document.getElementById('login-password').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    
    try {
        const loginResponse = await fetch(`${BACKEND_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usernameInput,
                password: passwordInput
            })
        });
        
        const responseData = await loginResponse.json();
        console.log(responseData);
        if (!loginResponse.ok) {
            throw new Error(responseData.detail || 'Login failed');
        }
        
        // Store tokens
        localStorage.setItem('authToken', responseData.access_token);
        if (responseData.refresh_token) {
            localStorage.setItem('refreshToken', responseData.refresh_token);
        }
        
        // Decode JWT to get user info and role
        const tokenPayload = extractJWTPayload(responseData.access_token);
        console.log('Token payload:', tokenPayload);
        
        if (tokenPayload && tokenPayload.sub && tokenPayload.role) {
            // Create user object from token payload
            const userData = {
                username: tokenPayload.sub,
                user_id: tokenPayload.user_id,
                role: tokenPayload.role
            };
            
            localStorage.setItem('user', JSON.stringify(userData));
            console.log('User data stored:', userData);
            
            // Redirect based on role
            if (userData.role === 'admin') {
                console.log('Redirecting to admin dashboard...');
                window.location.href = 'admin.html';
            } else if (userData.role === 'agent') {
                console.log('Redirecting to agent dashboard...');
                window.location.href = 'agent-dashboard.html';
            } else {
                console.log('Redirecting to home page...');
                window.location.href = 'home.html';
            }
        } else {
            throw new Error('Invalid token format');
        }
        
    } catch (err) {
        console.error('Login error:', err);
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign In';
        showAlert(err.message || 'Login failed', 'error', 'Login Failed');
    }
}

async function performSignup(event) {
    event.preventDefault();
    
    const firstNameInput = document.getElementById('signup-first-name').value.trim();
    const lastNameInput = document.getElementById('signup-last-name').value.trim();
    const usernameInput = document.getElementById('signup-username').value.trim();
    const emailInput = document.getElementById('signup-email').value.trim();
    const passwordInput = document.getElementById('signup-password').value;
    const confirmPwdInput = document.getElementById('signup-confirm-password').value;
    const roleInput = document.querySelector('input[name="role"]:checked').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    if (passwordInput !== confirmPwdInput) {
        showNotification('Passwords do not match', 'error');
        return;
    }
    
    if (!usernameInput) {
        showNotification('Username is required', 'error');
        return;
    }
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    
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
                role: roleInput
            })
        });
        
        const responseData = await signupResponse.json();
        
        if (!signupResponse.ok) {
            throw new Error(responseData.detail || 'Registration failed');
        }
        
        document.getElementById('success-title').textContent = 'Account Created!';
        document.getElementById('success-message').textContent = 
            'Please check your email to verify your account before logging in.';
        showStep('success');
        
        setTimeout(() => {
            showStep('login');
            showNotification('Please verify your email before logging in', 'info');
        }, 4000);
        
    } catch (err) {
        console.error('Signup error:', err);
        showNotification(err.message || 'Registration failed. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Sign Up';
    }
}

async function requestPasswordReset(event) {
    event.preventDefault();
    
    const emailInput = document.getElementById('forgot-email').value;
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending...';
    
    try {
        showNotification('Password reset feature coming soon!', 'info');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Link';
        
        setTimeout(() => {
            showStep('login');
        }, 2000);
        
    } catch (err) {
        console.error('Password reset error:', err);
        showNotification('Failed to send reset email. Please try again.', 'error');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Link';
    }
}

function extractJWTPayload(token) {
    try {
        const parts = token.split('.');
        const payload = parts[1];
        const decoded = payload.replace(/-/g, '+').replace(/_/g, '/');
        const jsonStr = decodeURIComponent(
            atob(decoded).split('').map(c => {
                return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
            }).join('')
        );
        return JSON.parse(jsonStr);
    } catch (e) {
        return {};
    }
}
