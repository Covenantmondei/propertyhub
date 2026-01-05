// Agent Profile Page JavaScript

let agentId = null;
let agentData = null;
let reviewsData = null;

document.addEventListener('DOMContentLoaded', async () => {
    // Get agent ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    agentId = urlParams.get('id');
    
    if (!agentId) {
        showError();
        return;
    }
    
    await loadAgentProfile();
    
    // Setup sort listener
    document.getElementById('reviews-sort')?.addEventListener('change', sortReviews);
});

async function loadAgentProfile() {
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const profileContent = document.getElementById('profile-content');
    
    try {
        loadingState.style.display = 'flex';
        errorState.style.display = 'none';
        profileContent.style.display = 'none';
        
        // Fetch agent info
        const agentResponse = await fetch(`${API_BASE_URL}/user/${agentId}`);
        if (!agentResponse.ok) throw new Error('Agent not found');
        
        agentData = await agentResponse.json();
        
        // Fetch reviews
        const reviewsResponse = await fetch(`${API_BASE_URL}/reviews/agent/${agentId}`);
        if (!reviewsResponse.ok) throw new Error('Failed to load reviews');
        
        reviewsData = await reviewsResponse.json();
        
        // Display profile
        displayAgentProfile();
        displayRatingBreakdown();
        displayReviews(reviewsData.reviews);
        
        loadingState.style.display = 'none';
        profileContent.style.display = 'block';
        
    } catch (error) {
        console.error('Error loading agent profile:', error);
        loadingState.style.display = 'none';
        errorState.style.display = 'flex';
    }
}

function displayAgentProfile() {
    const initials = `${agentData.first_name[0]}${agentData.last_name[0]}`.toUpperCase();
    const fullName = `${agentData.first_name} ${agentData.last_name}`;
    
    document.getElementById('agent-avatar').textContent = initials;
    document.getElementById('agent-name').textContent = fullName;
    
    // Display rating stars
    const ratingStars = document.getElementById('rating-stars');
    ratingStars.innerHTML = createStarRating(reviewsData.average_rating);
    
    document.getElementById('rating-value').textContent = reviewsData.average_rating.toFixed(1);
    document.getElementById('rating-count').textContent = `(${reviewsData.total_reviews} review${reviewsData.total_reviews !== 1 ? 's' : ''})`;
    
    // Display contact info
    document.getElementById('agent-email').innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        ${agentData.email}
    `;
    
    if (agentData.phone_number) {
        document.getElementById('agent-phone').innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            ${agentData.phone_number}
        `;
    }
}

function displayRatingBreakdown() {
    const breakdownHTML = `
        <h3>Performance Metrics</h3>
        <div class="rating-metrics">
            ${createMetricBar('Communication', reviewsData.average_communication)}
            ${createMetricBar('Professionalism', reviewsData.average_professionalism)}
            ${createMetricBar('Knowledge', reviewsData.average_knowledge)}
            ${createMetricBar('Responsiveness', reviewsData.average_responsiveness)}
        </div>
        <div class="recommendation-stat">
            <p class="recommendation-percentage">${reviewsData.recommendation_percentage}%</p>
            <p class="recommendation-label">of clients recommend this agent</p>
        </div>
    `;
    
    document.getElementById('rating-breakdown').innerHTML = breakdownHTML;
}

function createMetricBar(label, value) {
    const percentage = value ? (value / 5) * 100 : 0;
    const displayValue = value ? value.toFixed(1) : 'N/A';
    
    return `
        <div class="rating-metric">
            <div class="metric-label">${label}</div>
            <div class="metric-bar">
                <div class="metric-fill" style="width: ${percentage}%"></div>
            </div>
            <div class="metric-value">${displayValue} / 5.0</div>
        </div>
    `;
}

