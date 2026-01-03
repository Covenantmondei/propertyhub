// Home page JavaScript

let userFavorites = [];

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication before loading page content
    checkAuthentication();
    loadUserFavorites();
    loadFeaturedProperties();
    setupHeaderSearch();
});

function autoShowSmartMatchForBuyers() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Only show for buyers (not agents or admins)
    if (user.role && user.role !== 'buyer') {
        return;
    }
    
    // Show on every login (for testing - adjust time threshold later if needed)
    // const lastShown = localStorage.getItem('smartMatchLastShown');
    // const now = Date.now();
    // const dayInMs = 24 * 60 * 60 * 1000; // 24 hours
    
    // if (!lastShown || (now - parseInt(lastShown)) > dayInMs) {
        // Delay popup slightly to let page load
        setTimeout(() => {
            if (typeof openSmartMatchModal === 'function') {
                openSmartMatchModal();
                // localStorage.setItem('smartMatchLastShown', now.toString());
            }
        }, 800);
    // }
}

function checkAuthentication() {
    const authToken = localStorage.getItem('authToken');
    
    if (!authToken) {
        // User is not authenticated, redirect to login
        showNotification('Please login to access this page', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        return false;
    }
    
    return true;
}

async function loadUserFavorites() {
    try {
        const favorites = await apiCall('/properties/favorites/me');
        userFavorites = favorites.map(f => f.id);
        console.log('User favorites loaded:', userFavorites);
    } catch (error) {
        console.error('Failed to load user favorites:', error);
        userFavorites = [];
    }
}

function setupHeaderSearch() {
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const searchBarContainer = document.getElementById('search-bar-container');
    const searchForm = document.getElementById('header-search-form');
    
    // Toggle search bar visibility
    if (searchToggleBtn && searchBarContainer) {
        searchToggleBtn.addEventListener('click', () => {
            if (searchBarContainer.style.display === 'none') {
                searchBarContainer.style.display = 'block';
            } else {
                searchBarContainer.style.display = 'none';
            }
        });
    }
    
    // Handle search form submission
    if (searchForm) {
        searchForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const formData = new FormData(searchForm);
            const params = new URLSearchParams();
            
            // Map form fields to backend query parameters
            const fieldMapping = {
                'minPrice': 'min_price',
                'maxPrice': 'max_price',
                'bedrooms': 'bedrooms',
                'bathrooms': 'bathrooms',
                'propertyType': 'property_type',
                'location': 'city'  // Simplified - backend uses city and state separately
            };
            
            for (const [key, value] of formData.entries()) {
                if (value) {
                    const backendKey = fieldMapping[key] || key;
                    params.append(backendKey, value);
                }
            }
            
            window.location.href = `properties.html?${params.toString()}`;
        });
    }
}

async function loadFeaturedProperties() {
    const container = document.getElementById('featured-properties');
    
    try {
        // Fetch real properties from the backend
        const properties = await apiCall('/properties/all?limit=6');

        if (!properties || properties.length === 0) {
            container.innerHTML = '<p class="text-center text-muted">No featured properties available.</p>';
            return;
        }

        // Wait for favorites to load if not already loaded
        if (userFavorites.length === 0) {
            await loadUserFavorites();
        }

        container.innerHTML = properties.map(property => createPropertyCard(property)).join('');
    } catch (error) {
        console.error('Failed to load properties:', error);
        showNotification('Failed to load properties', 'error');
        // Show empty state
        container.innerHTML = '<p class="text-center text-muted">Unable to load properties. Please try again later.</p>';
    }
}

function createPropertyCard(property) {
    // Map backend fields to display
    const status = property.is_available ? 'Available' : 'Unavailable';
    const statusClass = property.is_available ? 'available' : 'unavailable';
    const imageUrl = property.primary_image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop';
    const address = `${property.city}, ${property.state}`;
    const propertyType = property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1);
    const isFavorite = userFavorites.includes(property.id);
    
    return `
        <a href="property.html?id=${property.id}" class="property-card">
            <div class="card">
                <div class="property-image" style="position: relative;">
                    <img src="${imageUrl}" alt="${property.title}" onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop'">
                    <span class="badge badge-${statusClass} property-badge">${status}</span>
                    <button class="favorite-btn ${isFavorite ? 'active' : ''}" onclick="event.preventDefault(); event.stopPropagation(); toggleFavorite(${property.id}, this)" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
                </div>
                <div class="card-content">
                    <h3 class="property-title">${property.title}</h3>
                    <div class="property-location">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon icon-sm">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        <span>${address}</span>
                    </div>
                    <p class="property-price">${formatCurrency(property.price)}</p>
                </div>
                <div class="card-footer">
                    <div class="property-features">
                        ${property.bedrooms ? `
                        <div class="property-feature">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">
                                <path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9z"/>
                                <path d="M9 21V12h6v9"/>
                            </svg>
                            <span>${property.bedrooms}</span>
                        </div>
                        ` : ''}
                        ${property.bathrooms ? `
                        <div class="property-feature">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">
                                <path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1 0l-1 1a1.5 1.5 0 0 0 0 1L7 9"/>
                                <path d="M4.5 2.5v5h5"/>
                                <rect x="14" y="6" width="4" height="6" rx="1"/>
                            </svg>
                            <span>${property.bathrooms}</span>
                        </div>
                        ` : ''}
                        ${property.area_sqft ? `
                        <div class="property-feature">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" class="icon">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                            </svg>
                            <span>${formatNumber(property.area_sqft)} sq ft</span>
                        </div>
                        ` : ''}
                    </div>
                    <span class="badge badge-outline property-type">${propertyType}</span>
                </div>
            </div>
        </a>
    `;
}

async function toggleFavorite(propertyId, buttonElement) {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to save favorites', 'error');
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
            showNotification('Property removed from favorites', 'success');
        } else {
            // Add to favorites
            await apiCall(`/properties/${propertyId}/favorite`, { method: 'POST' });
            buttonElement.classList.add('active');
            buttonElement.title = 'Remove from favorites';
            userFavorites.push(propertyId);
            showNotification('Property added to favorites', 'success');
        }
    } catch (error) {
        console.error('Failed to update favorite:', error);
        showNotification('Failed to update favorites. Please try again.', 'error');
    }
}

// Make toggleFavorite available globally for inline onclick
window.toggleFavorite = toggleFavorite;

