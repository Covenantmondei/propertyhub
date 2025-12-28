// Agent Dashboard JavaScript

document.addEventListener('DOMContentLoaded', () => {
    console.log('Agent Dashboard loaded');
    
    // Check if user is authenticated and is an agent
    const user = getUser();
    if (!isAuthenticated() || !user) {
        showNotification('Please login to access the dashboard', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return;
    }

    if (user.role !== 'agent') {
        showNotification('Access denied. Only agents can access this dashboard', 'error');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 2000);
        return;
    }

    // Initialize dashboard
    initDashboard();
    
    // Setup filter buttons
    setupFilters();
    
    // Setup messages link
    setupMessagesLink();
    
    // Load KYC status
    loadKYCStatus();
});

async function initDashboard() {
    const user = getUser();
    
    // Set agent name
    document.getElementById('agent-name').textContent = user.full_name || user.username || 'Agent';
    
    // Load dashboard data
    await loadDashboardStats();
    await loadAgentProperties();
}

async function loadDashboardStats() {
    try {
        // Fetch agent's properties to calculate stats
        const properties = await apiCall('/properties/agent/me');
        
        const total = properties.length;
        const approved = properties.filter(p => p.is_approved).length;
        const pending = properties.filter(p => !p.is_approved).length;
        
        // Update stats
        document.getElementById('total-properties').textContent = total;
        document.getElementById('approved-properties').textContent = approved;
        document.getElementById('pending-properties').textContent = pending;
        
        // Load pending visits count
        try {
            const visits = await apiCall('/visit/agent-requests');
            const pendingVisits = visits.filter(v => v.status === 'pending' || v.status === 'proposed_reschedule').length;
            document.getElementById('pending-visits').textContent = pendingVisits;
        } catch (error) {
            console.error('Failed to load visits:', error);
            document.getElementById('pending-visits').textContent = '0';
        }
        
        // TODO: Load messages count when chat API is integrated
        document.getElementById('total-messages').textContent = '0';
        
    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        // Set to 0 on error
        document.getElementById('total-properties').textContent = '0';
        document.getElementById('approved-properties').textContent = '0';
        document.getElementById('pending-properties').textContent = '0';
        document.getElementById('total-messages').textContent = '0';
        document.getElementById('pending-visits').textContent = '0';
    }
}

async function loadAgentProperties() {
    const loadingEl = document.getElementById('loading-properties');
    const emptyEl = document.getElementById('empty-state');
    const gridEl = document.getElementById('properties-grid');
    
    try {
        loadingEl.style.display = 'block';
        emptyEl.style.display = 'none';
        gridEl.style.display = 'none';
        
        const properties = await apiCall('/properties/agent/me');
        
        // Store properties globally for filtering
        window.agentProperties = properties;
        
        loadingEl.style.display = 'none';
        
        if (properties.length === 0) {
            emptyEl.style.display = 'block';
        } else {
            gridEl.style.display = 'grid';
            renderProperties(properties);
        }
        
    } catch (error) {
        console.error('Failed to load properties:', error);
        loadingEl.style.display = 'none';
        emptyEl.style.display = 'block';
        showNotification('Failed to load properties', 'error');
    }
}

function renderProperties(properties) {
    const gridEl = document.getElementById('properties-grid');
    
    if (properties.length === 0) {
        document.getElementById('empty-state').style.display = 'block';
        gridEl.style.display = 'none';
        return;
    }
    
    document.getElementById('empty-state').style.display = 'none';
    gridEl.style.display = 'grid';
    
    gridEl.innerHTML = properties.map(property => createPropertyCard(property)).join('');
    
    // Add event listeners to action buttons
    setupPropertyActions();
}

