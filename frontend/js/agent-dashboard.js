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
