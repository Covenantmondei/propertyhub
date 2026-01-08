// Individual property page JavaScript

let propertyId = null;
let isFavorite = false;

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
    await checkIfFavorite();
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
    document.getElementById('property-price').textContent = `₦${formatCurrency(property.price)}${property.listing_type === 'rent' ? ' / year' : ''}`;
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

    // Display agent profile section
    displayAgentProfile(property);

    // Update page title
    document.title = `${property.title} - Real Estate`;
}

// Display agent profile information
async function displayAgentProfile(property) {
    if (!property.agent) return;
    
    const agent = property.agent;
    const agentName = `${agent.first_name} ${agent.last_name}`;
    const agentInitials = `${agent.first_name[0]}${agent.last_name[0]}`.toUpperCase();
    
    // Store agent_id globally for viewAgentProfile function
    window.currentAgentId = agent.id;
    
    // Fetch agent reviews to get rating
    try {
        const reviewData = await apiCall(`/reviews/agent/${agent.id}`);
        const rating = reviewData.average_rating || 0;
        const totalReviews = reviewData.total_reviews || 0;
        
        // Display avatar
        document.getElementById('agent-avatar').textContent = agentInitials;
        
        // Display name
        document.getElementById('agent-name').textContent = agentName;
        
        // Display rating
        const ratingHTML = `
            <div class="stars">
                ${createStarRating(rating)}
            </div>
            <span class="rating-text">${rating.toFixed(1)} (${totalReviews} review${totalReviews !== 1 ? 's' : ''})</span>
        `;
        document.getElementById('agent-rating').innerHTML = ratingHTML;
        
        // Display contact
        document.getElementById('agent-contact').innerHTML = `
            <i class="fas fa-envelope"></i>${agent.email}
        `;
        
    } catch (error) {
        console.error('Error loading agent reviews:', error);
        // Display basic info even if reviews fail to load
        document.getElementById('agent-avatar').textContent = agentInitials;
        document.getElementById('agent-name').textContent = agentName;
        document.getElementById('agent-rating').innerHTML = `<span class="rating-text">No reviews yet</span>`;
        document.getElementById('agent-contact').innerHTML = `<i class="fas fa-envelope"></i>${agent.email}`;
    }
}

// Create star rating HTML
function createStarRating(rating) {
    let stars = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<span class="star">★</span>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<span class="star half">★</span>';
        } else {
            stars += '<span class="star empty">☆</span>';
        }
    }
    
    return stars;
}

// View agent profile
function viewAgentProfile() {
    if (window.currentAgentId) {
        window.location.href = `agent-profile.html?id=${window.currentAgentId}`;
    }
}

// Make it globally accessible
window.viewAgentProfile = viewAgentProfile;

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

    const user = getUser();
    if (user.role !== 'buyer') {
        showNotification('Only buyers can schedule property visits', 'info');
        return;
    }

    // Show schedule visit modal
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'schedule-visit-modal';
    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2><i class="fas fa-calendar-alt"></i> Schedule a Visit</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="schedule-visit-form" onsubmit="submitVisitRequest(event)">
                    <div class="form-group">
                        <label for="visit-type">Visit Type <span class="required">*</span></label>
                        <select id="visit-type" required class="form-input">
                            <option value="">Select visit type</option>
                            <option value="physical">Physical Visit - In-person property viewing</option>
                            <option value="virtual">Virtual Visit - Online video tour</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label for="preferred-date">Preferred Date <span class="required">*</span></label>
                        <input type="date" id="preferred-date" required class="form-input"
                               min="${new Date(Date.now() + 86400000).toISOString().split('T')[0]}">
                        <small class="form-help">Select your preferred date for the visit</small>
                    </div>
                    
                    <div class="form-row">
                        <div class="form-group">
                            <label for="start-time">Start Time <span class="required">*</span></label>
                            <input type="time" id="start-time" required class="form-input">
                        </div>
                        
                        <div class="form-group">
                            <label for="end-time">End Time <span class="required">*</span></label>
                            <input type="time" id="end-time" required class="form-input">
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label for="buyer-note">Additional Notes (Optional)</label>
                        <textarea id="buyer-note" rows="4" maxlength="500" class="form-input"
                                  placeholder="Add any special requests or questions..."></textarea>
                        <small class="form-help">Maximum 500 characters</small>
                    </div>
                    
                    <div class="visit-info-box">
                        <i class="fas fa-info-circle"></i>
                        <div>
                            <strong>What happens next?</strong>
                            <p>The property agent will review your request and either confirm your preferred time or propose an alternative. You'll be notified once they respond.</p>
                        </div>
                    </div>
                    
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary">
                            <i class="fas fa-calendar-check"></i> Request Visit
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Focus on visit type after a short delay
    setTimeout(() => {
        document.getElementById('visit-type').focus();
    }, 100);
}

