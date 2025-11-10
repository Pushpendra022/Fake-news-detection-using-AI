// backend/public/dashboard.js - ENHANCED VERSION
class Dashboard {
  constructor() {
    this.token = localStorage.getItem('app_token') || localStorage.getItem('coredex_token');
    this.user = JSON.parse(localStorage.getItem('app_user') || '{}');
    this.sidebarExpanded = false;

    // DOM Elements
    this.sidebar = document.getElementById('sidebar');
    this.sidebarToggle = document.getElementById('sidebarToggle');
    this.sideItems = document.querySelectorAll('.side-item');
    this.sectionPanels = document.querySelectorAll('.section-panel');
    
    // Analysis Elements
    this.analyzeBtn = document.getElementById('analyzeBtn');
    this.analyzeBtn2 = document.getElementById('analyzeBtn2');
    this.clearBtn = document.getElementById('clearBtn');
    this.clearBtn2 = document.getElementById('clearBtn2');
    this.tabs = document.querySelectorAll('.tab');
    this.tabContents = document.querySelectorAll('.tab-content');
    
    // Results & History
    this.resultsContainer = document.getElementById('resultsContainer');
    this.historyContainer = document.getElementById('historyContainer');
    this.refreshHistoryBtn = document.getElementById('refreshHistory');
    this.clearHistoryBtn = document.getElementById('clearHistory');
    
    // Account Elements
    this.acctName = document.getElementById('acctName');
    this.acctEmail = document.getElementById('acctEmail');
    this.acctRole = document.getElementById('acctRole');
    this.acctCreated = document.getElementById('acctCreated');
    this.changePasswordForm = document.getElementById('changePasswordForm');

    this.init();
  }

  init() {
    if (!this.token || !this.user.id) {
      window.location.href = '/';
      return;
    }

    this.bindEvents();
    this.updateUI();
    this.loadUserHistory();
    this.setupTabSwitching();
  }

