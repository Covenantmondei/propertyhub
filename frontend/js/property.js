// Individual property page JavaScript

let propertyId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Property detail page loaded');
    
    propertyId = getUrlParameter('id');
    
    if (!propertyId) {
        showNotification('Property not found', 'error');
        setTimeout(() => {
            window.location.href = 'properties.html';
        }, 2000);
        return;
    }

    await loadPropertyDetails();
});

async function loadPropertyDetails() {
    const loadingState = document.getElementById('loading-state');
    const detailsSection = document.getElementById('property-details');
    
    try {
        // Fetch property details from backend - requires authentication
        const property = await apiCall(`/properties/${propertyId}`);

        loadingState.style.display = 'none';
        detailsSection.style.display = 'grid';
        displayPropertyDetails(property);
    } catch (error) {
        console.error('Failed to load property details:', error);
        
        loadingState.style.display = 'none';
        
        if (error.message.includes('401')) {
            showNotification('Please login to view property details', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
        } else {
            showNotification('Failed to load property details', 'error');
            setTimeout(() => {
                window.location.href = 'properties.html';
            }, 2000);
        }
    }
}

function displayPropertyDetails(property) {
    // Map backend fields to display
    const location = `${property.address}, ${property.city}, ${property.state} ${property.zip_code || ''}`.trim();
    const propertyType = property.property_type.charAt(0).toUpperCase() + property.property_type.slice(1);
    const listingType = property.listing_type.charAt(0).toUpperCase() + property.listing_type.slice(1);
    
    // Update badges
    document.getElementById('property-type-badge').textContent = `${propertyType} - For ${listingType}`;
    document.getElementById('property-status-badge').textContent = property.is_available ? 'Available' : 'Not Available';
    
    // Update basic information
    document.getElementById('property-title').textContent = property.title;
    document.getElementById('property-price').textContent = `₦${formatCurrency(property.price)}${property.listing_type === 'rent' ? ' / month' : ''}`;
    document.getElementById('property-location').textContent = location;
    document.getElementById('property-description').textContent = property.description;

    // Display property images
    const mainImageContainer = document.getElementById('main-image');
    const galleryContainer = document.getElementById('image-gallery');
    
    if (property.images && property.images.length > 0) {
        // Display primary image first
        const primaryImage = property.images.find(img => img.is_primary) || property.images[0];
        mainImageContainer.innerHTML = `
            <img src="${primaryImage.image_url}" alt="${property.title}" onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=400&fit=crop'">
            ${property.images.length > 1 ? `<div class="image-count">${property.images.length} Photos</div>` : ''}
        `;
        
        // Display thumbnail gallery if multiple images
        if (property.images.length > 1) {
            galleryContainer.innerHTML = property.images.map((img, idx) => `
                <div class="gallery-thumbnail ${img.is_primary ? 'active' : ''}" onclick="changeMainImage('${img.image_url}', this)">
                    <img src="${img.image_url}" alt="${property.title} ${idx + 1}" 
                         onerror="this.src='https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=200&h=150&fit=crop'">
                </div>
            `).join('');
        }
    } else {
        mainImageContainer.innerHTML = `
            <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=400&fit=crop" alt="${property.title}">
        `;
    }
    
    // Display property features
    const featuresContainer = document.getElementById('property-features');
    const features = [];
    
    if (property.bedrooms) {
        features.push({ icon: 'fa-bed', value: property.bedrooms, label: 'Bedrooms' });
    }
    if (property.bathrooms) {
        features.push({ icon: 'fa-bath', value: property.bathrooms, label: 'Bathrooms' });
    }
    if (property.area_sqft) {
        features.push({ icon: 'fa-ruler-combined', value: formatNumber(property.area_sqft), label: 'Sq Ft' });
    }
    if (property.parking_spaces) {
        features.push({ icon: 'fa-car', value: property.parking_spaces, label: 'Parking' });
    }
    if (property.year_built) {
        features.push({ icon: 'fa-calendar', value: property.year_built, label: 'Year Built' });
    }
    
    featuresContainer.innerHTML = features.map(f => `
        <div class="feature-item">
            <i class="fas ${f.icon}"></i>
            <span class="feature-value">${f.value}</span>
            <span class="feature-label">${f.label}</span>
        </div>
    `).join('');
    
    // Display additional details
    const additionalDetailsContainer = document.getElementById('property-additional-details');
    additionalDetailsContainer.innerHTML = `
        <div class="details-grid">
            <h3>Property Details</h3>
            <div class="detail-row">
                <i class="fas fa-tag"></i>
                <strong>Property Type:</strong>
                <span>${propertyType}</span>
            </div>
            <div class="detail-row">
                <i class="fas fa-dollar-sign"></i>
                <strong>Listing Type:</strong>
                <span>For ${listingType}</span>
            </div>
            <div class="detail-row">
                <i class="fas fa-map-marker-alt"></i>
                <strong>Address:</strong>
                <span>${property.address}</span>
            </div>
            <div class="detail-row">
                <i class="fas fa-city"></i>
                <strong>City:</strong>
                <span>${property.city}</span>
            </div>
            <div class="detail-row">
                <i class="fas fa-map"></i>
                <strong>State:</strong>
                <span>${property.state}</span>
            </div>
            ${property.zip_code ? `
                <div class="detail-row">
                    <i class="fas fa-mail-bulk"></i>
                    <strong>Zip Code:</strong>
                    <span>${property.zip_code}</span>
                </div>
            ` : ''}
            <div class="detail-row">
                <i class="fas fa-clock"></i>
                <strong>Listed On:</strong>
                <span>${formatDate(property.created_at)}</span>
            </div>
            <div class="detail-row">
                <i class="fas fa-check-circle"></i>
                <strong>Status:</strong>
                <span>${property.is_available ? 'Available' : 'Not Available'}</span>
            </div>
        </div>
    `;
    
    // Display amenities if available
    const amenitiesContainer = document.getElementById('property-amenities');
    if (property.amenities) {
        try {
            const amenities = JSON.parse(property.amenities);
            if (Array.isArray(amenities) && amenities.length > 0) {
                amenitiesContainer.innerHTML = `
                    <div class="amenities-section">
                        <h3>Amenities</h3>
                        <ul class="amenities-list">
                            ${amenities.map(a => `<li>${a}</li>`).join('')}
                        </ul>
                    </div>
                `;
            }
        } catch (e) {
            console.log('Could not parse amenities:', e);
        }
    }

    // Update page title
    document.title = `${property.title} - Real Estate`;
}

function changeMainImage(imageUrl, thumbnailElement) {
    const mainImageContainer = document.getElementById('main-image');
    const mainImg = mainImageContainer.querySelector('img');
    if (mainImg) {
        mainImg.src = imageUrl;
    }
    
    // Update active thumbnail
    document.querySelectorAll('.gallery-thumbnail').forEach(thumb => {
        thumb.classList.remove('active');
    });
    
    if (thumbnailElement) {
        thumbnailElement.classList.add('active');
    }
}

async function contactAgent() {
    if (!isAuthenticated()) {
        showNotification('Please login to contact the agent', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    const user = getUser();
    if (user.role === 'agent') {
        showNotification('Agents cannot contact themselves', 'info');
        return;
    }

    // Show prompt to get message
    const message = await showPrompt(
        'Send a message to the property agent',
        {
            title: 'Contact Agent',
            placeholder: 'Hi, I\'m interested in this property...',
            textarea: true,
            confirmText: 'Send Message'
        }
    );

    if (!message) return;

    try {
        const response = await apiCall('/chat/conversations', {
            method: 'POST',
            body: JSON.stringify({
                property_id: propertyId,
                message: message
            })
        });

        showNotification('Message sent successfully!', 'success');
        
        // Redirect to chat after 1 second
        setTimeout(() => {
            window.location.href = `chat.html?conversation=${response.id}`;
        }, 1000);

    } catch (error) {
        console.error('Failed to send message:', error);
        
        if (error.message.includes('already exists')) {
            showNotification('You already have a conversation for this property', 'info');
            // Try to find and open the conversation
            setTimeout(() => {
                window.location.href = 'chat.html';
            }, 1500);
        } else {
            showNotification('Failed to send message', 'error');
        }
    }
}

function scheduleVisit() {
    if (!isAuthenticated()) {
        showNotification('Please login to schedule a visit', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    showNotification('Visit scheduling will be implemented soon', 'info');
}

// Helper function to format currency
function formatCurrency(value) {
    return new Intl.NumberFormat('en-NG', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(value);
}

// Helper function to format numbers
function formatNumber(value) {
    return new Intl.NumberFormat('en-US').format(value);
}

// Helper function to format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