async function submitVisitRequest(event) {
    event.preventDefault();
    
    const visitType = document.getElementById('visit-type').value;
    const preferredDate = document.getElementById('preferred-date').value;
    const startTime = document.getElementById('start-time').value;
    const endTime = document.getElementById('end-time').value;
    const buyerNote = document.getElementById('buyer-note').value.trim();
    
    // Validate time range
    if (startTime >= endTime) {
        showNotification('End time must be after start time', 'error');
        return;
    }
    
    // Validate date is in future
    const selectedDate = new Date(preferredDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (selectedDate < today) {
        showNotification('Please select a future date', 'error');
        return;
    }
    
    try {
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
        
        const response = await apiCall('/visit/request', {
            method: 'POST',
            body: JSON.stringify({
                property_id: parseInt(propertyId),
                visit_type: visitType,
                preferred_date: preferredDate,
                preferred_time_start: startTime,
                preferred_time_end: endTime,
                buyer_note: buyerNote || null
            })
        });
        
        showNotification('Visit request sent to agent successfully!', 'success');
        
        // Close modal
        document.getElementById('schedule-visit-modal').remove();
        
        // Redirect to visits page after a short delay
        setTimeout(() => {
            window.location.href = 'visits.html';
        }, 1500);
        
    } catch (error) {
        console.error('Failed to submit visit request:', error);
        
        const submitBtn = event.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fas fa-calendar-check"></i> Request Visit';
        
        if (error.message.includes('already have a pending visit')) {
            showNotification('You already have a pending visit request for this property', 'info');
            setTimeout(() => {
                window.location.href = 'visits.html';
            }, 2000);
        } else {
            showNotification(error.message || 'Failed to submit visit request', 'error');
        }
    }
}

async function checkIfFavorite() {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    
    // Show the favorite button if user is logged in
    const favoriteBtn = document.getElementById('favorite-btn');
    if (favoriteBtn) {
        favoriteBtn.style.display = 'flex';
    }
    
    try {
        const favorites = await apiCall('/properties/favorites/me');
        isFavorite = favorites.some(f => f.id === parseInt(propertyId));
        updateFavoriteButton();
    } catch (error) {
        console.error('Failed to check if property is favorite:', error);
    }
}

function updateFavoriteButton() {
    const favoriteBtn = document.getElementById('favorite-btn');
    if (!favoriteBtn) return;
    
    const heartIcon = favoriteBtn.querySelector('.heart-icon');
    if (isFavorite) {
        favoriteBtn.classList.add('active');
        favoriteBtn.title = 'Remove from favorites';
    } else {
        favoriteBtn.classList.remove('active');
        favoriteBtn.title = 'Add to favorites';
    }
}

async function togglePropertyFavorite() {
    const token = localStorage.getItem('authToken');
    if (!token) {
        showNotification('Please log in to save favorites', 'error');
        window.location.href = 'login.html';
        return;
    }
    
    const favoriteBtn = document.getElementById('favorite-btn');
    
    try {
        if (isFavorite) {
            await apiCall(`/properties/${propertyId}/unfavorite`, { method: 'DELETE' });
            isFavorite = false;
            showNotification('Property removed from favorites', 'success');
        } else {
            await apiCall(`/properties/${propertyId}/favorite`, { method: 'POST' });
            isFavorite = true;
            showNotification('Property added to favorites', 'success');
        }
        updateFavoriteButton();
    } catch (error) {
        console.error('Failed to update favorite:', error);
        showNotification('Failed to update favorites. Please try again.', 'error');
    }
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