  bindEvents() {
    // Sidebar toggle with hover functionality
    this.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
    
    // Sidebar hover behavior
    this.sidebar?.addEventListener('mouseenter', () => {
      if (!this.sidebarExpanded) {
        this.sidebar.classList.add('expanded');
      }
    });

    this.sidebar?.addEventListener('mouseleave', () => {
      if (!this.sidebarExpanded) {
        this.sidebar.classList.remove('expanded');
      }
    });

    // Navigation items
    this.sideItems.forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.handleNavigation(item);
      });
    });

    // Logout buttons
    document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
    document.getElementById('sidebarLogout')?.addEventListener('click', () => this.logout());

    // Analysis buttons
    this.analyzeBtn?.addEventListener('click', () => this.analyzeContent());
    this.analyzeBtn2?.addEventListener('click', () => this.analyzeContent(true));
    this.clearBtn?.addEventListener('click', () => this.clearInput());
    this.clearBtn2?.addEventListener('click', () => this.clearInput(true));

    // History buttons
    this.refreshHistoryBtn?.addEventListener('click', () => this.loadUserHistory());
    this.clearHistoryBtn?.addEventListener('click', () => this.clearHistory());

    // Password change form
    this.changePasswordForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      await this.handlePasswordChange();
    });

    // Handle hash routing
    window.addEventListener('hashchange', () => this.handleHashRoute());
    this.handleHashRoute();
  }

  setupTabSwitching() {
    // Overview tab switching
    this.tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });
  }

  switchTab(tabName) {
    // Update active tab
    this.tabs.forEach(tab => {
      tab.classList.toggle('active', tab.getAttribute('data-tab') === tabName);
    });

    // Update active content
    this.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `${tabName}Content`);
    });

    // Clear inputs when switching tabs
    if (tabName === 'text') {
      document.getElementById('inputUrl').value = '';
    } else if (tabName === 'url') {
      document.getElementById('inputText').value = '';
    }
  }

  toggleSidebar() {
    this.sidebarExpanded = !this.sidebarExpanded;
    this.sidebar.classList.toggle('expanded', this.sidebarExpanded);
    
    // Update toggle button icon
    const icon = this.sidebarToggle.querySelector('i');
    if (this.sidebarExpanded) {
      icon.className = 'fas fa-chevron-left';
    } else {
      icon.className = 'fas fa-bars';
    }
  }

  handleNavigation(item) {
    // Update active states
    this.sideItems.forEach(i => i.classList.remove('active'));
    item.classList.add('active');
    
    const section = item.getAttribute('data-section');
    this.showSection(section);
    
    // Update URL hash
    history.replaceState(null, '', `/dashboard#${section}`);
  }

  handleHashRoute() {
    const hash = window.location.hash.replace('#', '');
    const validSections = ['overview', 'analyze', 'history', 'account'];
    
    if (validSections.includes(hash)) {
      const targetItem = document.querySelector(`.side-item[data-section="${hash}"]`);
      if (targetItem) {
        this.handleNavigation(targetItem);
      }
    } else {
      // Default to overview
      const overviewItem = document.querySelector('.side-item[data-section="overview"]');
      if (overviewItem) {
        this.handleNavigation(overviewItem);
      }
    }
  }

  showSection(name) {
    // Hide all sections
    this.sectionPanels.forEach(s => s.classList.remove('active-panel'));
    
    // Show target section
    const panel = document.getElementById(name);
    if (panel) {
      panel.classList.add('active-panel');
      
      // Special handling for history section
      if (name === 'history') {
        setTimeout(() => this.loadUserHistory(), 100);
      }
    }
  }

  updateUI() {
    // Update welcome message
    const welcomeElement = document.getElementById('userWelcome');
    if (welcomeElement) {
      welcomeElement.textContent = `Welcome, ${this.user.name || 'User'}`;
    }
    
    // Update account info
    this.acctName.textContent = this.user.name || '-';
    this.acctEmail.textContent = this.user.email || '-';
    this.acctRole.textContent = this.user.role || '-';
    this.acctCreated.textContent = this.user.created_at ? 
      new Date(this.user.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }) : '-';
  }

  async analyzeContent(useAlt = false) {
    let content, contentType;
    
    if (useAlt) {
      // Use analyze section input
      content = document.getElementById('inputText2').value.trim();
      contentType = 'text';
    } else {
      // Use overview section inputs
      const activeTab = document.querySelector('.tab.active')?.getAttribute('data-tab') || 'text';
      
      if (activeTab === 'text') {
        content = document.getElementById('inputText').value.trim();
      } else if (activeTab === 'url') {
        content = document.getElementById('inputUrl').value.trim();
      }
      contentType = activeTab;
    }

    // Validation
    if (!content) {
      this.showNotification('Please enter content to analyze', 'warning');
      return;
    }

    if (contentType === 'url' && !this.isValidUrl(content)) {
      this.showNotification('Please enter a valid URL', 'warning');
      return;
    }

    const btn = useAlt ? this.analyzeBtn2 : this.analyzeBtn;
    const originalHtml = btn.innerHTML;
    
    // Show loading state
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
    btn.disabled = true;

    try {
      const response = await fetch('/api/news/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          content: content,
          contentType: contentType
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Analysis failed');
      }

      // Display results
      this.displayResults(result);
      this.showNotification('Analysis completed successfully!', 'success');
      
      // Refresh history
      await this.loadUserHistory();

    } catch (error) {
      console.error('Analysis error:', error);
      this.showNotification(
        error.message || 'Analysis failed. Please try again.', 
        'error'
      );
      
      // Show fallback result for demo purposes
      this.displayFallbackResult(content);
    } finally {
      // Restore button state
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }

  displayResults(result) {
    const verdict = result.verdict || 'uncertain';
    const score = result.score || 50;
    const confidence = result.confidence || 'Medium';
    const summary = result.summary || 'No summary available.';
    const reasons = result.reasons || ['No specific analysis available.'];
    const sources = result.suggested_sources || [];

    const verdictClass = {
      'real': 'positive',
      'fake': 'negative',
      'uncertain': 'neutral'
    }[verdict] || 'neutral';

    const verdictText = {
      'real': 'REAL NEWS',
      'fake': 'FAKE NEWS',
      'uncertain': 'UNCERTAIN'
    }[verdict] || 'UNKNOWN';

    const resultHTML = `
      <div class="result-card">
        <div class="verdict ${verdictClass}">
          ${verdictText} - ${score}%
        </div>
        <div class="score-bar">
          <div style="width: ${score}%"></div>
        </div>
        <div class="analysis-details">
          <h4><i class="fas fa-info-circle"></i> Analysis Summary</h4>
          <p>${this.escapeHtml(summary)}</p>
          
          <h4><i class="fas fa-search"></i> Key Findings</h4>
          <ul>
            ${reasons.map(reason => `<li>${this.escapeHtml(reason)}</li>`).join('')}
          </ul>
          
          ${sources.length > 0 ? `
            <h4><i class="fas fa-external-link-alt"></i> Suggested Sources</h4>
            <ul>
              ${sources.map(source => `<li>${this.escapeHtml(source)}</li>`).join('')}
            </ul>
          ` : ''}
          
          <div style="margin-top: 20px; padding: 15px; background: var(--glass); border-radius: 8px;">
            <h4><i class="fas fa-chart-line"></i> Confidence Level</h4>
            <p style="margin: 5px 0; font-weight: 600; color: var(--${confidence.toLowerCase() === 'high' ? 'success' : confidence.toLowerCase() === 'low' ? 'danger' : 'warning'});">
              ${confidence.toUpperCase()} CONFIDENCE
            </p>
            <small>Based on multiple factors including source credibility, content analysis, and cross-referencing.</small>
          </div>
        </div>
      </div>
    `;

    this.resultsContainer.innerHTML = resultHTML;
  }

  displayFallbackResult(content) {
    // Simple fallback analysis for demo
    const text = content.toLowerCase();
    let score = 65;
    const indicators = [];

    // Basic analysis logic
    if (text.includes('breaking') || text.includes('shocking')) {
      score -= 15;
      indicators.push('Sensational language detected');
    }
    if (text.includes('100%') || text.includes('guaranteed') || text.includes('miracle')) {
      score -= 20;
      indicators.push('Absolute claims often indicate misinformation');
    }
    if (text.includes('study') && !text.includes('university') && !text.includes('research')) {
      score -= 10;
      indicators.push('Vague references to studies');
    }
    if (text.includes('government') || text.includes('official') || text.includes('experts say')) {
      score += 5;
      indicators.push('References to authoritative sources');
    }
    if (text.length > 500) {
      score += 10;
      indicators.push('Detailed content with substantial information');
    }

    score = Math.max(0, Math.min(100, Math.round(score + (Math.random() * 10 - 4))));
    
    let verdict = 'Mixed credibility';
    let verdictClass = 'neutral';
    if (score >= 75) {
      verdict = 'Likely Real';
      verdictClass = 'positive';
    } else if (score <= 45) {
      verdict = 'Likely Fake';
      verdictClass = 'negative';
    }

    const fallbackHTML = `
      <div class="result-card">
        <div class="verdict ${verdictClass}">
          ${verdict} - ${score}%
        </div>
        <div class="score-bar">
          <div style="width: ${score}%"></div>
        </div>
        <div class="analysis-details">
          <h4><i class="fas fa-info-circle"></i> Basic Analysis</h4>
          <p>This is a fallback analysis. The AI analysis service is currently unavailable.</p>
          
          <h4><i class="fas fa-search"></i> Detected Indicators</h4>
          <ul>
            ${indicators.length > 0 ? 
              indicators.map(indicator => `<li>${this.escapeHtml(indicator)}</li>`).join('') : 
              '<li>No significant indicators detected</li>'
            }
          </ul>
          
          <h4><i class="fas fa-lightbulb"></i> Recommendations</h4>
          <ul>
            <li>Cross-check with reputable news outlets</li>
            <li>Verify the author and publication date</li>
            <li>Use fact-checking websites for verification</li>
            <li>Check multiple sources before sharing</li>
          </ul>
        </div>
      </div>
    `;

    this.resultsContainer.innerHTML = fallbackHTML;
  }

  async loadUserHistory() {
    if (!this.historyContainer) return;

    this.historyContainer.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> Loading history...</div>';

    try {
      const response = await fetch('/api/news/history', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load history');
      }

      if (!data || data.length === 0) {
        this.historyContainer.innerHTML = `
          <div class="no-results">
            <i class="fas fa-history"></i>
            <p>No analysis history yet</p>
            <small>Your analyzed news articles will appear here</small>
          </div>
        `;
        return;
      }

      this.historyContainer.innerHTML = data.map(item => {
        const analysis = this.parseAnalysisData(item.analysis_data);
        const verdict = analysis.verdict || item.result || 'uncertain';
        const score = analysis.score || item.credibility_score || 0;
        const preview = item.content && item.content.length > 120 ? 
          item.content.substring(0, 120) + '...' : 
          (item.content || 'No content preview');
        
        const created = new Date(item.created_at).toLocaleString();

        return `
          <div class="history-item" data-id="${item.id}">
            <div class="history-header">
              <span class="verdict-badge ${verdict === 'real' ? 'positive' : verdict === 'fake' ? 'negative' : 'neutral'}">
                ${verdict.toUpperCase()}
              </span>
              <span class="score" style="font-weight: 600; color: var(--primary);">${score}%</span>
              <span class="date" style="color: var(--muted); font-size: 0.9em;">${created}</span>
              <div class="history-actions-inline">
                <button class="btn btn-sm outline view-history" data-id="${item.id}" title="View Details">
                  <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm danger delete-history" data-id="${item.id}" title="Delete">
                  <i class="fas fa-trash"></i>
                </button>
              </div>
            </div>
            <div class="history-content">${this.escapeHtml(preview)}</div>
            <div class="history-type">Type: ${this.escapeHtml(item.content_type || 'text')}</div>
          </div>
        `;
      }).join('');

      // Add event listeners to history items
      this.attachHistoryEventListeners(data);

    } catch (error) {
      console.error('History load error:', error);
      this.historyContainer.innerHTML = `
        <div class="error">
          <i class="fas fa-exclamation-triangle"></i>
          <p>Failed to load history</p>
          <small>${error.message || 'Please try again later'}</small>
        </div>
      `;
    }
  }

  attachHistoryEventListeners(historyData) {
    // View history items
    this.historyContainer.querySelectorAll('.view-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-id');
        const item = historyData.find(d => String(d.id) === String(id));
        
        if (item) {
          const analysisData = this.parseAnalysisData(item.analysis_data);
          this.displayResults(analysisData);
          
          // Navigate to overview section
          const overviewItem = document.querySelector('.side-item[data-section="overview"]');
          if (overviewItem) {
            this.handleNavigation(overviewItem);
          }
        }
      });
    });

    // Delete history items
    this.historyContainer.querySelectorAll('.delete-history').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteHistoryItem(btn.getAttribute('data-id'));
      });
    });

    // Click on history item to view
    this.historyContainer.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (!e.target.closest('.history-actions-inline')) {
          const id = item.getAttribute('data-id');
          const historyItem = historyData.find(d => String(d.id) === String(id));
          
          if (historyItem) {
            const analysisData = this.parseAnalysisData(historyItem.analysis_data);
            this.displayResults(analysisData);
            
            const overviewItem = document.querySelector('.side-item[data-section="overview"]');
            if (overviewItem) {
              this.handleNavigation(overviewItem);
            }
          }
        }
      });
    });
  }

  parseAnalysisData(analysisData) {
    if (!analysisData) return {};
    
    try {
      return typeof analysisData === 'string' ? 
        JSON.parse(analysisData) : 
        analysisData;
    } catch (e) {
      console.error('Error parsing analysis data:', e);
      return {};
    }
  }

  async deleteHistoryItem(id) {
    if (!confirm('Are you sure you want to delete this analysis history?')) {
      return;
    }

    try {
      const response = await fetch(`/api/news/history/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Delete failed');
      }

      this.showNotification('History item deleted successfully', 'success');
      await this.loadUserHistory();

    } catch (error) {
      console.error('Delete error:', error);
      this.showNotification('Failed to delete history item', 'error');
    }
  }

  async clearHistory() {
    if (!confirm('Are you sure you want to clear ALL analysis history? This action cannot be undone.')) {
      return;
    }

    try {
      // Get all history items first
      const response = await fetch('/api/news/history', {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });

      const items = await response.json();

      if (!response.ok) {
        throw new Error('Failed to fetch history items');
      }

      // Delete each item
      for (const item of items) {
        await fetch(`/api/news/history/${item.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${this.token}`
          }
        });
      }

      this.showNotification('All history cleared successfully', 'success');
      await this.loadUserHistory();

    } catch (error) {
      console.error('Clear history error:', error);
      this.showNotification('Failed to clear history', 'error');
    }
  }

  async handlePasswordChange() {
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!oldPassword || !newPassword) {
      this.showNotification('Please fill in all password fields', 'warning');
      return;
    }

    if (newPassword.length < 6) {
      this.showNotification('New password must be at least 6 characters', 'warning');
      return;
    }

    try {
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({
          oldPassword: oldPassword,
          newPassword: newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Password change failed');
      }

      this.showNotification('Password changed successfully!', 'success');
      this.changePasswordForm.reset();

    } catch (error) {
      console.error('Password change error:', error);
      this.showNotification(
        error.message || 'Password change failed. Please try again.',
        'error'
      );
    }
  }

  clearInput(useAlt = false) {
    if (useAlt) {
      document.getElementById('inputText2').value = '';
    } else {
      document.getElementById('inputText').value = '';
      document.getElementById('inputUrl').value = '';
    }

    this.resultsContainer.innerHTML = `
      <div class="no-results">
        <i class="fas fa-search"></i>
        <p>Enter news content and click analyze to see results</p>
        <small>You can analyze text or URLs for authenticity</small>
      </div>
    `;
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

  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
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

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new Dashboard();
});