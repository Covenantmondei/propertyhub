// Review Modal Manager
class ReviewModal {
    constructor() {
        this.overlay = null;
        this.modal = null;
        this.visitData = null;
        this.ratings = {
            overall: 0,
            communication: 0,
            professionalism: 0,
            knowledge: 0,
            responsiveness: 0
        };
        this.wouldRecommend = true;
    }

    // Open modal for a specific visit
    async open(visitId) {
        try {
            // Check if user can review this visit
            const canReviewResponse = await fetch(`${API_BASE_URL}/reviews/check/${visitId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (!canReviewResponse.ok) {
                throw new Error('Unable to check review eligibility');
            }

            const canReviewData = await canReviewResponse.json();

            if (!canReviewData.can_review) {
                if (canReviewData.reason === 'Already reviewed') {
                    showAlert('You have already reviewed this visit', 'info');
                } else {
                    showAlert(canReviewData.reason || 'Cannot review this visit', 'error');
                }
                return;
            }

            this.visitData = canReviewData.visit;
            this.render();
            this.attachEventListeners();
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
        } catch (error) {
            console.error('Error opening review modal:', error);
            showAlert('Failed to open review form', 'error');
        }
    }

    // Close modal
    close() {
        if (this.overlay) {
            this.overlay.style.opacity = '0';
            setTimeout(() => {
                this.overlay.remove();
                this.overlay = null;
                this.modal = null;
                document.body.style.overflow = '';
            }, 300);
        }
    }

    // Render modal HTML
    render() {
        const agentName = this.visitData.agent_name || 'Agent';
        const propertyTitle = this.visitData.property_title || 'Property';
        const agentInitials = agentName.split(' ').map(n => n[0]).join('').toUpperCase();

        const html = `
            <div class="review-modal-overlay" id="review-modal-overlay">
                <div class="review-modal">
                    <div class="review-modal-header">
                        <h2>Rate Your Experience</h2>
                        <p class="review-modal-subtitle">Help others by sharing your experience with this agent</p>
                        <button class="review-modal-close" id="close-review-modal" aria-label="Close">
                            <svg class="icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"/>
                                <line x1="6" y1="6" x2="18" y2="18"/>
                            </svg>
                        </button>
                    </div>

                    <div class="review-modal-body" id="review-form-content">
                        <!-- Agent Info Card -->
                        <div class="agent-info-card">
                            <div class="agent-avatar">${agentInitials}</div>
                            <div class="agent-details">
                                <h3 class="agent-name">${agentName}</h3>
                                <p class="property-title">${propertyTitle}</p>
                            </div>
                        </div>

                        <!-- Overall Rating -->
                        <div class="review-section">
                            <h3 class="review-section-title">
                                Overall Rating
                                <span class="required-badge">Required</span>
                            </h3>
                            <div class="star-rating-container">
                                <div class="star-rating-row">
                                    <div class="star-rating" data-rating-type="overall">
                                        ${this.renderStars('overall', false)}
                                    </div>
                                    <span class="star-rating-value" id="overall-rating-value">0/5</span>
                                </div>
                            </div>
                        </div>

                        <!-- Detailed Ratings -->
                        <div class="review-section">
                            <h3 class="review-section-title">Detailed Ratings (Optional)</h3>
                            <div class="star-rating-container">
                                ${this.renderDetailedRating('Communication', 'communication')}
                                ${this.renderDetailedRating('Professionalism', 'professionalism')}
                                ${this.renderDetailedRating('Knowledge', 'knowledge')}
                                ${this.renderDetailedRating('Responsiveness', 'responsiveness')}
                            </div>
                        </div>

                        <!-- Review Text -->
                        <div class="review-section">
                            <h3 class="review-section-title">Your Review (Optional)</h3>
                            <textarea 
                                class="review-textarea" 
                                id="review-text"
                                placeholder="Share details about your experience with this agent. What did they do well? What could be improved?"
                                maxlength="1000"
                            ></textarea>
                            <div class="char-counter">
                                <span id="char-count">0</span>/1000 characters
                            </div>
                        </div>

                        <!-- Recommendation -->
                        <div class="review-section">
                            <h3 class="review-section-title">Would you recommend this agent?</h3>
                            <div class="recommendation-toggle active" id="recommendation-toggle">
                                <div class="toggle-switch"></div>
                                <span class="toggle-label">Yes, I would recommend this agent</span>
                            </div>
                        </div>
                    </div>

                    <div class="review-modal-footer">
                        <button class="btn-cancel" id="cancel-review">Cancel</button>
                        <button class="btn-submit-review" id="submit-review" disabled>
                            <span id="submit-text">Submit Review</span>
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
        this.overlay = document.getElementById('review-modal-overlay');
        this.modal = this.overlay.querySelector('.review-modal');
    }

    // Render star rating inputs
    renderStars(type, isSmall = true) {
        const sizeClass = isSmall ? 'small' : '';
        let stars = '';
        for (let i = 5; i >= 1; i--) {
            stars += `
                <input type="radio" id="${type}-star-${i}" name="${type}-rating" value="${i}">
                <label for="${type}-star-${i}">★</label>
            `;
        }
        return stars;
    }

    // Render detailed rating row
    renderDetailedRating(label, type) {
        return `
            <div class="star-rating-row">
                <span class="star-rating-label">${label}</span>
                <div class="star-rating small" data-rating-type="${type}">
                    ${this.renderStars(type, true)}
                </div>
                <span class="star-rating-value" id="${type}-rating-value">-</span>
            </div>
        `;
    }

    // Attach event listeners
    attachEventListeners() {
        // Close button
        document.getElementById('close-review-modal').addEventListener('click', () => this.close());
        document.getElementById('cancel-review').addEventListener('click', () => this.close());
        
        // Click outside to close
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) {
                this.close();
            }
        });

