// Smart Match functionality

let smartMatchModal = null;
let smartMatchResults = [];

// Initialize Smart Match modal
function initializeSmartMatch() {
    // Check if modal already exists
    if (document.getElementById('smart-match-modal')) {
        return;
    }

    // Create modal HTML
    const modalHTML = `
        <div id="smart-match-modal" class="modal">
            <div class="modal-overlay" onclick="closeSmartMatchModal()"></div>
            <div class="modal-content smart-match-modal-content">
                <button class="modal-close" onclick="closeSmartMatchModal()" aria-label="Close">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
                
                <div class="smart-match-header">
                    <div class="smart-match-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                            <path d="M15 10a5 5 0 01-5 5"/>
                        </svg>
                    </div>
                    <h2>Smart Property Match</h2>
                    <p>Find properties that fit your budget perfectly</p>
                </div>

                <form id="smart-match-form" onsubmit="handleSmartMatchSubmit(event)">
                    <div class="form-section">
                        <div class="form-group">
                            <label for="match-budget" class="form-label required">Your Budget</label>
                            <div class="input-with-icon">
                                <span class="input-icon">$</span>
                                <input 
                                    type="number" 
                                    id="match-budget" 
                                    class="form-input with-icon" 
                                    placeholder="e.g., 250000"
                                    min="0"
                                    step="1000"
                                    required
                                >
                            </div>
                            <small class="form-hint">We'll show properties within ±20% of your budget</small>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="match-property-type" class="form-label">Property Type</label>
                                <select id="match-property-type" class="form-select">
                                    <option value="">Any Type</option>
                                    <option value="house">House</option>
                                    <option value="apartment">Apartment</option>
                                    <option value="condo">Condo</option>
                                    <option value="townhouse">Townhouse</option>
                                    <option value="villa">Villa</option>
                                    <option value="land">Land</option>
                                    <option value="commercial">Commercial</option>
                                </select>
                            </div>

                            <div class="form-group">
                                <label for="match-listing-type" class="form-label">Listing Type</label>
                                <select id="match-listing-type" class="form-select">
                                    <option value="">Any</option>
                                    <option value="sale">For Sale</option>
                                    <option value="rent">For Rent</option>
                                </select>
                            </div>
                        </div>

                        <div class="form-row">
                            <div class="form-group">
                                <label for="match-city" class="form-label">City</label>
                                <input 
                                    type="text" 
                                    id="match-city" 
                                    class="form-input" 
                                    placeholder="e.g., Los Angeles"
                                >
                            </div>

                            <div class="form-group">
                                <label for="match-state" class="form-label">State</label>
                                <input 
                                    type="text" 
                                    id="match-state" 
                                    class="form-input" 
                                    placeholder="e.g., CA"
                                >
                            </div>
                        </div>
                    </div>

                    <div class="form-actions">
                        <button type="button" class="btn btn-secondary" onclick="closeSmartMatchModal()">
                            Cancel
                        </button>
                        <button type="submit" class="btn btn-primary" id="match-submit-btn">
                            <svg class="icon icon-sm" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <circle cx="11" cy="11" r="8"/>
                                <path d="m21 21-4.35-4.35"/>
                            </svg>
                            Find Matches
                        </button>
                    </div>
                </form>

                <div id="smart-match-results" class="smart-match-results" style="display: none;">
                    <div class="results-header">
                        <h3 id="results-count">Found 0 matches</h3>
                        <button class="btn btn-sm btn-outline" onclick="resetSmartMatch()">
                            New Search
                        </button>
                    </div>
                    <div id="results-container" class="results-grid"></div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    smartMatchModal = document.getElementById('smart-match-modal');
}

// Open Smart Match modal
function openSmartMatchModal() {
    initializeSmartMatch();
    const user = getUser();
    
    if (!user) {
        showToast('Please login to use Smart Match', 'error');
        window.location.href = 'login.html';
        return;
    }

    smartMatchModal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

// Close Smart Match modal
function closeSmartMatchModal() {
    if (smartMatchModal) {
        smartMatchModal.classList.remove('active');
        document.body.style.overflow = '';
        resetSmartMatch();
    }
}

// Reset Smart Match form and results
function resetSmartMatch() {
    const form = document.getElementById('smart-match-form');
    const resultsSection = document.getElementById('smart-match-results');
    
    if (form) {
        form.reset();
        form.style.display = 'block';
    }
    
    if (resultsSection) {
        resultsSection.style.display = 'none';
    }
    
    smartMatchResults = [];
}

// Handle Smart Match form submission
async function handleSmartMatchSubmit(event) {
    event.preventDefault();
    
    const budget = parseFloat(document.getElementById('match-budget').value);
    const propertyType = document.getElementById('match-property-type').value;
    const listingType = document.getElementById('match-listing-type').value;
    const city = document.getElementById('match-city').value.trim();
    const state = document.getElementById('match-state').value.trim();
    
    if (!budget || budget <= 0) {
        showToast('Please enter a valid budget', 'error');
        return;
    }

    const submitBtn = document.getElementById('match-submit-btn');
    const originalText = submitBtn.innerHTML;
    
    // Show loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
        <svg class="icon icon-sm spin" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 11-6.219-8.56"/>
        </svg>
        Searching...
    `;

    try {
        const requestData = {
            budget: budget,
            limit: 20
        };

        if (propertyType) requestData.property_type = propertyType;
        if (listingType) requestData.listing_type = listingType;
        if (city) requestData.city = city;
        if (state) requestData.state = state;

        const results = await apiCall('/properties/smart-match', {
            method: 'POST',
            body: JSON.stringify(requestData)
        });

        smartMatchResults = results;
        displaySmartMatchResults(results, budget);
        
    } catch (error) {
        console.error('Smart match failed:', error);
        showToast(error.message || 'Failed to find matches. Please try again.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
    }
}

// Display Smart Match results
function displaySmartMatchResults(results, budget) {
    const form = document.getElementById('smart-match-form');
    const resultsSection = document.getElementById('smart-match-results');
    const resultsContainer = document.getElementById('results-container');
    const resultsCount = document.getElementById('results-count');

    form.style.display = 'none';
    resultsSection.style.display = 'block';

    if (results.length === 0) {
        resultsCount.textContent = 'No matches found';
        resultsContainer.innerHTML = `
            <div class="no-results">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h4>No Properties Found</h4>
                <p>Try adjusting your budget or filters to see more results.</p>
                <button class="btn btn-primary" onclick="resetSmartMatch()">
                    Try Again
                </button>
            </div>
        `;
        return;
    }

    resultsCount.textContent = `Found ${results.length} ${results.length === 1 ? 'match' : 'matches'}`;
    
    resultsContainer.innerHTML = results.map(property => {
        const priceFormatted = formatPrice(property.price);
        const priceDiff = property.price_difference;
        const priceDiffFormatted = formatPrice(Math.abs(priceDiff));
        const priceDiffClass = priceDiff < 0 ? 'under-budget' : priceDiff > 0 ? 'over-budget' : 'exact-budget';
        const priceDiffText = priceDiff < 0 ? `$${priceDiffFormatted} under budget` : 
                              priceDiff > 0 ? `$${priceDiffFormatted} over budget` : 
                              'Exact match!';
        
        return `
            <div class="match-card" onclick="viewProperty(${property.id})">
                <div class="match-score">
                    <div class="score-circle" style="--score: ${property.match_score}">
                        <span>${Math.round(property.match_score)}%</span>
                    </div>
                    <span class="score-label">Match</span>
                </div>
                
                <div class="match-image">
                    ${property.primary_image ? 
                        `<img src="${property.primary_image}" alt="${escapeHtml(property.title)}" loading="lazy">` :
                        `<div class="no-image">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9 22 9 12 15 12 15 22"/>
                            </svg>
                        </div>`
                    }
                    <button class="favorite-btn ${property.is_favorite ? 'active' : ''}" 
                            onclick="toggleMatchFavorite(event, ${property.id})"
                            data-property-id="${property.id}">
                        <svg class="heart-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                        </svg>
                    </button>
                </div>

                <div class="match-content">
                    <h4 class="match-title">${escapeHtml(property.title)}</h4>
                    <p class="match-location">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                            <circle cx="12" cy="10" r="3"/>
                        </svg>
                        ${property.city}, ${property.state}
                    </p>

                    <div class="match-details">
                        <span class="detail-item">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                            </svg>
                            ${property.property_type}
                        </span>
                        ${property.bedrooms ? `
                            <span class="detail-item">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                    <path d="M2 12h20M2 12v10M22 12v10M6 12V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v5"/>
                                </svg>
                                ${property.bedrooms} bed
                            </span>
                        ` : ''}
                        ${property.bathrooms ? `
                            <span class="detail-item">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                    <path d="M9 6h12M9 20h12M4 20V10a3 3 0 1 1 6 0v10"/>
                                </svg>
                                ${property.bathrooms} bath
                            </span>
                        ` : ''}
                    </div>

                    <div class="match-price-section">
                        <div class="price">${priceFormatted}</div>
                        <div class="price-difference ${priceDiffClass}">
                            ${priceDiffText}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Toggle favorite from match results
async function toggleMatchFavorite(event, propertyId) {
    event.stopPropagation();
    
    const btn = event.currentTarget;
    const isActive = btn.classList.contains('active');

    try {
        if (isActive) {
            await apiCall(`/properties/favorites/${propertyId}`, { method: 'DELETE' });
            btn.classList.remove('active');
            showToast('Removed from favorites', 'success');
        } else {
            await apiCall('/properties/favorites', {
                method: 'POST',
                body: JSON.stringify({ property_id: propertyId })
            });
            btn.classList.add('active');
            showToast('Added to favorites', 'success');
        }
        
        // Update the property in results
        const propertyIndex = smartMatchResults.findIndex(p => p.id === propertyId);
        if (propertyIndex !== -1) {
            smartMatchResults[propertyIndex].is_favorite = !isActive;
        }
    } catch (error) {
        console.error('Failed to toggle favorite:', error);
        showToast(error.message || 'Failed to update favorites', 'error');
    }
}

// View property details
function viewProperty(propertyId) {
    window.location.href = `property.html?id=${propertyId}`;
}

// Helper function to format price
function formatPrice(price) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(price);
}

// Helper function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper function to get user
function getUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

// Close modal on escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && smartMatchModal && smartMatchModal.classList.contains('active')) {
        closeSmartMatchModal();
    }
});

// Make functions globally available
window.openSmartMatchModal = openSmartMatchModal;
window.closeSmartMatchModal = closeSmartMatchModal;
window.handleSmartMatchSubmit = handleSmartMatchSubmit;
window.resetSmartMatch = resetSmartMatch;
window.toggleMatchFavorite = toggleMatchFavorite;
window.viewProperty = viewProperty;
