const BACKEND_URL = 'https://myproperty-backend-seven.vercel.app';
let pendingRejectionData = null;

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is admin
    const user = getUser();
    if (!user || user.role !== 'admin') {
        showNotification('Access denied. Admin privileges required.', 'error');
        window.location.href = 'login.html';
        return;
    }

    // Display admin name
    const adminName = document.getElementById('admin-name');
    if (adminName && user.username) {
        adminName.textContent = user.username;
    }

    initializeAdminDashboard();
    setupNavigation();
    setupEventListeners();
});

async function initializeAdminDashboard() {
    await loadDashboardStats();
    await loadRecentActivity();
}

function setupNavigation() {
    // Sidebar navigation
    const sidebarLinks = document.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionName = link.dataset.section;
            navigateToSection(sectionName);
        });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebar = document.getElementById('admin-sidebar');
    const mainContent = document.querySelector('.admin-main');
    
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
            mainContent.classList.toggle('expanded');
        });
    }

    // Logout button
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

function setupEventListeners() {
    const userRoleFilter = document.getElementById('user-role-filter');
    if (userRoleFilter) {
        userRoleFilter.addEventListener('change', loadAllUsers);
    }

    const logsDaysFilter = document.getElementById('logs-days-filter');
    if (logsDaysFilter) {
        logsDaysFilter.addEventListener('change', loadActivityLogs);
    }

    const propertiesStatusFilter = document.getElementById('properties-status-filter');
    if (propertiesStatusFilter) {
        propertiesStatusFilter.addEventListener('change', loadAllProperties);
    }
}

function navigateToSection(sectionName) {
    // Update sidebar links
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === sectionName) {
            link.classList.add('active');
        }
    });

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(`${sectionName}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Load data for the section
    switch(sectionName) {
        case 'overview':
            loadDashboardStats();
            loadRecentActivity();
            break;
        case 'pending-properties':
            loadPendingProperties();
            break;
        case 'pending-agents':
            loadPendingAgents();
            break;
        case 'kyc-verification':
            loadPendingKYC();
            break;
        case 'all-properties':
            loadAllProperties();
            break;
        case 'all-users':
            loadAllUsers();
            break;
        case 'activity-logs':
            loadActivityLogs();
            break;
    }

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('admin-sidebar').classList.remove('show');
    }
}

function refreshOverview() {
    loadDashboardStats();
    loadRecentActivity();
    showNotification('Dashboard refreshed', 'success');
}

// Dashboard Stats
async function loadDashboardStats() {
    try {
        const stats = await window.apiCall('/admin/dashboard');
        
        // Update main stats
        document.getElementById('total-users').innerHTML = stats.total_users || 0;
        document.getElementById('total-properties').innerHTML = stats.total_properties || 0;
        document.getElementById('pending-approvals').innerHTML = stats.pending_approvals || 0;
        document.getElementById('total-agents').innerHTML = stats.total_agents || 0;

        // Update badge counts
        const pendingPropertiesBadge = document.getElementById('pending-properties-badge');
        const pendingAgentsBadge = document.getElementById('pending-agents-badge');
        const notificationBadge = document.getElementById('notification-badge');
        
        if (pendingPropertiesBadge) {
            pendingPropertiesBadge.textContent = stats.pending_properties || 0;
        }
        if (pendingAgentsBadge) {
            pendingAgentsBadge.textContent = stats.pending_agents || 0;
        }
        
        // Update pending KYC badge
        const pendingKYCBadge = document.getElementById('pending-kyc-badge');
        if (pendingKYCBadge) {
            pendingKYCBadge.textContent = stats.pending_kyc || 0;
        }
        
        if (notificationBadge) {
            const totalPending = (stats.pending_properties || 0) + (stats.pending_agents || 0) + (stats.pending_kyc || 0);
            notificationBadge.textContent = totalPending;
        }

        // Update additional info
        const pendingChange = document.getElementById('pending-change');
        if (pendingChange) {
            pendingChange.textContent = stats.pending_approvals || 0;
        }

        const agentsActive = document.getElementById('agents-active');
        if (agentsActive) {
            agentsActive.textContent = stats.active_agents || stats.total_agents || 0;
        }

    } catch (error) {
        console.error('Failed to load dashboard stats:', error);
        showNotification('Failed to load dashboard stats', 'error');
    }
}

// Recent Activity
async function loadRecentActivity() {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    container.innerHTML = '<div class="loading">Loading recent activity...</div>';

    try {
        const logs = await window.apiCall('/admin/activity-logs?days=7&limit=10');
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        container.innerHTML = logs.map(log => {
            const actionIcons = {
                'property_approved': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
                'property_rejected': '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
                'agent_approved': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><polyline points="17 11 19 13 23 9"/>',
                'user_registered': '<path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/>',
                'default': '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>'
            };

            const iconPath = actionIcons[log.action] || actionIcons.default;

            return `
                <div class="activity-item">
                    <div class="activity-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${iconPath}</svg>
                    </div>
                    <div class="activity-details">
                        <p class="activity-title">${formatActivityAction(log.action, log.details)}</p>
                        <p class="activity-time">${formatRelativeTime(log.timestamp)}</p>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load recent activity:', error);
        container.innerHTML = '<div class="error-state">Failed to load activity</div>';
    }
}

