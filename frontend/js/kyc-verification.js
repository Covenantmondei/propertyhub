let currentStep = 1;
let kycData = {
    info: null,
    idFile: null,
    selfieFile: null
};
let currentCamera = null;
let cameraStream = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    if (!isAuthenticated()) {
        showNotification('Please login to access this page', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
    
    const user = getUser();
    if (user.role !== 'agent') {
        showNotification('Only agents can access KYC verification', 'error');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 1500);
        return;
    }
    
    await loadKYCStatus();
    
    // Set up form handlers
    document.getElementById('kycInfoForm').addEventListener('submit', handleInfoSubmit);
    document.getElementById('idFileInput').addEventListener('change', handleIdFileSelect);
    document.getElementById('selfieFileInput').addEventListener('change', handleSelfieFileSelect);
});

async function loadKYCStatus() {
    try {
        const status = await window.apiCall('/kyc/status');
        displayKYCStatus(status);
        
        // If already verified, show message and disable form
        if (status.kyc_status === 'verified') {
            document.querySelectorAll('input, select, button').forEach(el => {
                if (!el.classList.contains('modal-close') && el.id !== 'userMenuBtn' && el.id !== 'notificationsBtn') {
                    el.disabled = true;
                }
            });
        }
        
        // Pre-fill form if data exists
        if (status.phone_number) {
            document.getElementById('phoneNumber').value = status.phone_number || '';
            document.getElementById('company').value = status.company || '';
            document.getElementById('idType').value = status.id_type || '';
            document.getElementById('idNumber').value = status.id_number || '';
            
            // Mark info as saved
            kycData.info = {
                phone_number: status.phone_number,
                company: status.company,
                id_type: status.id_type,
                id_number: status.id_number
            };
        }
        
        // Show uploaded documents if exist
        if (status.government_id_url) {
            showExistingIdImage(status.government_id_url);
        }
        if (status.selfie_url) {
            showExistingSelfieImage(status.selfie_url);
        }
        
    } catch (error) {
        console.error('Failed to load KYC status:', error);
        // If no KYC data exists, that's fine - they're starting fresh
    }
}

