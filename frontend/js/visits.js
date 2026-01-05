// Visits page JavaScript

let allVisits = [];
let currentFilter = 'all';
let selectedVisitId = null;

document.addEventListener('DOMContentLoaded', async () => {
    console.log('Visits page loaded');
    
    // Check authentication
    if (!isAuthenticated()) {
        showNotification('Please login to view your visits', 'error');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1500);
        return;
    }

    // Setup event listeners
    setupFilterTabs();
    
    // Load visits
    await loadVisits();
});

function setupFilterTabs() {
    const filterTabs = document.querySelectorAll('.filter-tab');
    
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            filterTabs.forEach(t => t.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Update current filter
            currentFilter = tab.dataset.status;
            
            // Filter and display visits
            displayVisits(filterVisits());
        });
    });
}

async function loadVisits() {
    const loadingState = document.getElementById('loading-state');
    const emptyState = document.getElementById('empty-state');
    const visitsList = document.getElementById('visits-list');
    
    try {
        loadingState.style.display = 'flex';
        emptyState.style.display = 'none';
        visitsList.style.display = 'none';
        
        const user = getUser();
        const endpoint = user.role === 'agent' ? '/visit/agent-requests' : '/visit/my-requests';
        
        allVisits = await apiCall(endpoint);
        
        loadingState.style.display = 'none';
        
        if (allVisits.length === 0) {
            emptyState.style.display = 'flex';
        } else {
            visitsList.style.display = 'grid';
            displayVisits(filterVisits());
        }
        
    } catch (error) {
        console.error('Failed to load visits:', error);
        loadingState.style.display = 'none';
        showNotification('Failed to load visits', 'error');
        
        if (error.message.includes('401')) {
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 1500);
        }
    }
}

function filterVisits() {
    if (currentFilter === 'all') {
        return allVisits;
    }
    
    return allVisits.filter(visit => visit.status === currentFilter);
}