function createPropertyCard(property) {
    const statusClass = property.is_approved ? 'approved' : 'pending';
    const statusText = property.is_approved ? 'Approved' : 'Pending';
    
    const imageUrl = property.images && property.images.length > 0 
        ? property.images[0].image_url
        : 'assets/placeholder.svg';
    
    const bedrooms = property.bedrooms || 'N/A';
    const bathrooms = property.bathrooms || 'N/A';
    const area = property.area_sqft ? `${property.area_sqft.toLocaleString()} sqft` : 'N/A';
    
    return `
        <div class="property-card" data-property-id="${property.id}" data-status="${statusClass}">
            <img src="${imageUrl}" alt="${property.title}" class="property-image" 
                 onerror="this.src='assets/placeholder.svg'">
            <div class="property-status ${statusClass}">${statusText}</div>
            
            <div class="property-content">
                <span class="property-type-badge">${property.property_type}</span>
                <h3 class="property-title">${property.title}</h3>
                <div class="property-location">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>${property.city}, ${property.state}</span>
                </div>
                <div class="property-price">₦${property.price.toLocaleString()}</div>
                
                <div class="property-details">
                    <div class="detail-item">
                        <i class="fas fa-bed"></i>
                        <span>${bedrooms}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-bath"></i>
                        <span>${bathrooms}</span>
                    </div>
                    <div class="detail-item">
                        <i class="fas fa-ruler-combined"></i>
                        <span>${area}</span>
                    </div>
                </div>
                
                <div class="property-actions">
                    <button class="btn btn-primary btn-view" data-id="${property.id}">
                        <i class="fas fa-eye"></i>
                        View
                    </button>
                    <button class="btn btn-secondary btn-edit" data-id="${property.id}">
                        <i class="fas fa-edit"></i>
                        Edit
                    </button>
                    <button class="btn btn-danger btn-delete" data-id="${property.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function setupPropertyActions() {
    // View buttons
    document.querySelectorAll('.btn-view').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const propertyId = e.currentTarget.getAttribute('data-id');
            window.location.href = `property.html?id=${propertyId}`;
        });
    });
    
    // Edit buttons
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const propertyId = e.currentTarget.getAttribute('data-id');
            // TODO: Create edit property page
            showNotification('Edit functionality coming soon', 'info');
        });
    });
    
    // Delete buttons
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const propertyId = e.currentTarget.getAttribute('data-id');
            const confirmed = await showConfirm(
                'Are you sure you want to delete this property? This action cannot be undone.',
                { title: 'Delete Property', confirmText: 'Delete', danger: true }
            );
            if (confirmed) {
                await deleteProperty(propertyId);
            }
        });
    });
}

async function deleteProperty(propertyId) {
    try {
        await apiCall(`/properties/${propertyId}/delete`, {
            method: 'DELETE'
        });
        
        showNotification('Property deleted successfully', 'success');
        
        // Remove from stored properties
        window.agentProperties = window.agentProperties.filter(p => p.id !== parseInt(propertyId));
        
        // Reload dashboard
        await loadDashboardStats();
        renderProperties(window.agentProperties);
        
    } catch (error) {
        console.error('Failed to delete property:', error);
        showNotification('Failed to delete property', 'error');
    }
}

function setupFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Filter properties
            const filter = btn.getAttribute('data-filter');
            filterProperties(filter);
        });
    });
}

function filterProperties(filter) {
    if (!window.agentProperties) return;
    
    let filtered = window.agentProperties;
    
    if (filter === 'approved') {
        filtered = window.agentProperties.filter(p => p.is_approved);
    } else if (filter === 'pending') {
        filtered = window.agentProperties.filter(p => !p.is_approved);
    }
    
    renderProperties(filtered);
}

function setupMessagesLink() {
    // Messages link now goes directly to chat.html
    // No need for event handler
}

function scrollToProperties() {
    const section = document.querySelector('.properties-section');
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}
// KYC Status and Eligibility
async function loadKYCStatus() {
    try {
        // Get KYC status
        const kycStatus = await apiCall('/kyc/status');
        
        // Get eligibility
        const eligibility = await apiCall('/kyc/eligibility');
        
        displayKYCAlert(kycStatus, eligibility);
        
    } catch (error) {
        console.error('Failed to load KYC status:', error);
    }
}

function displayKYCAlert(kycStatus, eligibility) {
    const alertContainer = document.getElementById('kycStatusAlert');
    
    // If verified and eligible, don't show alert
    if (kycStatus.kyc_status === 'verified' && eligibility.eligible) {
        alertContainer.style.display = 'none';
        return;
    }
    
    let alertHTML = '';
    let alertClass = '';
    
    if (kycStatus.kyc_status === 'not_submitted') {
        // KYC not submitted
        alertClass = 'alert-warning';
        alertHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            <div class="alert-content">
                <div class="alert-title">Complete Your KYC Verification</div>
                <div class="alert-message">
                    To list properties and accept visit requests, you need to complete your identity verification (KYC). 
                    This process helps maintain trust and security on our platform.
                </div>
                <div class="eligibility-details">
                    <strong>⚠️ Limited Access:</strong>
                    <ul>
                        <li>Cannot list new properties</li>
                        <li>Cannot accept visit requests</li>
                        <li>Cannot communicate with buyers</li>
                    </ul>
                </div>
                <div class="alert-actions">
                    <a href="kyc-verification.html" class="alert-btn alert-btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="9 11 12 14 22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        Start Verification
                    </a>
                    <a href="faq.html" class="alert-btn alert-btn-secondary">
                        Learn More
                    </a>
                </div>
            </div>
        `;
    } else if (kycStatus.kyc_status === 'pending_review') {
        // KYC pending review
        alertClass = 'alert-info';
        alertHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
            </svg>
            <div class="alert-content">
                <div class="alert-title">KYC Verification In Progress</div>
                <div class="alert-message">
                    Your KYC submission is being reviewed by our team. This usually takes 1-2 business days. 
                    You'll receive a notification once your verification is complete.
                </div>
                ${!eligibility.eligible ? `
                    <div class="eligibility-details">
                        <strong>ℹ️ Temporary Restrictions:</strong>
                        <ul>
                            <li>Cannot list new properties</li>
                            <li>Cannot accept visit requests</li>
                        </ul>
                    </div>
                ` : ''}
                <div class="alert-actions">
                    <a href="kyc-verification.html" class="alert-btn alert-btn-secondary">
                        View Submission
                    </a>
                </div>
            </div>
        `;
    } else if (kycStatus.kyc_status === 'rejected') {
        // KYC rejected
        alertClass = 'alert-danger';
        alertHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
            <div class="alert-content">
                <div class="alert-title">KYC Verification Rejected</div>
                <div class="alert-message">
                    ${kycStatus.kyc_rejection_reason || 'Your KYC submission was rejected. Please review the information and documents, then resubmit.'}
                </div>
                <div class="eligibility-details">
                    <strong>⛔ Account Restrictions:</strong>
                    <ul>
                        <li>Cannot list new properties</li>
                        <li>Cannot accept visit requests</li>
                        <li>Cannot communicate with buyers</li>
                    </ul>
                </div>
                <div class="alert-actions">
                    <a href="kyc-verification.html" class="alert-btn alert-btn-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6"/>
                            <path d="M2.5 22v-6h6"/>
                            <path d="M2 11.5a10 10 0 0 1 18.8-4.3"/>
                            <path d="M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        Resubmit KYC
                    </a>
                    <a href="contact.html" class="alert-btn alert-btn-secondary">
                        Contact Support
                    </a>
                </div>
            </div>
        `;
    }
    
    alertContainer.innerHTML = alertHTML;
    alertContainer.className = alertClass;
    alertContainer.style.display = 'flex';
}