        // ESC key to close
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.overlay) {
                this.close();
            }
        });

        // Star ratings
        document.querySelectorAll('.star-rating').forEach(ratingContainer => {
            const type = ratingContainer.dataset.ratingType;
            const inputs = ratingContainer.querySelectorAll('input[type="radio"]');
            
            inputs.forEach(input => {
                input.addEventListener('change', (e) => {
                    this.ratings[type] = parseInt(e.target.value);
                    this.updateRatingDisplay(type);
                    this.validateForm();
                });
            });
        });

        // Review text character counter
        const reviewText = document.getElementById('review-text');
        reviewText.addEventListener('input', (e) => {
            const count = e.target.value.length;
            document.getElementById('char-count').textContent = count;
        });

        // Recommendation toggle
        const toggle = document.getElementById('recommendation-toggle');
        toggle.addEventListener('click', () => {
            this.wouldRecommend = !this.wouldRecommend;
            toggle.classList.toggle('active');
            const label = toggle.querySelector('.toggle-label');
            label.textContent = this.wouldRecommend 
                ? 'Yes, I would recommend this agent'
                : 'No, I would not recommend this agent';
        });

        // Submit button
        document.getElementById('submit-review').addEventListener('click', () => this.submitReview());
    }

    // Update rating display
    updateRatingDisplay(type) {
        const valueElement = document.getElementById(`${type}-rating-value`);
        const rating = this.ratings[type];
        if (valueElement) {
            valueElement.textContent = rating > 0 ? `${rating}/5` : (type === 'overall' ? '0/5' : '-');
        }
    }

    // Validate form
    validateForm() {
        const submitButton = document.getElementById('submit-review');
        const isValid = this.ratings.overall > 0;
        submitButton.disabled = !isValid;
        return isValid;
    }

    // Submit review
    async submitReview() {
        if (!this.validateForm()) {
            showAlert('Please provide an overall rating', 'error');
            return;
        }

        const submitButton = document.getElementById('submit-review');
        const submitText = document.getElementById('submit-text');
        
        // Disable button and show loading
        submitButton.disabled = true;
        submitText.innerHTML = '<div class="spinner"></div> Submitting...';

        try {
            const reviewData = {
                visit_request_id: this.visitData.id,
                rating: this.ratings.overall,
                review_text: document.getElementById('review-text').value.trim() || null,
                communication_rating: this.ratings.communication || null,
                professionalism_rating: this.ratings.professionalism || null,
                knowledge_rating: this.ratings.knowledge || null,
                responsiveness_rating: this.ratings.responsiveness || null,
                would_recommend: this.wouldRecommend
            };

            const response = await fetch(`${API_BASE_URL}/reviews/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify(reviewData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.detail || 'Failed to submit review');
            }

            const result = await response.json();
            
            // Show success message
            this.showSuccess();
            
            // Emit event for other parts of the app to listen
            window.dispatchEvent(new CustomEvent('reviewSubmitted', { 
                detail: { 
                    reviewId: result.id,
                    visitId: this.visitData.id 
                } 
            }));

        } catch (error) {
            console.error('Error submitting review:', error);
            showAlert(error.message || 'Failed to submit review', 'error');
            
            // Re-enable button
            submitButton.disabled = false;
            submitText.textContent = 'Submit Review';
        }
    }

    // Show success message
    showSuccess() {
        const formContent = document.getElementById('review-form-content');
        const footer = document.querySelector('.review-modal-footer');
        
        formContent.innerHTML = `
            <div class="review-success">
                <div class="success-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
                <h2 class="success-title">Thank You!</h2>
                <p class="success-message">Your review has been submitted successfully. It will help other buyers make informed decisions.</p>
                <button class="btn btn-primary" id="close-success" style="padding: 0.75rem 2rem; border-radius: 8px;">
                    Close
                </button>
            </div>
        `;
        
        footer.style.display = 'none';
        
        document.getElementById('close-success').addEventListener('click', () => {
            this.close();
            // Refresh the page or update UI if needed
            if (window.location.pathname.includes('visits.html')) {
                location.reload();
            }
        });
    }
}

// Initialize global review modal instance
const reviewModal = new ReviewModal();

// Global function to open review modal
function openReviewModal(visitId) {
    reviewModal.open(visitId);
}

// Auto-trigger review modal if there's a pending review
document.addEventListener('DOMContentLoaded', () => {
    // Check URL parameters for review prompt
    const urlParams = new URLSearchParams(window.location.search);
    const reviewVisitId = urlParams.get('review');
    
    if (reviewVisitId) {
        // Wait a bit for the page to load
        setTimeout(() => {
            openReviewModal(parseInt(reviewVisitId));
            // Clean up URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }, 500);
    }
});