function displayKYCStatus(status) {
    const banner = document.getElementById('kycStatusBanner');
    let message = '';
    let statusClass = '';
    
    switch (status.kyc_status) {
        case 'not_submitted':
            return; // Don't show banner
        case 'pending_review':
            message = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <div>
                    <strong>Pending Review</strong><br>
                    Your KYC submission is being reviewed by our team. This usually takes 1-2 business days.
                </div>
            `;
            statusClass = 'status-pending';
            break;
        case 'verified':
            message = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                    <circle cx="12" cy="12" r="10"/>
                </svg>
                <div>
                    <strong>Verified!</strong><br>
                    Your identity has been verified. You can now list properties and accept visit requests.
                </div>
            `;
            statusClass = 'status-verified';
            break;
        case 'rejected':
            message = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="15" y1="9" x2="9" y2="15"/>
                    <line x1="9" y1="9" x2="15" y2="15"/>
                </svg>
                <div>
                    <strong>Verification Rejected</strong><br>
                    ${status.kyc_rejection_reason || 'Please review and update your information, then resubmit.'}
                </div>
            `;
            statusClass = 'status-rejected';
            break;
    }
    
    banner.innerHTML = message;
    banner.className = `kyc-status-banner ${statusClass}`;
    banner.style.display = 'flex';
}

// Step Navigation
function goToStep(step) {
    // Validate before proceeding
    if (step === 2 && !kycData.info) {
        showNotification('Please complete the personal information form first', 'error');
        return;
    }
    
    if (step === 3) {
        if (!kycData.info) {
            showNotification('Please complete the personal information form', 'error');
            goToStep(1);
            return;
        }
        if (!kycData.idFile && !document.getElementById('idPreviewImg').src) {
            showNotification('Please upload your government ID', 'error');
            goToStep(2);
            return;
        }
        if (!kycData.selfieFile && !document.getElementById('selfiePreviewImg').src) {
            showNotification('Please upload a selfie with your ID', 'error');
            goToStep(2);
            return;
        }
        populateReview();
    }
    
    // Hide all steps
    document.querySelectorAll('.kyc-step').forEach(s => s.style.display = 'none');
    
    // Show target step
    document.getElementById(`step${step}`).style.display = 'block';
    
    // Update progress
    document.querySelectorAll('.progress-step').forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i + 1 < step) s.classList.add('completed');
        if (i + 1 === step) s.classList.add('active');
    });
    
    currentStep = step;
    
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Handle Personal Info Form
async function handleInfoSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const data = {
        phone_number: formData.get('phone_number'),
        id_type: formData.get('id_type'),
        id_number: formData.get('id_number'),
        company: formData.get('company') || null
    };
    
    try {
        const response = await window.apiCall('/kyc/submit', {
            method: 'POST',
            body: JSON.stringify(data)
        });
        
        kycData.info = data;
        showNotification('Personal information saved', 'success');
        goToStep(2);
        
    } catch (error) {
        console.error('Failed to submit KYC info:', error);
        showNotification(error.message || 'Failed to save information', 'error');
    }
}

// ID File Selection
function handleIdFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('File size must be less than 5MB', 'error');
        return;
    }
    
    kycData.idFile = file;
    previewIdFile(file);
}

function previewIdFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('idPreviewImg').src = e.target.result;
        document.getElementById('idPreview').style.display = 'block';
        document.getElementById('idUploadActions').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function showExistingIdImage(url) {
    document.getElementById('idPreviewImg').src = url;
    document.getElementById('idPreview').style.display = 'block';
    document.getElementById('idUploadActions').style.display = 'none';
}

function removeIdImage() {
    kycData.idFile = null;
    document.getElementById('idPreview').style.display = 'none';
    document.getElementById('idUploadActions').style.display = 'flex';
    document.getElementById('idFileInput').value = '';
}

// Selfie File Selection
function handleSelfieFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showNotification('File size must be less than 5MB', 'error');
        return;
    }
    
    kycData.selfieFile = file;
    previewSelfieFile(file);
}

function previewSelfieFile(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        document.getElementById('selfiePreviewImg').src = e.target.result;
        document.getElementById('selfiePreview').style.display = 'block';
        document.getElementById('selfieUploadActions').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function showExistingSelfieImage(url) {
    document.getElementById('selfiePreviewImg').src = url;
    document.getElementById('selfiePreview').style.display = 'block';
    document.getElementById('selfieUploadActions').style.display = 'none';
}

function removeSelfieImage() {
    kycData.selfieFile = null;
    document.getElementById('selfiePreview').style.display = 'none';
    document.getElementById('selfieUploadActions').style.display = 'flex';
    document.getElementById('selfieFileInput').value = '';
}

// Camera Functions
async function openIdCamera() {
    currentCamera = 'id';
    document.getElementById('cameraModalTitle').textContent = 'Take Photo of ID';
    document.getElementById('cameraOverlay').style.display = 'block';
    await openCamera();
}

async function openSelfieCamera() {
    currentCamera = 'selfie';
    document.getElementById('cameraModalTitle').textContent = 'Take Selfie with ID';
    document.getElementById('cameraOverlay').style.display = 'block';
    await openCamera();
}

async function openCamera() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: currentCamera === 'selfie' ? 'user' : 'environment',
                width: { ideal: 1280 },
                height: { ideal: 720 }
            }
        });
        
        video.srcObject = cameraStream;
        modal.classList.add('active');
        
    } catch (error) {
        console.error('Camera access error:', error);
        showNotification('Could not access camera. Please check permissions or upload from gallery.', 'error');
    }
}

function closeCameraModal() {
    const modal = document.getElementById('cameraModal');
    const video = document.getElementById('cameraVideo');
    
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }
    
    video.srcObject = null;
    modal.classList.remove('active');
    currentCamera = null;
}

function capturePhoto() {
    const video = document.getElementById('cameraVideo');
    const canvas = document.getElementById('cameraCanvas');
    const ctx = canvas.getContext('2d');
    
    // Set canvas size to video size
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0);
    
    // Convert to blob
    canvas.toBlob((blob) => {
        const file = new File([blob], `${currentCamera}_${Date.now()}.jpg`, { type: 'image/jpeg' });
        
        if (currentCamera === 'id') {
            kycData.idFile = file;
            previewIdFile(file);
        } else {
            kycData.selfieFile = file;
            previewSelfieFile(file);
        }
        
        closeCameraModal();
        showNotification('Photo captured successfully', 'success');
    }, 'image/jpeg', 0.9);
}

// Populate Review
function populateReview() {
    // Personal info
    document.getElementById('reviewPhone').textContent = kycData.info.phone_number;
    document.getElementById('reviewCompany').textContent = kycData.info.company || 'Not provided';
    document.getElementById('reviewIdType').textContent = kycData.info.id_type.replace('_', ' ').toUpperCase();
    document.getElementById('reviewIdNumber').textContent = kycData.info.id_number;
    
    // Documents
    const idPreviewImg = document.getElementById('idPreviewImg').src;
    const selfiePreviewImg = document.getElementById('selfiePreviewImg').src;
    
    document.getElementById('reviewIdPreview').innerHTML = idPreviewImg 
        ? `<img src="${idPreviewImg}" alt="Government ID">` 
        : '<span style="color: var(--muted-foreground);">Not uploaded</span>';
    
    document.getElementById('reviewSelfiePreview').innerHTML = selfiePreviewImg 
        ? `<img src="${selfiePreviewImg}" alt="Selfie">` 
        : '<span style="color: var(--muted-foreground);">Not uploaded</span>';
}

// Submit KYC
async function submitKYC() {
    // Validate terms agreement
    if (!document.getElementById('agreeTerms').checked) {
        showNotification('Please agree to the terms and conditions', 'error');
        return;
    }
    
    const submitBtn = document.getElementById('submitKycBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation: spin 1s linear infinite;">
            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
        </svg>
        Submitting...
    `;
    
    try {
        // Upload documents if new files provided
        if (kycData.idFile || kycData.selfieFile) {
            const formData = new FormData();
            
            // If new file provided, use it; otherwise use existing
            if (kycData.idFile) {
                formData.append('government_id', kycData.idFile);
            } else {
                // Fetch existing image and convert to file
                const idBlob = await fetch(document.getElementById('idPreviewImg').src).then(r => r.blob());
                formData.append('government_id', idBlob, 'existing_id.jpg');
            }
            
            if (kycData.selfieFile) {
                formData.append('selfie', kycData.selfieFile);
            } else {
                // Fetch existing image and convert to file
                const selfieBlob = await fetch(document.getElementById('selfiePreviewImg').src).then(r => r.blob());
                formData.append('selfie', selfieBlob, 'existing_selfie.jpg');
            }
            
            const token = localStorage.getItem('authToken');
            const response = await fetch(`${window.API_BASE_URL}/kyc/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to upload documents');
            }
        }
        
        showNotification('KYC submitted successfully! You will be notified once verified.', 'success');
        
        // Reload page after 2 seconds
        setTimeout(() => {
            window.location.href = 'agent-dashboard.html';
        }, 2000);
        
    } catch (error) {
        console.error('Failed to submit KYC:', error);
        showNotification(error.message || 'Failed to submit KYC', 'error');
        
        submitBtn.disabled = false;
        submitBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="20 6 9 17 4 12"/>
            </svg>
            Submit for Verification
        `;
    }
}