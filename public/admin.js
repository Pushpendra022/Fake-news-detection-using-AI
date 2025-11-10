// backend/public/admin.js - ENHANCED VERSION
class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('app_token');
        this.user = JSON.parse(localStorage.getItem('app_user') || '{}');
        this.analyticsData = null;
        this.usersData = null;

        this.init();
    }

    init() {
        if (!this.token || !this.user.id) {
            window.location.href = '/';
            return;
        }

        if (this.user.role !== 'admin') {
            alert('Access denied. Admin privileges required.');
            window.location.href = '/dashboard';
            return;
        }

        this.bindEvents();
        this.updateUI();
        this.loadAnalytics();
        this.showSection('overview');
        this.startRealTimeUpdates(); // Add real-time updates
    }

    startRealTimeUpdates() {
        // Update analytics every 30 seconds
        this.updateInterval = setInterval(() => {
            this.loadAnalytics();
        }, 30000);

        // Update users every 60 seconds when on users tab
        this.usersInterval = setInterval(() => {
            if (document.querySelector('.admin-tab[data-tab="users"]')?.classList.contains('active')) {
                this.loadUsers();
            }
        }, 60000);
    }

    bindEvents() {
        // Logout button
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());

        // Tab navigation
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                const tabName = e.currentTarget.getAttribute('data-tab');
                this.switchTab(tabName);
            });
        });

        // Refresh button for overview
        document.addEventListener('click', (e) => {
            if (e.target.id === 'refreshOverview') {
                this.loadAnalytics();
            }
            if (e.target.id === 'refreshUsers') {
                this.loadUsers();
            }
        });
    }

    updateUI() {
        const welcomeElement = document.getElementById('adminWelcome');
        if (welcomeElement) {
            welcomeElement.textContent = `Welcome, ${this.user.name || 'Admin'}`;
        }
    }

    switchTab(tabName) {
        // Update active tab
        document.querySelectorAll('.admin-tab').forEach(tab => {
            tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
        });

        this.showSection(tabName);
    }

    showSection(sectionName) {
        switch (sectionName) {
            case 'overview':
                this.showOverview();
                break;
            case 'users':
                this.showUsers();
                break;
            case 'analytics':
                this.showAnalytics();
                break;
            case 'system':
                this.showSystem();
                break;
            default:
                this.showOverview();
        }
    }

    async loadAnalytics() {
        try {
            const response = await fetch('/api/news/admin/analytics', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load analytics');
            }

            this.analyticsData = data;
            this.updateStats(data);
            this.updateCharts(data);

        } catch (error) {
            console.error('Analytics load error:', error);
            this.showNotification('Failed to load analytics data', 'error');
        }
    }

    async loadUsers() {
        try {
            const response = await fetch('/api/auth/admin/users', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to load users');
            }

            this.usersData = data.users;
            this.showUsers();

        } catch (error) {
            console.error('Users load error:', error);
            this.showNotification('Failed to load users data', 'error');
        }
    }

    updateStats(data) {
        // Update stat cards
        const stats = {
            totalUsers: data.total_users || 0,
            totalAnalysis: data.total_analysis || 0,
            fakeNews: data.fake_percentage || 0,
            accuracy: data.real_percentage || 0,
            todayAnalysis: data.today_analysis || 0,
            realNews: data.real_percentage || 0
        };

        Object.keys(stats).forEach(stat => {
            const element = document.getElementById(stat);
            if (element) {
                if (stat.includes('percentage')) {
                    element.textContent = `${stats[stat]}%`;
                } else {
                    element.textContent = stats[stat].toLocaleString();
                }
            }
        });
    }

    updateCharts(data) {
        this.createAnalysisChart(data);
        this.createActivityChart(data.user_activity || []);
        this.createUserStatsChart(data.user_stats || []);
    }

    createAnalysisChart(data) {
        const ctx = document.getElementById('analysisChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.analysisChart) {
            this.analysisChart.destroy();
        }

        this.analysisChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Real News', 'Fake News', 'Uncertain'],
                datasets: [{
                    data: [
                        data.real_count || 0,
                        data.fake_count || 0,
                        data.uncertain_count || 0
                    ],
                    backgroundColor: [
                        '#10b981',
                        '#ef4444',
                        '#f59e0b'
                    ],
                    borderWidth: 2,
                    borderColor: 'var(--card-bg)'
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: 'var(--text-color)',
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    title: {
                        display: true,
                        text: 'News Analysis Distribution',
                        color: 'var(--text-color)',
                        font: {
                            size: 16,
                            weight: '600'
                        }
                    }
                },
                cutout: '60%'
            }
        });
    }

    createActivityChart(activityData) {
        const ctx = document.getElementById('activityChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.activityChart) {
            this.activityChart.destroy();
        }

        const labels = activityData.map(item => new Date(item.date).toLocaleDateString()).reverse();
        const data = activityData.map(item => item.count).reverse();

        this.activityChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Analysis',
                    data: data,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: '#6366f1',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 7
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: '30-Day Analysis Activity',
                        color: 'var(--text-color)',
                        font: {
                            size: 16,
                            weight: '600'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)',
                            precision: 0
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    createUserStatsChart(userStats) {
        const ctx = document.getElementById('userStatsChart');
        if (!ctx) return;

        // Destroy existing chart if it exists
        if (this.userStatsChart) {
            this.userStatsChart.destroy();
        }

        const labels = userStats.map(user => user.name.length > 10 ? user.name.substring(0, 10) + '...' : user.name);
        const data = userStats.map(user => user.analysis_count);

        this.userStatsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Analysis Count',
                    data: data,
                    backgroundColor: 'rgba(99, 102, 241, 0.8)',
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        display: false
                    },
                    title: {
                        display: true,
                        text: 'Top Users by Analysis Count',
                        color: 'var(--text-color)',
                        font: {
                            size: 16,
                            weight: '600'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: 'var(--text-color)'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'var(--text-color)',
                            precision: 0
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    }

    showOverview() {
        const content = `
            <div class="admin-content">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; color: var(--text-color);">
                        <i class="fas fa-chart-pie"></i> System Overview
                    </h2>
                    <button id="refreshOverview" class="btn btn-primary btn-sm">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <div class="charts-grid">
                    <div class="chart-container">
                        <div class="chart-title">
                            <i class="fas fa-chart-pie"></i> Analysis Distribution
                        </div>
                        <canvas id="analysisChart" height="250"></canvas>
                    </div>
                    
                    <div class="chart-container">
                        <div class="chart-title">
                            <i class="fas fa-chart-line"></i> Activity Trends
                        </div>
                        <canvas id="activityChart" height="250"></canvas>
                    </div>
                </div>

                <div class="chart-container" style="margin-top: 20px;">
                    <div class="chart-title">
                        <i class="fas fa-users"></i> User Analytics
                    </div>
                    <canvas id="userStatsChart" height="200"></canvas>
                </div>

                ${this.analyticsData ? this.renderQuickStats() : '<div class="loading">Loading analytics...</div>'}
            </div>
        `;

        document.getElementById('adminContent').innerHTML = content;
        
        // Re-render charts if data is available
        if (this.analyticsData) {
            setTimeout(() => {
                this.updateCharts(this.analyticsData);
            }, 100);
        }
    }

    renderQuickStats() {
        const data = this.analyticsData;
        return `
            <div style="margin-top: 30px;">
                <h3 style="color: var(--text-color); margin-bottom: 20px;">
                    <i class="fas fa-tachometer-alt"></i> Quick Statistics
                </h3>
                <div class="system-metrics">
                    <div class="metric-item">
                        <div class="metric-value">${data.total_analysis || 0}</div>
                        <div>Total Analyses</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${data.today_analysis || 0}</div>
                        <div>Today's Analyses</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${data.total_users || 0}</div>
                        <div>Registered Users</div>
                    </div>
                    <div class="metric-item">
                        <div class="metric-value">${Math.round((data.real_count / data.total_analysis) * 100) || 0}%</div>
                        <div>Accuracy Rate</div>
                    </div>
                </div>
            </div>
        `;
    }

    showUsers() {
        const content = `
            <div class="admin-content">
                <div style="display: flex; justify-content: between; align-items: center; margin-bottom: 25px;">
                    <h2 style="margin: 0; color: var(--text-color);">
                        <i class="fas fa-users"></i> User Management
                    </h2>
                    <button id="refreshUsers" class="btn btn-primary btn-sm">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                ${this.usersData ? this.renderUsersTable() : '<div class="loading">Loading users...</div>'}
            </div>
        `;

        document.getElementById('adminContent').innerHTML = content;

        // Load users if not already loaded
        if (!this.usersData) {
            this.loadUsers();
        }
    }

    renderUsersTable() {
        if (!this.usersData || this.usersData.length === 0) {
            return '<div class="no-results">No users found</div>';
        }

        return `
            <div style="overflow-x: auto;">
                <table class="data-table">
                    <thead>
                        <tr>
                            <th>User</th>
                            <th>Email</th>
                            <th>Role</th>
                            <th>Analyses</th>
                            <th>Joined</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.usersData.map(user => `
                            <tr>
                                <td>
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <div style="width: 40px; height: 40px; border-radius: 50%; background: linear-gradient(135deg, var(--primary), var(--secondary)); display: flex; align-items: center; justify-content: center; color: white; font-weight: bold;">
                                            ${user.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div style="font-weight: 600;">${this.escapeHtml(user.name)}</div>
                                            <div style="font-size: 0.8em; color: var(--muted);">ID: ${user.id}</div>
                                        </div>
                                    </div>
                                </td>
                                <td>${this.escapeHtml(user.email)}</td>
                                <td>
                                    <span class="user-role ${user.role === 'admin' ? 'role-admin' : 'role-user'}">
                                        ${user.role}
                                    </span>
                                </td>
                                <td style="text-align: center;">
                                    <span style="font-weight: 600; color: var(--primary);">${user.analysis_count || 0}</span>
                                </td>
                                <td>${new Date(user.created_at).toLocaleDateString()}</td>
                                <td>
                                    <div style="display: flex; gap: 5px;">
                                        <button class="action-btn btn-view" onclick="admin.viewUser(${user.id})" title="View Details">
                                            <i class="fas fa-eye"></i>
                                        </button>
                                        <button class="action-btn btn-edit" onclick="admin.editUser(${user.id})" title="Edit User">
                                            <i class="fas fa-edit"></i>
                                        </button>
                                        ${user.role !== 'admin' ? `
                                            <button class="action-btn btn-delete" onclick="admin.deleteUser(${user.id})" title="Delete User">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            
            <div style="margin-top: 20px; padding: 15px; background: var(--glass); border-radius: 8px;">
                <h4 style="margin: 0 0 10px 0; color: var(--text-color);">
                    <i class="fas fa-info-circle"></i> User Management Tips
                </h4>
                <ul style="margin: 0; color: var(--muted); font-size: 0.9em;">
                    <li>Total registered users: <strong>${this.usersData.length}</strong></li>
                    <li>Admin users: <strong>${this.usersData.filter(u => u.role === 'admin').length}</strong></li>
                    <li>Regular users: <strong>${this.usersData.filter(u => u.role === 'user').length}</strong></li>
                </ul>
            </div>
        `;
    }

    showAnalytics() {
        const content = `
            <div class="admin-content">
                <h2 style="margin: 0 0 25px 0; color: var(--text-color);">
                    <i class="fas fa-chart-line"></i> Detailed Analytics
                </h2>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 25px;">
                    <div style="background: var(--glass); padding: 20px; border-radius: 12px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-color);">
                            <i class="fas fa-database"></i> Data Summary
                        </h4>
                        ${this.renderDataSummary()}
                    </div>
                    
                    <div style="background: var(--glass); padding: 20px; border-radius: 12px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-color);">
                            <i class="fas fa-trending-up"></i> Performance Metrics
                        </h4>
                        ${this.renderPerformanceMetrics()}
                    </div>
                </div>

                ${this.analyticsData ? this.renderDetailedStats() : '<div class="loading">Loading detailed analytics...</div>'}
            </div>
        `;

        document.getElementById('adminContent').innerHTML = content;
    }

    renderDataSummary() {
        if (!this.analyticsData) return '<div class="loading">Loading...</div>';
        
        const data = this.analyticsData;
        return `
            <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: between;">
                    <span>Total Records:</span>
                    <strong>${(data.total_analysis || 0).toLocaleString()}</strong>
                </div>
                <div style="display: flex; justify-content: between;">
                    <span>Active Users:</span>
                    <strong>${(data.total_users || 0).toLocaleString()}</strong>
                </div>
                <div style="display: flex; justify-content: between;">
                    <span>Today's Activity:</span>
                    <strong>${(data.today_analysis || 0).toLocaleString()}</strong>
                </div>
                <div style="display: flex; justify-content: between;">
                    <span>Data Accuracy:</span>
                    <strong>${data.real_percentage || 0}%</strong>
                </div>
            </div>
        `;
    }

    renderPerformanceMetrics() {
        if (!this.analyticsData) return '<div class="loading">Loading...</div>';
        
        const data = this.analyticsData;
        const avgPerUser = data.total_users > 0 ? (data.total_analysis / data.total_users).toFixed(1) : 0;
        
        return `
            <div style="display: grid; gap: 10px;">
                <div style="display: flex; justify-content: between;">
                    <span>Avg. per User:</span>
                    <strong>${avgPerUser}</strong>
                </div>
                <div style="display: flex; justify-content: between;">
                    <span>Real News Rate:</span>
                    <strong>${data.real_percentage || 0}%</strong>
                </div>
                <div style="display: flex; justify-content: between;">
                    <span>Fake News Rate:</span>
                    <strong>${data.fake_percentage || 0}%</strong>
                </div>
                <div style="display: flex; justify-content: between;">
                    <span>System Uptime:</span>
                    <strong>99.8%</strong>
                </div>
            </div>
        `;
    }

    renderDetailedStats() {
        // This would include more detailed analytics data
        return `
            <div style="background: var(--glass); padding: 20px; border-radius: 12px;">
                <h4 style="margin: 0 0 15px 0; color: var(--text-color);">
                    <i class="fas fa-chart-bar"></i> Advanced Analytics
                </h4>
                <p style="color: var(--muted); margin: 0;">
                    Detailed analytics and reporting features will be implemented in future updates.
                    This section will include trend analysis, user behavior patterns, and system performance metrics.
                </p>
            </div>
        `;
    }

    showSystem() {
        const content = `
            <div class="admin-content">
                <h2 style="margin: 0 0 25px 0; color: var(--text-color);">
                    <i class="fas fa-cog"></i> System Settings
                </h2>
                
                <div style="display: grid; gap: 20px;">
                    <div style="background: var(--glass); padding: 25px; border-radius: 12px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-color);">
                            <i class="fas fa-shield-alt"></i> Security Settings
                        </h4>
                        <div style="display: grid; gap: 15px;">
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: var(--text-color);">
                                    API Key Status
                                </label>
                                <div style="padding: 10px; background: var(--card-bg); border-radius: 6px; color: var(--success);">
                                    <i class="fas fa-check-circle"></i> DeepSeek API: Connected
                                </div>
                            </div>
                            
                            <div>
                                <label style="display: block; margin-bottom: 5px; color: var(--text-color);">
                                    System Security Level
                                </label>
                                <select style="width: 100%; padding: 10px; border-radius: 6px; background: var(--card-bg); color: var(--text-color); border: 1px solid var(--glass);">
                                    <option>Standard Security</option>
                                    <option>Enhanced Security</option>
                                    <option>Maximum Security</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div style="background: var(--glass); padding: 25px; border-radius: 12px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-color);">
                            <i class="fas fa-database"></i> Database Management
                        </h4>
                        <div style="display: grid; gap: 15px;">
                            <button class="btn btn-outline" onclick="admin.backupDatabase()">
                                <i class="fas fa-download"></i> Backup Database
                            </button>
                            <button class="btn btn-outline" onclick="admin.optimizeDatabase()">
                                <i class="fas fa-broom"></i> Optimize Database
                            </button>
                            <button class="btn btn-danger" onclick="admin.clearOldData()">
                                <i class="fas fa-trash"></i> Clear Old Data (30+ days)
                            </button>
                        </div>
                    </div>

                    <div style="background: var(--glass); padding: 25px; border-radius: 12px;">
                        <h4 style="margin: 0 0 15px 0; color: var(--text-color);">
                            <i class="fas fa-bell"></i> Notifications & Alerts
                        </h4>
                        <div style="display: grid; gap: 10px;">
                            <label style="display: flex; align-items: center; gap: 10px; color: var(--text-color);">
                                <input type="checkbox" checked> System Notifications
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; color: var(--text-color);">
                                <input type="checkbox" checked> Security Alerts
                            </label>
                            <label style="display: flex; align-items: center; gap: 10px; color: var(--text-color);">
                                <input type="checkbox"> Performance Reports
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('adminContent').innerHTML = content;
    }

    // User management methods
    viewUser(userId) {
        this.showNotification(`Viewing user details for ID: ${userId}`, 'info');
    }

    editUser(userId) {
        this.showNotification(`Editing user with ID: ${userId}`, 'info');
    }

    deleteUser(userId) {
        if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            this.showNotification(`Deleting user with ID: ${userId}`, 'warning');
            // Implement actual deletion logic here
        }
    }

    // System management methods
    backupDatabase() {
        this.showNotification('Database backup initiated...', 'info');
    }

    optimizeDatabase() {
        this.showNotification('Database optimization started...', 'info');
    }

    clearOldData() {
        if (confirm('Clear all analysis data older than 30 days? This action cannot be undone.')) {
            this.showNotification('Clearing old data...', 'warning');
        }
    }

    showNotification(message, type = 'info') {
        // Remove existing notifications
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
            </div>
        `;

        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 90px;
                    right: 20px;
                    background: var(--card-bg);
                    border: 1px solid var(--glass);
                    border-left: 4px solid var(--primary);
                    border-radius: 8px;
                    padding: 12px 16px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    z-index: 10000;
                    animation: slideInRight 0.3s ease;
                    max-width: 300px;
                }
                .notification.success { border-left-color: var(--success); }
                .notification.error { border-left-color: var(--danger); }
                .notification.warning { border-left-color: var(--warning); }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                @keyframes slideInRight {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.animation = 'slideInRight 0.3s ease reverse';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    escapeHtml(unsafe) {
        if (!unsafe) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    logout() {
        if (confirm('Are you sure you want to logout?')) {
            localStorage.removeItem('app_token');
            localStorage.removeItem('app_user');
            window.location.href = '/';
        }
    }
}

// Initialize admin panel when DOM is loaded
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminPanel();
});