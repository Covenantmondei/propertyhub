// Favorites page JavaScript

let favoriteProperties = [];

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Favorites page loaded');
    
    // Check if user is logged in
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'login.html';
        return;
    }
    
    await loadFavorites();
});

async function loadFavorites() {
    const container = document.getElementById('favorites-container');
    
    container.innerHTML = '<div class="loading-message"><p>Loading your favorites...</p></div>';
    
    try {
        favoriteProperties = await apiCall('/properties/favorites/me');
        
        console.log('Loaded favorites count:', favoriteProperties.length);

        displayFavorites(favoriteProperties);
    } catch (error) {
        console.error('Failed to load favorites:', error);
        container.innerHTML = `
            <div class="error-message">
                <p>Unable to load your favorites</p>
                <p style="font-size: 0.9rem; color: #e74c3c; margin-top: 0.5rem;">${error.message}</p>
                <button onclick="loadFavorites()" class="btn btn-primary" style="margin-top: 1rem;">Try Again</button>
            </div>
        `;
    }
}

function displayFavorites(properties) {
    const container = document.getElementById('favorites-container');

    if (!properties || properties.length === 0) {
        container.innerHTML = `
            <div class="empty-message">
                <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                </svg>
                <p class="no-properties">No favorite properties yet</p>
                <p style="font-size: 0.9rem; color: #7f8c8d; margin-top: 0.5rem;">Start browsing properties and save your favorites</p>
                <a href="properties.html" class="btn btn-primary" style="margin-top: 1.5rem;">Browse Properties</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="properties-grid">
            ${properties.map(property => {
                const imageUrl = property.primary_image || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop';
                const location = `${property.city}, ${property.state}`;
                const propertyType = property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1);
                
                return `
                    <div class="property-card">
                        <div class="property-card-image" onclick="viewProperty(${property.id})">
                            <img src="${imageUrl}" alt="${property.title}" onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=400&h=300&fit=crop'">
                            <button class="favorite-btn active" onclick="event.stopPropagation(); toggleFavorite(${property.id}, this)" title="Remove from favorites">
                                <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2">
                                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                </svg>
                            </button>
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

async function toggleFavorite(propertyId, buttonElement) {
    const card = buttonElement.closest('.property-card');
    const isActive = buttonElement.classList.contains('active');
    
    try {
        if (isActive) {
            // Remove from favorites
            await apiCall(`/properties/${propertyId}/unfavorite`, 'DELETE');
            
            // Animate card removal
            card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.9)';
            
            setTimeout(() => {
                // Remove from array and re-render
                favoriteProperties = favoriteProperties.filter(p => p.id !== propertyId);
                displayFavorites(favoriteProperties);
                
                showAlert('Property removed from favorites', 'success');
            }, 300);
        }
    } catch (error) {
        console.error('Failed to update favorite:', error);
        showAlert('Failed to update favorites. Please try again.', 'error');
    }
}

function viewProperty(id) {
    window.location.href = `property.html?id=${id}`;
}