function formatActivityAction(action, details) {
    const actionMap = {
        'property_approved': 'Property approved',
        'property_rejected': 'Property rejected',
        'agent_approved': 'Agent approved',
        'agent_rejected': 'Agent rejected',
        'user_registered': 'New user registered',
        'user_suspended': 'User suspended',
        'property_created': 'New property listed'
    };

    const baseAction = actionMap[action] || action.replace(/_/g, ' ');
    return details ? `${baseAction}: ${details}` : baseAction;
}

function formatRelativeTime(dateString) {
    if (!dateString) return 'Recently';
    
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    return formatDate(dateString);
}

// Pending Properties
async function loadPendingProperties() {
    const container = document.getElementById('pending-properties-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const properties = await window.apiCall('/admin/properties/pending');
        
        if (properties.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending properties</div>';
            return;
        }

        container.innerHTML = properties.map(property => `
            <div class="approval-card">
                <div class="approval-card-header">
                    <div>
                        <h3 class="approval-title">${escapeHtml(property.title)}</h3>
                        <p class="approval-meta">
                            ${property.property_type} • $${formatCurrency(property.price)} • ${property.city || 'N/A'}, ${property.state || 'N/A'}
                        </p>
                        <p class="approval-meta">Submitted: ${formatDate(property.created_at)}</p>
                    </div>
                    <span class="badge badge-pending">${property.approval_status || 'pending'}</span>
                </div>
                <p class="approval-description">${escapeHtml(property.description || 'No description provided')}</p>
                <div class="approval-actions">
                    <button onclick="approveProperty(${property.id})" class="btn-success btn-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="20 6 9 17 4 12"/></svg>
                        Approve
                    </button>
                    <button onclick="openRejectionModal('property', ${property.id})" class="btn-danger btn-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Reject
                    </button>
                    <a href="property.html?id=${property.id}" class="btn-secondary btn-sm" target="_blank">View Details</a>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load pending properties:', error);
        container.innerHTML = '<div class="error-state">Failed to load pending properties</div>';
    }
}

// All Properties
async function loadAllProperties() {
    const container = document.getElementById('all-properties-list');
    if (!container) return;
    
    const statusFilter = document.getElementById('properties-status-filter')?.value || '';
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        let properties = [];
        
        if (statusFilter === 'pending') {
            properties = await window.apiCall('/admin/properties/pending?limit=100');
            properties.forEach(p => p.approval_status = p.approval_status || 'pending');
        } else if (statusFilter === 'approved') {
            properties = await window.apiCall('/properties/all?limit=100');
            properties.forEach(p => p.approval_status = 'approved');
        } else if (statusFilter === 'rejected') {
            properties = [];
        } else {
            const [pending, approved] = await Promise.all([
                window.apiCall('/admin/properties/pending?limit=100').catch(() => []),
                window.apiCall('/properties/all?limit=100').catch(() => [])
            ]);
            pending.forEach(p => p.approval_status = p.approval_status || 'pending');
            approved.forEach(p => p.approval_status = 'approved');
            properties = [...pending, ...approved];
        }
        
        if (properties.length === 0) {
            container.innerHTML = '<div class="empty-state">No properties found</div>';
            return;
        }

        properties.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Title</th>
                            <th>Type</th>
                            <th>Price</th>
                            <th>Location</th>
                            <th>Status</th>
                            <th>Posted</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${properties.map(property => {
                            const status = property.approval_status || 'pending';
                            return `
                            <tr>
                                <td><strong>#${property.id}</strong></td>
                                <td>
                                    <div style="max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${escapeHtml(property.title)}
                                    </div>
                                </td>
                                <td><span class="badge badge-info">${property.property_type}</span></td>
                                <td><strong>$${formatCurrency(property.price)}</strong></td>
                                <td>${property.city || 'N/A'}, ${property.state || 'N/A'}</td>
                                <td><span class="badge badge-${status}">${status.toUpperCase()}</span></td>
                                <td>${formatDate(property.created_at)}</td>
                                <td>
                                    <div style="display: flex; gap: 0.5rem; justify-content: flex-start;">
                                        ${status === 'pending' ? `
                                            <button onclick="approveProperty(${property.id})" class="btn-success btn-xs" title="Approve">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="20 6 9 17 4 12"/></svg>
                                            </button>
                                            <button onclick="openRejectionModal('property', ${property.id})" class="btn-danger btn-xs" title="Reject">
                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                            </button>
                                        ` : ''}
                                        <a href="property.html?id=${property.id}" class="btn-secondary btn-xs" target="_blank" title="View Details">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        </a>
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load properties:', error);
        container.innerHTML = '<div class="error-state">Failed to load properties<br><small>' + error.message + '</small></div>';
    }
}

async function approveProperty(propertyId) {
    const confirmed = await showConfirm(
        'Are you sure you want to approve this property?',
        { title: 'Approve Property', confirmText: 'Approve', type: 'success' }
    );
    if (!confirmed) return;

    try {
        await window.apiCall(`/admin/properties/approve?property_id=${propertyId}`, {
            method: 'POST'
        });

        showNotification('Property approved successfully', 'success');
        
        const activeSection = document.querySelector('.content-section.active')?.id;
        if (activeSection === 'pending-properties-section') {
            await loadPendingProperties();
        } else if (activeSection === 'all-properties-section') {
            await loadAllProperties();
        }
        
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to approve property:', error);
        showNotification(error.message || 'Failed to approve property', 'error');
    }
}

// Pending Agents
async function loadPendingAgents() {
    const container = document.getElementById('pending-agents-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const agents = await window.apiCall('/admin/agents/pending');
        
        if (agents.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending agent registrations</div>';
            return;
        }

        container.innerHTML = agents.map(agent => `
            <div class="approval-card">
                <div class="approval-card-header">
                    <div>
                        <h3 class="approval-title">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;margin-right:8px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            ${escapeHtml(agent.first_name || '')} ${escapeHtml(agent.last_name || '')}
                        </h3>
                        <p class="approval-meta">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            ${agent.email}
                            ${agent.username ? `• <strong>@${agent.username}</strong>` : ''}
                        </p>
                        <p class="approval-meta">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Registered: ${formatDate(agent.created_at)} (${formatRelativeTime(agent.created_at)})
                        </p>
                    </div>
                    <span class="badge badge-pending">${(agent.approval_status || 'pending').toUpperCase()}</span>
                </div>
                <div class="approval-actions">
                    <button onclick="approveAgent(${agent.id})" class="btn-success btn-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="20 6 9 17 4 12"/></svg>
                        Approve Agent
                    </button>
                    <button onclick="openRejectionModal('agent', ${agent.id})" class="btn-danger btn-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        Reject
                    </button>
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to load pending agents:', error);
        container.innerHTML = '<div class="error-state">Failed to load pending agents<br><small>' + error.message + '</small></div>';
    }
}

async function approveAgent(agentId) {
    const confirmed = await showConfirm(
        'Are you sure you want to approve this agent?',
        { title: 'Approve Agent', confirmText: 'Approve', type: 'success' }
    );
    if (!confirmed) return;

    try {
        await window.apiCall(`/admin/agents/approve?agent_id=${agentId}`, {
            method: 'POST'
        });

        showNotification('Agent approved successfully', 'success');
        await loadPendingAgents();
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to approve agent:', error);
        showNotification(error.message || 'Failed to approve agent', 'error');
    }
}

// All Users
async function loadAllUsers() {
    const container = document.getElementById('all-users-list');
    const roleFilter = document.getElementById('user-role-filter')?.value || '';
    
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const endpoint = `/admin/users${roleFilter ? `?role=${roleFilter}` : ''}`;
        const users = await window.apiCall(endpoint);
        
        if (users.length === 0) {
            container.innerHTML = '<div class="empty-state">No users found</div>';
            return;
        }

        users.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Name</th>
                            <th>Username</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${users.map(user => `
                            <tr>
                                <td><strong>#${user.id}</strong></td>
                                <td>${escapeHtml(user.first_name || '')} ${escapeHtml(user.last_name || '')}</td>
                                <td>${escapeHtml(user.username || '-')}</td>
                                <td>${escapeHtml(user.email)}</td>
                                <td><span class="badge badge-${user.role}">${user.role.toUpperCase()}</span></td>
                                <td><span class="badge badge-${user.is_approved ? 'approved' : 'pending'}">${user.is_approved ? 'Active' : 'Pending'}</span></td>
                                <td>${formatDate(user.created_at)}</td>
                                <td>
                                    ${user.role !== 'admin' ? `
                                        <button onclick="suspendUser(${user.id}, '${escapeHtml(user.username || user.email)}')" class="btn-danger btn-xs" title="Suspend User">
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                                            Suspend
                                        </button>
                                    ` : '<span style="color: var(--admin-muted); font-size: 0.75rem;">Admin</span>'}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load users:', error);
        container.innerHTML = '<div class="error-state">Failed to load users<br><small>' + error.message + '</small></div>';
    }
}

async function suspendUser(userId, username) {
    const confirmed = await showConfirm(
        `Are you sure you want to suspend user "${username}"?`,
        { title: 'Suspend User', confirmText: 'Suspend', danger: true }
    );
    if (!confirmed) return;
    
    const reason = await showPrompt(
        'Enter reason for suspension:',
        { title: 'Suspension Reason', inputType: 'textarea', placeholder: 'Provide a detailed reason...' }
    );
    if (!reason) return;

    try {
        await window.apiCall('/admin/users/suspend', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId, reason })
        });

        showNotification('User suspended successfully', 'success');
        await loadAllUsers();
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to suspend user:', error);
        showNotification(error.message || 'Failed to suspend user', 'error');
    }
}