function displayReviews(reviews) {
    const reviewsList = document.getElementById('reviews-list');
    const noReviews = document.getElementById('no-reviews');
    
    if (!reviews || reviews.length === 0) {
        reviewsList.style.display = 'none';
        noReviews.style.display = 'block';
        return;
    }
    
    reviewsList.style.display = 'flex';
    noReviews.style.display = 'none';
    
    reviewsList.innerHTML = reviews.map(review => createReviewCard(review)).join('');
}

function createReviewCard(review) {
    const buyerInitials = review.buyer_name.split(' ').map(n => n[0]).join('').toUpperCase();
    const reviewDate = new Date(review.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    const detailedMetrics = [];
    if (review.communication_rating) {
        detailedMetrics.push({ label: 'Communication', rating: review.communication_rating });
    }
    if (review.professionalism_rating) {
        detailedMetrics.push({ label: 'Professionalism', rating: review.professionalism_rating });
    }
    if (review.knowledge_rating) {
        detailedMetrics.push({ label: 'Knowledge', rating: review.knowledge_rating });
    }
    if (review.responsiveness_rating) {
        detailedMetrics.push({ label: 'Responsiveness', rating: review.responsiveness_rating });
    }
    
    const metricsHTML = detailedMetrics.length > 0 ? `
        <div class="review-metrics">
            ${detailedMetrics.map(metric => `
                <div class="review-metric-item">
                    <span>${metric.label}:</span>
                    <div class="stars">
                        ${createMiniStars(metric.rating)}
                    </div>
                </div>
            `).join('')}
        </div>
    ` : '';
    
    const recommendBadge = `
        <div class="recommendation-badge ${review.would_recommend ? '' : 'not-recommend'}">
            ${review.would_recommend ? '👍' : '👎'}
            ${review.would_recommend ? 'Recommends this agent' : 'Does not recommend'}
        </div>
    `;
    
    return `
        <div class="review-card">
            <div class="review-header">
                <div class="reviewer-info">
                    <div class="reviewer-avatar">${buyerInitials}</div>
                    <div class="reviewer-details">
                        <h4 class="reviewer-name">${escapeHtml(review.buyer_name)}</h4>
                        <div class="review-date">${reviewDate}</div>
                    </div>
                </div>
                <div class="review-rating">
                    ${createStarRating(review.rating)}
                </div>
            </div>
            
            ${review.review_text ? `
                <p class="review-text">${escapeHtml(review.review_text)}</p>
            ` : ''}
            
            <div class="review-property">
                📍 Property: ${escapeHtml(review.property_title)}
            </div>
            
            ${metricsHTML}
            ${recommendBadge}
        </div>
    `;
}

function createStarRating(rating) {
    let stars = '';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    
    for (let i = 0; i < 5; i++) {
        if (i < fullStars) {
            stars += '<span class="star filled">★</span>';
        } else if (i === fullStars && hasHalfStar) {
            stars += '<span class="star half">★</span>';
        } else {
            stars += '<span class="star">★</span>';
        }
    }
    
    return stars;
}

function createMiniStars(rating) {
    let stars = '';
    for (let i = 1; i <= 5; i++) {
        stars += `<span class="star ${i <= rating ? 'filled' : ''}">★</span>`;
    }
    return stars;
}

function sortReviews() {
    const sortValue = document.getElementById('reviews-sort').value;
    let sortedReviews = [...reviewsData.reviews];
    
    switch (sortValue) {
        case 'recent':
            sortedReviews.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            break;
        case 'highest':
            sortedReviews.sort((a, b) => b.rating - a.rating);
            break;
        case 'lowest':
            sortedReviews.sort((a, b) => a.rating - b.rating);
            break;
    }
    
    displayReviews(sortedReviews);
}

function contactAgent() {
    if (!isAuthenticated()) {
        showAlert('Please login to contact the agent', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }
    
    // Redirect to chat with agent
    window.location.href = `chat.html?agent=${agentId}`;
}

function showError() {
    document.getElementById('loading-state').style.display = 'none';
    document.getElementById('error-state').style.display = 'flex';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
