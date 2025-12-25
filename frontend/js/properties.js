// Properties listing page JavaScript

let allProperties = [];
let currentFilters = {};
let userFavorites = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Properties page loaded');
    
    // Get URL parameters if any
    currentFilters = getAllUrlParameters();
    
    await loadUserFavorites();
    await loadProperties();
    setupFilters();
    populateFiltersFromUrl();
});

async function loadUserFavorites() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        userFavorites = [];
        return;
    }
    
    try {
        const favorites = await apiCall('/properties/favorites/me');
        userFavorites = favorites.map(f => f.id);
        console.log('User favorites loaded:', userFavorites);
    } catch (error) {
        console.error('Failed to load user favorites:', error);
        userFavorites = [];
    }
}

async function loadProperties() {
    const container = document.getElementById('properties-container');
    
    container.innerHTML = '<div class="loading-message"><p>Loading properties...</p></div>';
    
    try {
        const queryParams = new URLSearchParams();
        
        for (const [key, value] of Object.entries(currentFilters)) {
            if (value) {
                queryParams.append(key, value);
            }
        }
        
        if (!queryParams.has('limit')) {
            queryParams.append('limit', '50');
        }
        
        const queryString = queryParams.toString();
        const endpoint = `/properties/all${queryString ? '?' + queryString : ''}`;
        
        console.log('Fetching from:', `${API_BASE_URL}${endpoint}`);
        
        allProperties = await apiCall(endpoint);
        
        console.log('Loaded properties count:', allProperties.length);

        displayProperties(allProperties);
    } catch (error) {
        console.error('Failed to load properties:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>Unable to load properties</p>
                <p style="font-size: 0.9rem; color: #e74c3c; margin-top: 0.5rem;">${error.message}</p>
                <p style="font-size: 0.85rem; margin-top: 1rem; color: #7f8c8d;">Check that backend is running at ${API_BASE_URL}</p>
                <button onclick="loadProperties()" class="btn btn-primary" style="margin-top: 1rem;">Try Again</button>
            </div>
        `;
    }
}

function populateFiltersFromUrl() {
    // Populate filter inputs with URL parameters
    if (currentFilters.city) {
        const searchInput = document.getElementById('search');
        if (searchInput) searchInput.value = currentFilters.city;
    }
    
    if (currentFilters.property_type) {
        const typeSelect = document.getElementById('type');
        if (typeSelect) typeSelect.value = currentFilters.property_type;
    }
}

function displayProperties(properties) {
    const container = document.getElementById('properties-container');

    if (!properties || properties.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                <p class="no-properties">No approved properties available</p>
                <p style="font-size: 0.9rem; color: #7f8c8d; margin-top: 0.5rem;">Properties need admin approval before appearing here</p>
            </div>
        `;
        return;
    }

    const token = localStorage.getItem('authToken');
    const showFavorites = !!token;
    
    container.innerHTML = `
        <div class="properties-grid">
            ${properties.map(property => {
                const imageUrl = property.primary_image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop';
                const location = `${property.city}, ${property.state}`;
                const propertyType = property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1);
                const isFavorite = userFavorites.includes(property.id);
                
                return `
                    <div class="property-card">
                        <div class="property-card-image" onclick="viewProperty(${property.id})">
                            <img src="${imageUrl}" alt="${property.title}" onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop'">
                            ${showFavorites ? `
                                <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="event.stopPropagation(); toggleFavorite(${property.id}, this)" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                                    <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                    </svg>
                                </button>
                            ` : ''}
                        </div>
                        <div class="property-card-content" onclick="viewProperty(${property.id})">
                            <h3>${property.title}</h3>
                            <p class="price">${formatCurrency(property.price)}</p>
                            <p class="location">${location}</p>
                            <div class="property-details">
                                ${property.bedrooms ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/><path d="M9 21V12h6v9"/></svg> ${property.bedrooms} bed</span>` : ''}
                                ${property.bathrooms ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="14" y="6" width="4" height="6" rx="1"/></svg> ${property.bathrooms} bath</span>` : ''}
                                ${property.area_sqft ? `<span><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg> ${formatNumber(property.area_sqft)} sqft</span>` : ''}
                            </div>
                            <span class="type">${propertyType}</span>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function setupFilters() {
    const searchInput = document.getElementById('search');
    const typeSelect = document.getElementById('type');

    if (searchInput) {
        searchInput.addEventListener('input', debounce(filterProperties, 500));
    }
    
    if (typeSelect) {
        typeSelect.addEventListener('change', filterProperties);
    }
}

function filterProperties() {
    const searchTerm = document.getElementById('search')?.value?.toLowerCase() || '';
    const selectedType = document.getElementById('type')?.value || '';

    // Client-side filtering on already loaded properties
    const filtered = allProperties.filter(property => {
        const matchesSearch = !searchTerm || 
            property.title.toLowerCase().includes(searchTerm) ||
            property.city.toLowerCase().includes(searchTerm) ||
            property.state.toLowerCase().includes(searchTerm);
        
        const matchesType = !selectedType || property.property_type === selectedType;

        return matchesSearch && matchesType;
    });

    displayProperties(filtered);
}

async function toggleFavorite(propertyId, buttonElement) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showAlert('Please log in to save favorites', 'error');
        window.location.href = 'login.html';
        return;
    }
    
    const isActive = buttonElement.classList.contains('active');
    
    try {
        if (isActive) {
            // Remove from favorites
            await apiCall(`/properties/${propertyId}/unfavorite`, { method: 'DELETE' });
            buttonElement.classList.remove('active');
            buttonElement.title = 'Add to favorites';
            userFavorites = userFavorites.filter(id => id !== propertyId);
            showAlert('Property removed from favorites', 'success');
        } else {
            // Add to favorites
            await apiCall(`/properties/${propertyId}/favorite`, { method: 'POST' });
            buttonElement.classList.add('active');
            buttonElement.title = 'Remove from favorites';
            userFavorites.push(propertyId);
            showAlert('Property added to favorites', 'success');
        }
    } catch (error) {
        console.error('Failed to update favorite:', error);
        showAlert('Failed to update favorites. Please try again.', 'error');
    }
}

function viewProperty(id) {
    window.location.href = `property.html?id=${id}`;
}

// Make toggleFavorite available globally for inline onclick
window.toggleFavorite = toggleFavorite;
window.viewProperty = viewProperty;
window.togglePropertyFavorite = togglePropertyFavorite;