// Activity Logs
async function loadActivityLogs() {
    const container = document.getElementById('activity-logs-list');
    const days = document.getElementById('logs-days-filter')?.value || 7;
    
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const logs = await window.apiCall(`/admin/activity-logs?days=${days}&limit=100`);
        
        if (logs.length === 0) {
            container.innerHTML = '<div class="empty-state">No activity logs for the selected period</div>';
            return;
        }

        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        container.innerHTML = `
            <div class="table-container">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Action</th>
                            <th>Performed By</th>
                            <th>Target</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${logs.map(log => {
                            const actionType = getActionType(log.action);
                            return `
                            <tr>
                                <td>
                                    <div style="font-size: 0.875rem;">${formatDateTime(log.timestamp)}</div>
                                    <div style="font-size: 0.75rem; color: var(--admin-muted);">${formatRelativeTime(log.timestamp)}</div>
                                </td>
                                <td>
                                    <span class="badge badge-${actionType.color}">
                                        ${log.action.replace(/_/g, ' ').toUpperCase()}
                                    </span>
                                </td>
                                <td><strong>User #${log.user_id || 'System'}</strong></td>
                                <td>
                                    ${log.entity_type ? `
                                        <span style="font-size: 0.875rem;">
                                            ${log.entity_type} <strong>#${log.entity_id || '-'}</strong>
                                        </span>
                                    ` : '-'}
                                </td>
                                <td>
                                    <div style="max-width: 300px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                        ${escapeHtml(log.details || 'No details')}
                                    </div>
                                </td>
                            </tr>
                        `}).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Failed to load activity logs:', error);
        container.innerHTML = '<div class="error-state">Failed to load activity logs<br><small>' + error.message + '</small></div>';
    }
}

function getActionType(action) {
    if (action.includes('approved')) return { color: 'approved', icon: 'check' };
    if (action.includes('rejected')) return { color: 'rejected', icon: 'x' };
    if (action.includes('suspended')) return { color: 'rejected', icon: 'ban' };
    if (action.includes('created') || action.includes('registered')) return { color: 'info', icon: 'plus' };
    return { color: 'info', icon: 'activity' };
}

// Rejection Modal
function openRejectionModal(type, id) {
    pendingRejectionData = { type, id };
    const modal = document.getElementById('rejection-modal');
    modal.classList.add('active');
    document.getElementById('rejection-reason').value = '';
}

function closeRejectionModal() {
    const modal = document.getElementById('rejection-modal');
    modal.classList.remove('active');
    pendingRejectionData = null;
}

async function submitRejection() {
    if (!pendingRejectionData) return;

    const reason = document.getElementById('rejection-reason').value.trim();
    if (!reason) {
        showNotification('Please enter a reason for rejection', 'error');
        return;
    }

    const { type, id } = pendingRejectionData;

    try {
        const endpoint = type === 'property' ? '/admin/properties/reject' : '/admin/agents/reject';
        const body = type === 'property' 
            ? { property_id: id, reason }
            : { agent_id: id, reason };

        await window.apiCall(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });

        showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} rejected successfully`, 'success');
        closeRejectionModal();
        
        if (type === 'property') {
            await loadPendingProperties();
        } else {
            await loadPendingAgents();
        }
        await loadDashboardStats();
    } catch (error) {
        console.error(`Failed to reject ${type}:`, error);
        showNotification(error.message || `Failed to reject ${type}`, 'error');
    }
}