function displayVisits(visits) {
    const visitsList = document.getElementById('visits-list');
    
    if (visits.length === 0) {
        visitsList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-filter"></i>
                <h3>No visits found</h3>
                <p>No visits match the selected filter</p>
            </div>
        `;
        return;
    }
    
    const user = getUser();
    const isAgent = user.role === 'agent';
    
    visitsList.innerHTML = visits.map(visit => createVisitCard(visit, isAgent)).join('');
}

function createVisitCard(visit, isAgent) {
    const statusClass = visit.status.toLowerCase().replace('_', '-');
    const statusLabel = formatStatus(visit.status);
    
    // Determine which date/time to display based on status
    let displayDate, displayTimeStart, displayTimeEnd, displayLabel;
    
    if (visit.status === 'confirmed' && visit.confirmed_date) {
        displayDate = visit.confirmed_date;
        displayTimeStart = visit.confirmed_time_start;
        displayTimeEnd = visit.confirmed_time_end;
        displayLabel = 'Confirmed Time';
    } else if (visit.status === 'proposed_reschedule' && visit.proposed_date) {
        displayDate = visit.proposed_date;
        displayTimeStart = visit.proposed_time_start;
        displayTimeEnd = visit.proposed_time_end;
        displayLabel = isAgent ? 'Your Proposed Time' : 'Agent Proposed Time';
    } else {
        displayDate = visit.preferred_date;
        displayTimeStart = visit.preferred_time_start;
        displayTimeEnd = visit.preferred_time_end;
        displayLabel = isAgent ? 'Buyer Preferred Time' : 'Your Preferred Time';
    }
    
    const formattedDate = formatDate(displayDate);
    const visitType = visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1);
    
    // Determine available actions
    let actions = '';
    
    if (isAgent) {
        // Agent actions
        if (visit.status === 'pending') {
            actions = `
                <button class="btn-confirm" onclick="acceptVisit(${visit.id})">
                    <i class="fas fa-check"></i> Accept
                </button>
                <button class="btn-contact" onclick="proposeReschedule(${visit.id})">
                    <i class="fas fa-calendar-alt"></i> Propose New Time
                </button>
                <button class="btn-cancel-visit" onclick="openDeclineModal(${visit.id})">
                    <i class="fas fa-times"></i> Decline
                </button>
            `;
        } else if (visit.status === 'confirmed') {
            actions = `
                <button class="btn-confirm" onclick="markAsCompleted(${visit.id})">
                    <i class="fas fa-check-circle"></i> Mark as Completed
                </button>
                <button class="btn-cancel-visit" onclick="openCancelModal(${visit.id})">
                    <i class="fas fa-times"></i> Cancel Visit
                </button>
            `;
        }
    } else {
        // Buyer actions
        if (visit.status === 'proposed_reschedule') {
            actions = `
                <button class="btn-confirm" onclick="openRescheduleModal(${visit.id})">
                    <i class="fas fa-check"></i> Confirm New Time
                </button>
            `;
        }
        
        if (visit.status === 'pending' || visit.status === 'confirmed' || visit.status === 'proposed_reschedule') {
            actions += `
                <button class="btn-cancel-visit" onclick="openCancelModal(${visit.id})">
                    <i class="fas fa-times"></i> Cancel Visit
                </button>
            `;
        }
        
        // Add review button for completed visits
        if (visit.status === 'completed' && !visit.has_review) {
            actions += `
                <button class="btn-review" onclick="openReviewModal(${visit.id})" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none;">
                    <i class="fas fa-star"></i> Review Agent
                </button>
            `;
        } else if (visit.status === 'completed' && visit.has_review) {
            actions += `
                <button class="btn-reviewed" disabled style="background: #10b981; color: white; border: none; cursor: not-allowed;">
                    <i class="fas fa-check-circle"></i> Reviewed
                </button>
            `;
        }
        
        actions += `
            <button class="btn-contact" onclick="contactPropertyAgent(${visit.property_id})">
                <i class="fas fa-comment"></i> Contact Agent
            </button>
        `;
    }
    
    // Add view details button for all
    actions += `
        <button class="btn-view-details" onclick="openVisitDetailsModal(${visit.id})">
            <i class="fas fa-info-circle"></i> View Details
        </button>
    `;
    
    // Notes section
    let notesHTML = '';
    if (visit.buyer_note) {
        notesHTML = `
            <div class="visit-notes">
                <div class="visit-notes-title">
                    ${isAgent ? 'Buyer' : 'Your'} Note:
                </div>
                <div class="visit-notes-content">${escapeHtml(visit.buyer_note)}</div>
            </div>
        `;
    }
    
    if (visit.agent_note && visit.status !== 'pending') {
        notesHTML += `
            <div class="visit-notes">
                <div class="visit-notes-title">
                    ${isAgent ? 'Your' : 'Agent'} Note:
                </div>
                <div class="visit-notes-content">${escapeHtml(visit.agent_note)}</div>
            </div>
        `;
    }
    
    // Reschedule proposal banner
    let rescheduleHTML = '';
    if (visit.status === 'proposed_reschedule' && !isAgent) {
        rescheduleHTML = `
            <div class="reschedule-proposal">
                <div class="reschedule-proposal-title">
                    <i class="fas fa-exclamation-circle"></i>
                    Agent Proposed New Time
                </div>
                <div class="reschedule-proposal-content">
                    <div class="reschedule-proposal-time">
                        <i class="fas fa-calendar"></i> ${formattedDate}
                    </div>
                    <div class="reschedule-proposal-time">
                        <i class="fas fa-clock"></i> ${displayTimeStart} - ${displayTimeEnd}
                    </div>
                </div>
            </div>
        `;
    }
    
    return `
        <div class="visit-card">
            <div class="visit-card-header">
                <div class="visit-property-info">
                    <h3 class="visit-property-title" onclick="window.location.href='property.html?id=${visit.property_id}'">
                        ${escapeHtml(visit.property_title)}
                    </h3>
                    <div class="visit-property-location">
                        <i class="fas fa-map-marker-alt"></i>
                        ${escapeHtml(visit.property_address)}, ${escapeHtml(visit.property_city)}
                    </div>
                </div>
                <span class="visit-status-badge ${statusClass}">${statusLabel}</span>
            </div>
            
            <div class="visit-details">
                <div class="visit-detail-row">
                    <i class="fas fa-${visit.visit_type === 'physical' ? 'walking' : 'video'}"></i>
                    <div class="visit-detail-content">
                        <div class="visit-detail-label">Visit Type</div>
                        <div class="visit-detail-value">${visitType} Visit</div>
                    </div>
                </div>
                
                <div class="visit-detail-row">
                    <i class="fas fa-calendar"></i>
                    <div class="visit-detail-content">
                        <div class="visit-detail-label">${displayLabel}</div>
                        <div class="visit-detail-value time">
                            ${formattedDate} at ${displayTimeStart} - ${displayTimeEnd}
                        </div>
                    </div>
                </div>
                
                ${isAgent ? `
                    <div class="visit-detail-row">
                        <i class="fas fa-user"></i>
                        <div class="visit-detail-content">
                            <div class="visit-detail-label">Buyer</div>
                            <div class="visit-detail-value">${escapeHtml(visit.buyer_name)}</div>
                        </div>
                    </div>
                ` : `
                    <div class="visit-detail-row">
                        <i class="fas fa-user-tie"></i>
                        <div class="visit-detail-content">
                            <div class="visit-detail-label">Agent</div>
                            <div class="visit-detail-value">${escapeHtml(visit.agent_name)}</div>
                        </div>
                    </div>
                `}
            </div>
            
            ${rescheduleHTML}
            ${notesHTML}
            
            ${actions ? `<div class="visit-actions">${actions}</div>` : ''}
        </div>
    `;
}

function formatStatus(status) {
    const statusMap = {
        'pending': 'Pending',
        'confirmed': 'Confirmed',
        'proposed_reschedule': 'Reschedule Proposed',
        'completed': 'Completed',
        'cancelled': 'Cancelled',
        'declined': 'Declined',
        'no_show_buyer': 'Buyer No-Show',
        'no_show_agent': 'Agent No-Show'
    };
    return statusMap[status] || status;
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// Action handlers
async function acceptVisit(visitId) {
    try {
        await apiCall(`/visit/${visitId}/accept`, { method: 'POST' });
        showNotification('Visit request accepted successfully', 'success');
        await loadVisits();
    } catch (error) {
        console.error('Failed to accept visit:', error);
        showNotification('Failed to accept visit request', 'error');
    }
}

async function proposeReschedule(visitId) {
    // Show modal/prompt to get new date and time
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Propose New Time</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="reschedule-form" onsubmit="submitReschedule(event, ${visitId})">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">New Date:</label>
                        <input type="date" id="proposed-date" required 
                               min="${new Date().toISOString().split('T')[0]}"
                               style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Start Time:</label>
                        <input type="time" id="proposed-start-time" required 
                               style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">End Time:</label>
                        <input type="time" id="proposed-end-time" required 
                               style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem;">
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Note (optional):</label>
                        <textarea id="agent-note" rows="3" maxlength="500"
                                  placeholder="Reason for proposing new time..."
                                  style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; resize: vertical;"></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Propose Time</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitReschedule(event, visitId) {
    event.preventDefault();
    
    const proposedDate = document.getElementById('proposed-date').value;
    const startTime = document.getElementById('proposed-start-time').value;
    const endTime = document.getElementById('proposed-end-time').value;
    const agentNote = document.getElementById('agent-note').value;
    
    try {
        await apiCall(`/visit/${visitId}/propose`, {
            method: 'POST',
            body: JSON.stringify({
                proposed_date: proposedDate,
                proposed_time_start: startTime,
                proposed_time_end: endTime,
                agent_note: agentNote || null
            })
        });
        
        showNotification('New time proposed successfully', 'success');
        document.querySelector('.modal').remove();
        await loadVisits();
    } catch (error) {
        console.error('Failed to propose reschedule:', error);
        showNotification(error.message || 'Failed to propose new time', 'error');
    }
}

function openRescheduleModal(visitId) {
    selectedVisitId = visitId;
    const visit = allVisits.find(v => v.id === visitId);
    
    if (!visit) return;
    
    const modal = document.getElementById('reschedule-modal');
    const proposedTimeDisplay = document.getElementById('proposed-time-display');
    
    proposedTimeDisplay.innerHTML = `
        <div style="margin: 0.5rem 0;">
            <strong>Date:</strong> ${formatDate(visit.proposed_date)}
        </div>
        <div style="margin: 0.5rem 0;">
            <strong>Time:</strong> ${visit.proposed_time_start} - ${visit.proposed_time_end}
        </div>
        ${visit.agent_note ? `
            <div style="margin: 0.5rem 0;">
                <strong>Agent's Note:</strong><br>
                ${escapeHtml(visit.agent_note)}
            </div>
        ` : ''}
    `;
    
    modal.classList.add('active');
}

function closeRescheduleModal() {
    const modal = document.getElementById('reschedule-modal');
    modal.classList.remove('active');
    selectedVisitId = null;
}

async function confirmReschedule() {
    if (!selectedVisitId) return;
    
    try {
        await apiCall(`/visit/${selectedVisitId}/confirm`, { method: 'POST' });
        showNotification('Visit time confirmed successfully', 'success');
        closeRescheduleModal();
        await loadVisits();
    } catch (error) {
        console.error('Failed to confirm reschedule:', error);
        showNotification('Failed to confirm new time', 'error');
    }
}

function openCancelModal(visitId) {
    selectedVisitId = visitId;
    const modal = document.getElementById('cancel-modal');
    modal.classList.add('active');
}

function closeCancelModal() {
    const modal = document.getElementById('cancel-modal');
    modal.classList.remove('active');
    selectedVisitId = null;
}

async function confirmCancelVisit() {
    if (!selectedVisitId) return;
    
    try {
        await apiCall(`/visit/${selectedVisitId}/cancel`, { method: 'POST' });
        showNotification('Visit cancelled successfully', 'success');
        closeCancelModal();
        await loadVisits();
    } catch (error) {
        console.error('Failed to cancel visit:', error);
        showNotification('Failed to cancel visit', 'error');
    }
}

async function openDeclineModal(visitId) {
    const reason = await showPrompt(
        'Please provide a reason for declining this visit request',
        {
            title: 'Decline Visit',
            placeholder: 'Reason for declining (minimum 10 characters)...',
            textarea: true,
            confirmText: 'Decline Visit',
            minLength: 10
        }
    );
    
    if (!reason) return;
    
    try {
        await apiCall(`/visit/${visitId}/decline`, {
            method: 'POST',
            body: JSON.stringify({
                decline_reason: reason
            })
        });
        showNotification('Visit request declined', 'success');
        await loadVisits();
    } catch (error) {
        console.error('Failed to decline visit:', error);
        showNotification('Failed to decline visit request', 'error');
    }
}

async function markAsCompleted(visitId) {
    // Show completion form
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Mark Visit as Completed</h2>
                <button class="modal-close" onclick="this.closest('.modal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="complete-form" onsubmit="submitCompletion(event, ${visitId})">
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Status:</label>
                        <select id="completion-status" required 
                                style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem;">
                            <option value="completed">Visit Completed</option>
                            <option value="no_show_buyer">Buyer Did Not Show Up</option>
                        </select>
                    </div>
                    <div style="margin-bottom: 1rem;">
                        <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Notes (optional):</label>
                        <textarea id="completion-notes" rows="3" maxlength="500"
                                  placeholder="Add any notes about the visit..."
                                  style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); border-radius: 0.375rem; resize: vertical;"></textarea>
                    </div>
                    <div class="modal-actions">
                        <button type="button" class="btn btn-secondary" onclick="this.closest('.modal').remove()">Cancel</button>
                        <button type="submit" class="btn btn-primary">Submit</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function submitCompletion(event, visitId) {
    event.preventDefault();
    
    const status = document.getElementById('completion-status').value;
    const notes = document.getElementById('completion-notes').value;
    
    try {
        await apiCall(`/visit/${visitId}/complete`, {
            method: 'POST',
            body: JSON.stringify({
                status: status,
                notes: notes || null
            })
        });
        
        showNotification('Visit marked as ' + (status === 'completed' ? 'completed' : 'no-show'), 'success');
        document.querySelector('.modal').remove();
        await loadVisits();
        
        // If visit completed successfully and user is buyer, prompt for review after a short delay
        const user = getUser();
        if (status === 'completed' && user.role === 'buyer') {
            setTimeout(() => {
                if (confirm('Would you like to rate and review the agent now?')) {
                    openReviewModal(visitId);
                }
            }, 1000);
        }
    } catch (error) {
        console.error('Failed to mark visit as completed:', error);
        showNotification('Failed to update visit status', 'error');
    }
}

function openVisitDetailsModal(visitId) {
    const visit = allVisits.find(v => v.id === visitId);
    if (!visit) return;
    
    const user = getUser();
    const isAgent = user.role === 'agent';
    
    const modal = document.getElementById('visit-details-modal');
    const modalBody = document.getElementById('visit-details-body');
    
    const visitType = visit.visit_type.charAt(0).toUpperCase() + visit.visit_type.slice(1);
    const statusLabel = formatStatus(visit.status);
    
    modalBody.innerHTML = `
        <div class="visit-detail-section">
            <h3><i class="fas fa-home"></i> Property Information</h3>
            <div class="visit-detail-grid">
                <div class="visit-info-item">
                    <span class="visit-info-label">Property</span>
                    <span class="visit-info-value">${escapeHtml(visit.property_title)}</span>
                </div>
                <div class="visit-info-item">
                    <span class="visit-info-label">Location</span>
                    <span class="visit-info-value">${escapeHtml(visit.property_address)}, ${escapeHtml(visit.property_city)}</span>
                </div>
                <div class="visit-info-item">
                    <span class="visit-info-label">Visit Type</span>
                    <span class="visit-info-value">${visitType} Visit</span>
                </div>
                <div class="visit-info-item">
                    <span class="visit-info-label">Status</span>
                    <span class="visit-info-value">${statusLabel}</span>
                </div>
            </div>
        </div>
        
        <div class="visit-detail-section">
            <h3><i class="fas fa-calendar-alt"></i> Visit Schedule</h3>
            <div class="visit-detail-grid">
                <div class="visit-info-item">
                    <span class="visit-info-label">${isAgent ? 'Buyer' : 'Your'} Preferred Date</span>
                    <span class="visit-info-value">${formatDate(visit.preferred_date)}</span>
                </div>
                <div class="visit-info-item">
                    <span class="visit-info-label">${isAgent ? 'Buyer' : 'Your'} Preferred Time</span>
                    <span class="visit-info-value">${visit.preferred_time_start} - ${visit.preferred_time_end}</span>
                </div>
                
                ${visit.proposed_date ? `
                    <div class="visit-info-item">
                        <span class="visit-info-label">${isAgent ? 'Your' : 'Agent'} Proposed Date</span>
                        <span class="visit-info-value">${formatDate(visit.proposed_date)}</span>
                    </div>
                    <div class="visit-info-item">
                        <span class="visit-info-label">${isAgent ? 'Your' : 'Agent'} Proposed Time</span>
                        <span class="visit-info-value">${visit.proposed_time_start} - ${visit.proposed_time_end}</span>
                    </div>
                ` : ''}
                
                ${visit.confirmed_date ? `
                    <div class="visit-info-item" style="background: #d1fae5;">
                        <span class="visit-info-label">Confirmed Date</span>
                        <span class="visit-info-value">${formatDate(visit.confirmed_date)}</span>
                    </div>
                    <div class="visit-info-item" style="background: #d1fae5;">
                        <span class="visit-info-label">Confirmed Time</span>
                        <span class="visit-info-value">${visit.confirmed_time_start} - ${visit.confirmed_time_end}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="visit-detail-section">
            <h3><i class="fas fa-users"></i> Contact Information</h3>
            <div class="visit-detail-grid">
                <div class="visit-info-item">
                    <span class="visit-info-label">${isAgent ? 'Buyer Name' : 'Agent Name'}</span>
                    <span class="visit-info-value">${isAgent ? escapeHtml(visit.buyer_name) : escapeHtml(visit.agent_name)}</span>
                </div>
                <div class="visit-info-item">
                    <span class="visit-info-label">${isAgent ? 'Buyer Email' : 'Agent Email'}</span>
                    <span class="visit-info-value">${isAgent ? escapeHtml(visit.buyer_email) : escapeHtml(visit.agent_email)}</span>
                </div>
            </div>
        </div>
        
        ${visit.buyer_note || visit.agent_note || visit.decline_reason ? `
            <div class="visit-detail-section">
                <h3><i class="fas fa-sticky-note"></i> Notes</h3>
                <div class="visit-detail-grid">
                    ${visit.buyer_note ? `
                        <div class="visit-notes">
                            <div class="visit-notes-title">${isAgent ? 'Buyer' : 'Your'} Note:</div>
                            <div class="visit-notes-content">${escapeHtml(visit.buyer_note)}</div>
                        </div>
                    ` : ''}
                    ${visit.agent_note ? `
                        <div class="visit-notes">
                            <div class="visit-notes-title">${isAgent ? 'Your' : 'Agent'} Note:</div>
                            <div class="visit-notes-content">${escapeHtml(visit.agent_note)}</div>
                        </div>
                    ` : ''}
                    ${visit.decline_reason ? `
                        <div class="visit-notes" style="background: #fee2e2;">
                            <div class="visit-notes-title">Decline Reason:</div>
                            <div class="visit-notes-content">${escapeHtml(visit.decline_reason)}</div>
                        </div>
                    ` : ''}
                </div>
            </div>
        ` : ''}
        
        <div class="visit-detail-section">
            <h3><i class="fas fa-clock"></i> Timeline</h3>
            <div class="visit-detail-grid">
                <div class="visit-info-item">
                    <span class="visit-info-label">Requested On</span>
                    <span class="visit-info-value">${formatDate(visit.created_at)}</span>
                </div>
                ${visit.completed_at ? `
                    <div class="visit-info-item">
                        <span class="visit-info-label">Completed On</span>
                        <span class="visit-info-value">${formatDate(visit.completed_at)}</span>
                    </div>
                ` : ''}
            </div>
        </div>
        
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeVisitDetailsModal()">Close</button>
            <button class="btn btn-primary" onclick="window.location.href='property.html?id=${visit.property_id}'">
                <i class="fas fa-home"></i> View Property
            </button>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeVisitDetailsModal() {
    const modal = document.getElementById('visit-details-modal');
    modal.classList.remove('active');
}

async function contactPropertyAgent(propertyId) {
    window.location.href = `property.html?id=${propertyId}`;
}

// Helper to escape HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Helper for prompt dialogs
async function showPrompt(message, options = {}) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${options.title || 'Input Required'}</h2>
                    <button class="modal-close" onclick="this.closest('.modal').remove(); this.dataset.resolve(null)">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 1rem;">${message}</p>
                    ${options.textarea ? 
                        `<textarea id="prompt-input" placeholder="${options.placeholder || ''}" 
                                  rows="4" maxlength="500" required
                                  style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); 
                                         border-radius: 0.375rem; resize: vertical;"></textarea>` :
                        `<input type="text" id="prompt-input" placeholder="${options.placeholder || ''}" 
                                maxlength="500" required
                                style="width: 100%; padding: 0.5rem; border: 1px solid hsl(var(--border)); 
                                       border-radius: 0.375rem;">`
                    }
                    <div class="modal-actions" style="margin-top: 1rem;">
                        <button type="button" class="btn btn-secondary" 
                                onclick="this.closest('.modal').remove();">Cancel</button>
                        <button type="button" class="btn btn-primary" id="prompt-confirm">
                            ${options.confirmText || 'Confirm'}
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const input = modal.querySelector('#prompt-input');
        const confirmBtn = modal.querySelector('#prompt-confirm');
        
        confirmBtn.addEventListener('click', () => {
            const value = input.value.trim();
            if (options.minLength && value.length < options.minLength) {
                showNotification(`Please enter at least ${options.minLength} characters`, 'error');
                return;
            }
            if (value) {
                modal.remove();
                resolve(value);
            }
        });
        
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !options.textarea) {
                confirmBtn.click();
            }
        });
        
        // Focus input
        setTimeout(() => input.focus(), 100);
        
        // Handle modal close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
                resolve(null);
            }
        });
    });
}
