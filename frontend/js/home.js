// Home page JavaScript

document.addEventListener('DOMContentLoaded', () => {
    // Check authentication before loading page content
    checkAuthentication();
    loadFeaturedProperties();
    setupHeaderSearch();
});

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
    
    return `
        <a href="property.html?id=${property.id}" class="property-card">
            <div class="card">
                <div class="property-image">
                    <img src="${imageUrl}" alt="${property.title}" onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop'">
                    <span class="badge badge-${statusClass} property-badge">${status}</span>
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