// Utility functions
function getAuthToken() {
    return localStorage.getItem('authToken');
}

function getUser() {
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
        return JSON.parse(userStr);
    } catch (e) {
        return null;
    }
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', { 
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatCurrency(amount) {
    if (!amount) return '0';
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    // Use the new toast system if available
    if (typeof showToast === 'function') {
        showToast(message, type);
        return;
    }
    
    // Fallback notification
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">
                ${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'}
            </span>
            <span class="notification-message">${escapeHtml(message)}</span>
        </div>
    `;
    
    document.body.appendChild(notification);
    setTimeout(() => notification.classList.add('show'), 10);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

async function logout() {
    const confirmed = await showConfirm(
        'Are you sure you want to logout?',
        { title: 'Logout', confirmText: 'Logout', danger: true }
    );
    
    if (!confirmed) {
        return;
    }

    try {
        // Call backend logout endpoint to blacklist token
        const token = localStorage.getItem('authToken');
        if (token) {
            try {
                await fetch(`${BACKEND_URL}/auth/logout`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
            } catch (error) {
                console.error('Backend logout failed:', error);
                // Continue with client-side logout even if backend fails
            }
        }

        // Stop notification polling if available
        if (typeof notificationManager !== 'undefined' && notificationManager.stopPolling) {
            notificationManager.stopPolling();
        }

        // Clear all auth data
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        localStorage.removeItem('lastUnreadMessages');
        
        // Clear session storage as well
        sessionStorage.clear();

        // Show success message
        showNotification('Logged out successfully', 'success');

        // Redirect to login page after a short delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    } catch (error) {
        console.error('Logout error:', error);
        
        // Force logout even on error
        localStorage.clear();
        sessionStorage.clear();
        showNotification('Logged out', 'info');
        
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
    }
}

// ============= KYC VERIFICATION FUNCTIONS =============

let currentKYCAgent = null;

async function loadPendingKYC() {
    const container = document.getElementById('kyc-list');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const kycSubmissions = await window.apiCall('/admin/pending');
        
        if (kycSubmissions.length === 0) {
            container.innerHTML = '<div class="empty-state">No pending KYC submissions</div>';
            return;
        }

        container.innerHTML = kycSubmissions.map(kyc => {
            const statusBadge = getKYCStatusBadge(kyc.kyc_status);
            const hasDocuments = kyc.government_id_url && kyc.selfie_url;
            
            return `
                <div class="approval-card">
                    <div class="approval-card-header">
                        <div>
                            <h3 class="approval-title">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;margin-right:8px;">
                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                                    <circle cx="12" cy="7" r="4"/>
                                </svg>
                                ${escapeHtml(kyc.first_name || '')} ${escapeHtml(kyc.last_name || '')}
                            </h3>
                            <p class="approval-meta">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;">
                                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                                    <polyline points="22,6 12,13 2,6"/>
                                </svg>
                                ${kyc.email}
                                ${kyc.username ? `• <strong>@${kyc.username}</strong>` : ''}
                            </p>
                            <p class="approval-meta">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;">
                                    <circle cx="12" cy="12" r="10"/>
                                    <polyline points="12 6 12 12 16 14"/>
                                </svg>
                                Submitted: ${formatDate(kyc.kyc_submitted_at)} (${formatRelativeTime(kyc.kyc_submitted_at)})
                            </p>
                            ${kyc.phone_number ? `
                                <p class="approval-meta">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
                                    </svg>
                                    ${kyc.phone_number}
                                </p>
                            ` : ''}
                            ${kyc.id_type && kyc.id_number ? `
                                <p class="approval-meta">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;">
                                        <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                                        <line x1="1" y1="10" x2="23" y2="10"/>
                                    </svg>
                                    ${kyc.id_type.replace('_', ' ').toUpperCase()}: ${kyc.id_number}
                                </p>
                            ` : ''}
                            ${kyc.company ? `
                                <p class="approval-meta">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;">
                                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                    </svg>
                                    Company: ${escapeHtml(kyc.company)}
                                </p>
                            ` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: flex-end;">
                            ${statusBadge}
                            ${!hasDocuments ? '<span class="badge badge-pending" style="background: #f59e0b;">Missing Documents</span>' : ''}
                        </div>
                    </div>
                    
                    ${kyc.completed_visits_count || kyc.declined_visits_count || kyc.no_show_count ? `
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.75rem; margin-top: 1rem; padding: 1rem; background: var(--admin-muted-bg); border-radius: 0.5rem;">
                            <div>
                                <div style="font-size: 0.75rem; color: var(--admin-muted); text-transform: uppercase;">Completed Visits</div>
                                <div style="font-size: 1.25rem; font-weight: 600; color: #10b981;">${kyc.completed_visits_count || 0}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--admin-muted); text-transform: uppercase;">Declined Visits</div>
                                <div style="font-size: 1.25rem; font-weight: 600; color: #f59e0b;">${kyc.declined_visits_count || 0}</div>
                            </div>
                            <div>
                                <div style="font-size: 0.75rem; color: var(--admin-muted); text-transform: uppercase;">No Shows</div>
                                <div style="font-size: 1.25rem; font-weight: 600; color: #ef4444;">${kyc.no_show_count || 0}</div>
                            </div>
                            ${kyc.rating ? `
                                <div>
                                    <div style="font-size: 0.75rem; color: var(--admin-muted); text-transform: uppercase;">Rating</div>
                                    <div style="font-size: 1.25rem; font-weight: 600; color: #3b82f6;">${kyc.rating.toFixed(1)} ⭐</div>
                                </div>
                            ` : ''}
                        </div>
                    ` : ''}
                    
                    <div class="approval-actions" style="margin-top: 1rem;">
                        <button onclick="viewKYCDetails(${kyc.user_id})" class="btn-secondary btn-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                                <circle cx="12" cy="12" r="3"/>
                            </svg>
                            View Full Details
                        </button>
                        ${hasDocuments ? `
                            <button onclick="quickVerifyKYC(${kyc.user_id})" class="btn-success btn-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2">
                                    <polyline points="20 6 9 17 4 12"/>
                                </svg>
                                Verify KYC
                            </button>
                            <button onclick="quickRejectKYC(${kyc.user_id})" class="btn-danger btn-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2">
                                    <line x1="18" y1="6" x2="6" y2="18"/>
                                    <line x1="6" y1="6" x2="18" y2="18"/>
                                </svg>
                                Reject
                            </button>
                        ` : `
                            <span style="color: var(--admin-muted); font-size: 0.875rem;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2;vertical-align:middle;">
                                    <circle cx="12" cy="12" r="10"/>
                                    <line x1="12" y1="8" x2="12" y2="12"/>
                                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                                </svg>
                                Awaiting document upload
                            </span>
                        `}
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Failed to load KYC submissions:', error);
        container.innerHTML = '<div class="error-state">Failed to load KYC submissions<br><small>' + error.message + '</small></div>';
    }
}

function getKYCStatusBadge(status) {
    const statusMap = {
        'pending_review': { text: 'PENDING REVIEW', class: 'badge-pending' },
        'verified': { text: 'VERIFIED', class: 'badge-approved' },
        'rejected': { text: 'REJECTED', class: 'badge-rejected' },
        'not_submitted': { text: 'NOT SUBMITTED', class: 'badge-info' }
    };
    
    const statusInfo = statusMap[status] || { text: status.toUpperCase(), class: 'badge-info' };
    return `<span class="badge ${statusInfo.class}">${statusInfo.text}</span>`;
}

async function viewKYCDetails(agentId) {
    try {
        const kyc = await window.apiCall(`/admin/agent/${agentId}`);
        currentKYCAgent = kyc;
        
        const modal = document.getElementById('kyc-details-modal');
        const content = document.getElementById('kyc-details-content');
        
        const hasDocuments = kyc.government_id_url && kyc.selfie_url;
        
        content.innerHTML = `
            <div class="kyc-details-grid">
                <div class="kyc-section">
                    <h4 class="kyc-section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                            <circle cx="12" cy="7" r="4"/>
                        </svg>
                        Personal Information
                    </h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">Full Name</span>
                            <span class="info-value">${escapeHtml(kyc.first_name)} ${escapeHtml(kyc.last_name)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Email</span>
                            <span class="info-value">${escapeHtml(kyc.email)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Username</span>
                            <span class="info-value">${escapeHtml(kyc.username || 'N/A')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Phone Number</span>
                            <span class="info-value">${escapeHtml(kyc.phone_number || 'N/A')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Company</span>
                            <span class="info-value">${escapeHtml(kyc.company || 'N/A')}</span>
                        </div>
                    </div>
                </div>
                
                <div class="kyc-section">
                    <h4 class="kyc-section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2">
                            <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
                            <line x1="1" y1="10" x2="23" y2="10"/>
                        </svg>
                        Identification Details
                    </h4>
                    <div class="info-grid">
                        <div class="info-item">
                            <span class="info-label">ID Type</span>
                            <span class="info-value">${kyc.id_type ? kyc.id_type.replace('_', ' ').toUpperCase() : 'N/A'}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">ID Number</span>
                            <span class="info-value">${escapeHtml(kyc.id_number || 'N/A')}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">KYC Status</span>
                            <span class="info-value">${getKYCStatusBadge(kyc.kyc_status)}</span>
                        </div>
                        <div class="info-item">
                            <span class="info-label">Submitted At</span>
                            <span class="info-value">${kyc.kyc_submitted_at ? formatDateTime(kyc.kyc_submitted_at) : 'N/A'}</span>
                        </div>
                    </div>
                </div>
                
                ${hasDocuments ? `
                    <div class="kyc-section">
                        <h4 class="kyc-section-title">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                                <circle cx="8.5" cy="8.5" r="1.5"/>
                                <polyline points="21 15 16 10 5 21"/>
                            </svg>
                            Uploaded Documents
                        </h4>
                        <div class="documents-grid">
                            <div class="document-card">
                                <div class="document-label">Government ID</div>
                                <img src="${kyc.government_id_url}" alt="Government ID" class="document-image" onclick="openImageInNewTab('${kyc.government_id_url}')">
                                <button onclick="openImageInNewTab('${kyc.government_id_url}')" class="btn-secondary btn-xs" style="margin-top: 0.5rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                    View Full Size
                                </button>
                            </div>
                            <div class="document-card">
                                <div class="document-label">Selfie with ID</div>
                                <img src="${kyc.selfie_url}" alt="Selfie" class="document-image" onclick="openImageInNewTab('${kyc.selfie_url}')">
                                <button onclick="openImageInNewTab('${kyc.selfie_url}')" class="btn-secondary btn-xs" style="margin-top: 0.5rem;">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                                        <polyline points="15 3 21 3 21 9"/>
                                        <line x1="10" y1="14" x2="21" y2="3"/>
                                    </svg>
                                    View Full Size
                                </button>
                            </div>
                        </div>
                    </div>
                ` : `
                    <div class="kyc-section">
                        <div class="alert alert-warning">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="12" y1="8" x2="12" y2="12"/>
                                <line x1="12" y1="16" x2="12.01" y2="16"/>
                            </svg>
                            No documents uploaded yet. The agent needs to upload their government ID and selfie.
                        </div>
                    </div>
                `}
                
                <div class="kyc-section">
                    <h4 class="kyc-section-title">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2">
                            <path d="M9 11l3 3L22 4"/>
                            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                        </svg>
                        Agent Statistics
                    </h4>
                    <div class="stats-grid-small">
                        <div class="stat-item">
                            <div class="stat-value" style="color: #10b981;">${kyc.completed_visits_count || 0}</div>
                            <div class="stat-label">Completed Visits</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" style="color: #f59e0b;">${kyc.declined_visits_count || 0}</div>
                            <div class="stat-label">Declined Visits</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value" style="color: #ef4444;">${kyc.no_show_count || 0}</div>
                            <div class="stat-label">No Shows</div>
                        </div>
                        ${kyc.rating ? `
                            <div class="stat-item">
                                <div class="stat-value" style="color: #3b82f6;">${kyc.rating.toFixed(1)} ⭐</div>
                                <div class="stat-label">Rating</div>
                            </div>
                        ` : ''}
                        ${kyc.ranking_score ? `
                            <div class="stat-item">
                                <div class="stat-value" style="color: #8b5cf6;">${kyc.ranking_score.toFixed(0)}</div>
                                <div class="stat-label">Ranking Score</div>
                            </div>
                        ` : ''}
                    </div>
                </div>
                
                ${kyc.kyc_rejection_reason ? `
                    <div class="kyc-section">
                        <div class="alert alert-error">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2">
                                <circle cx="12" cy="12" r="10"/>
                                <line x1="15" y1="9" x2="9" y2="15"/>
                                <line x1="9" y1="9" x2="15" y2="15"/>
                            </svg>
                            <div>
                                <strong>Previous Rejection Reason:</strong><br>
                                ${escapeHtml(kyc.kyc_rejection_reason)}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Show/hide action buttons based on status
        const verifyBtn = document.getElementById('kyc-verify-btn');
        const rejectBtn = document.getElementById('kyc-reject-btn');
        
        if (kyc.kyc_status === 'verified') {
            verifyBtn.disabled = true;
            verifyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="20 6 9 17 4 12"/></svg> Already Verified';
            rejectBtn.style.display = 'none';
        } else if (!hasDocuments) {
            verifyBtn.disabled = true;
            rejectBtn.disabled = true;
            verifyBtn.innerHTML = 'Documents Required';
        } else {
            verifyBtn.disabled = false;
            rejectBtn.disabled = false;
            verifyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:16px;height:16px;stroke:currentColor;fill:none;stroke-width:2"><polyline points="20 6 9 17 4 12"/></svg> Verify KYC';
            rejectBtn.style.display = '';
        }
        
        modal.classList.add('active');
    } catch (error) {
        console.error('Failed to load KYC details:', error);
        showNotification('Failed to load KYC details', 'error');
    }
}

function closeKYCDetailsModal() {
    const modal = document.getElementById('kyc-details-modal');
    modal.classList.remove('active');
    currentKYCAgent = null;
}

function openImageInNewTab(url) {
    window.open(url, '_blank');
}

async function verifyKYC() {
    if (!currentKYCAgent) return;
    
    const confirmed = await showConfirm(
        `Are you sure you want to verify KYC for ${currentKYCAgent.first_name} ${currentKYCAgent.last_name}?`,
        { title: 'Verify KYC', confirmText: 'Verify', type: 'success' }
    );
    if (!confirmed) return;
    
    try {
        await window.apiCall(`/admin/agent/${currentKYCAgent.user_id}/verify`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'verified'
            })
        });
        
        showNotification('KYC verified successfully', 'success');
        closeKYCDetailsModal();
        await loadPendingKYC();
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to verify KYC:', error);
        showNotification(error.message || 'Failed to verify KYC', 'error');
    }
}

function rejectKYC() {
    if (!currentKYCAgent) return;
    
    closeKYCDetailsModal();
    openKYCRejectionModal();
}

function openKYCRejectionModal() {
    const modal = document.getElementById('kyc-rejection-modal');
    modal.classList.add('active');
    document.getElementById('kyc-rejection-reason').value = '';
}

function closeKYCRejectionModal() {
    const modal = document.getElementById('kyc-rejection-modal');
    modal.classList.remove('active');
}

async function submitKYCRejection() {
    if (!currentKYCAgent) return;
    
    const reason = document.getElementById('kyc-rejection-reason').value.trim();
    if (!reason) {
        showNotification('Please enter a reason for rejection', 'error');
        return;
    }
    
    try {
        await window.apiCall(`/admin/agent/${currentKYCAgent.user_id}/verify`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'rejected',
                rejection_reason: reason
            })
        });
        
        showNotification('KYC rejected successfully', 'success');
        closeKYCRejectionModal();
        currentKYCAgent = null;
        await loadPendingKYC();
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to reject KYC:', error);
        showNotification(error.message || 'Failed to reject KYC', 'error');
    }
}

async function quickVerifyKYC(agentId) {
    const confirmed = await showConfirm(
        'Are you sure you want to verify this KYC submission?',
        { title: 'Verify KYC', confirmText: 'Verify', type: 'success' }
    );
    if (!confirmed) return;
    
    try {
        await window.apiCall(`/admin/agent/${agentId}/verify`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'verified'
            })
        });
        
        showNotification('KYC verified successfully', 'success');
        await loadPendingKYC();
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to verify KYC:', error);
        showNotification(error.message || 'Failed to verify KYC', 'error');
    }
}

async function quickRejectKYC(agentId) {
    const reason = await showPrompt(
        'Enter reason for KYC rejection:',
        { title: 'Reject KYC', inputType: 'textarea', placeholder: 'Provide detailed reason for rejection...' }
    );
    if (!reason) return;
    
    try {
        await window.apiCall(`/admin/agent/${agentId}/verify`, {
            method: 'POST',
            body: JSON.stringify({
                status: 'rejected',
                rejection_reason: reason
            })
        });
        
        showNotification('KYC rejected successfully', 'success');
        await loadPendingKYC();
        await loadDashboardStats();
    } catch (error) {
        console.error('Failed to reject KYC:', error);
        showNotification(error.message || 'Failed to reject KYC', 'error');
    }
}
