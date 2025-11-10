/* CORDEX front-end script (FULL UPDATED VERSION)
   Place this file at: backend/public/script.js
*/
// Add this at the VERY BEGINNING of script.js - before the IIFE
console.log('COREDEX script loaded');

// Test function to check if APIs are working
async function testAPI() {
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    console.log('API Health Check:', data);
    return data.status === 'OK';
  } catch (error) {
    console.error('API Health Check Failed:', error);
    return false;
  }
}

// Call test on load
document.addEventListener('DOMContentLoaded', () => {
  testAPI().then(apiWorking => {
    if (!apiWorking) {
      console.warn('API is not responding properly');
    }
  });
});
(() => {
  // ---------- Elements ----------
  const navbar = document.getElementById('navbar');
  const solutionsToggle = document.getElementById('solutionsToggle');
  const solutionsItem = document.getElementById('solutionsItem');
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileMenu = document.getElementById('mobileMenu');
  const mobileClose = document.getElementById('mobileClose');
  const mobileSolutions = document.getElementById('mobileSolutions');
  const mobileSolutionsList = document.getElementById('mobileSolutionsList');
  const themeToggle = document.getElementById('themeToggle');
  const themeIcon = document.getElementById('themeIcon');
  const mobileThemeToggle = document.getElementById('mobileThemeToggle');
  const mobileThemeIcon = document.getElementById('mobileThemeIcon');

  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const loginModal = document.getElementById('loginModal');
  const signupModal = document.getElementById('signupModal');
  const closeLogin = document.getElementById('closeLogin');
  const closeSignup = document.getElementById('closeSignup');
  const openSignupFromLogin = document.getElementById('openSignupFromLogin');
  const openLoginFromSignup = document.getElementById('openLoginFromSignup');

  const mobileLogin = document.getElementById('mobileLogin');
  const mobileSignup = document.getElementById('mobileSignup');

  const navAuth = document.getElementById('navAuth');

  const startTrialBtn = document.getElementById('startTrial');
  const watchDemoBtn = document.getElementById('watchDemo');
  const ctaStartBtn = document.getElementById('ctaStart');
  const ctaDocsBtn = document.getElementById('ctaDocs');

  // Removed detector panel elements

  // Pulse CSS (for floating icons) — safe to inject
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
    @keyframes pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.12); }
      100% { transform: scale(1); }
    }
  `;
  document.head.appendChild(styleSheet);

  // ---------- Init ----------
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    restoreUser();
    initEventListeners();
    initFloatingIcons();
  });

  // ---------- Floating icons helper ----------
  function initFloatingIcons() {
    const floatingIcons = document.querySelectorAll('.float');
    floatingIcons.forEach(icon => {
      icon.addEventListener('click', function () {
        const tooltip = this.getAttribute('data-tooltip') || 'Feature';
        const notification = document.createElement('div');
        notification.textContent = `${tooltip} feature activated!`;
        notification.style.cssText = `
          position: fixed;
          top: 50%;
          left: 50%;
          transform: translate(-50%,-50%);
          background: var(--modal-bg);
          color: var(--text-color);
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid var(--glass);
          z-index: 10000;
          opacity: 0;
          transition: opacity .25s ease;
        `;
        document.body.appendChild(notification);
        requestAnimationFrame(() => notification.style.opacity = '1');
        setTimeout(() => {
          notification.style.opacity = '0';
          setTimeout(() => notification.remove(), 300);
        }, 1600);

        this.style.animation = 'pulse .45s ease-in-out';
        setTimeout(() => this.style.animation = '', 450);
      });
    });
  }

  // ---------- Event listeners (Navbar, dropdowns, modals, mobile) ----------
  function initEventListeners() {
    // Navbar scroll
    window.addEventListener('scroll', () => {
      if (!navbar) return;
      if (window.scrollY > 60) navbar.classList.add('scrolled');
      else navbar.classList.remove('scrolled');
    });

    // Solutions dropdown
    solutionsToggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!solutionsItem) return;
      if (solutionsItem.classList.contains('dropdown-open')) closeSolutions();
      else openSolutions();
    });

    document.addEventListener('click', (e) => {
      if (solutionsItem && !solutionsItem.contains(e.target)) closeSolutions();
    });

    // Mobile menu
    mobileToggle?.addEventListener('click', () => {
      mobileMenu?.classList.add('active');
      mobileMenu?.setAttribute('aria-hidden', 'false');
    });
    mobileClose?.addEventListener('click', () => {
      mobileMenu?.classList.remove('active');
      mobileMenu?.setAttribute('aria-hidden', 'true');
    });
    mobileSolutions?.addEventListener('click', () => {
      mobileSolutionsList?.classList.toggle('open');
    });

    // Theme toggle
    themeToggle?.addEventListener('click', toggleTheme);
    mobileThemeToggle?.addEventListener('click', toggleTheme);

    // CTA handlers
    startTrialBtn?.addEventListener('click', () => openModal(signupModal));
    ctaStartBtn?.addEventListener('click', () => openModal(signupModal));
    watchDemoBtn?.addEventListener('click', () => alert('Demo would play here.'));
    ctaDocsBtn?.addEventListener('click', () => alert('Docs would open here.'));

    // Modals open/close handlers
    loginBtn?.addEventListener('click', () => openModal(loginModal));
    signupBtn?.addEventListener('click', () => openModal(signupModal));
    closeLogin?.addEventListener('click', () => closeModal(loginModal));
    closeSignup?.addEventListener('click', () => closeModal(signupModal));

    openSignupFromLogin?.addEventListener('click', () => {
      closeModal(loginModal); openModal(signupModal);
    });
    openLoginFromSignup?.addEventListener('click', () => {
      closeModal(signupModal); openModal(loginModal);
    });

    mobileLogin?.addEventListener('click', () => { closeModal(signupModal); openModal(loginModal); mobileMenu?.classList.remove('active'); });
    mobileSignup?.addEventListener('click', () => { closeModal(loginModal); openModal(signupModal); mobileMenu?.classList.remove('active'); });

    // Close modals with Escape or clicking background
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { closeModal(loginModal); closeModal(signupModal); mobileMenu?.classList.remove('active'); }
    });
    document.addEventListener('click', (e) => {
      if (e.target === loginModal) closeModal(loginModal);
      if (e.target === signupModal) closeModal(signupModal);
    });

    // Removed detector panel event listeners

    // Smooth scroll anchors
    document.querySelectorAll('a[href^="#"]').forEach(a => {
      a.addEventListener('click', function (e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          mobileMenu?.classList.remove('active');
        }
      });
    });

    // Ensure mobile close on outside click
    document.addEventListener('click', (e) => {
      if (mobileMenu?.classList.contains('active') && !mobileMenu.contains(e.target) && !mobileToggle.contains(e.target)) {
        mobileMenu.classList.remove('active');
      }
    });

    // Prevent dropdown staying open on resize
    window.addEventListener('resize', () => {
      closeSolutions();
      mobileSolutionsList?.classList.remove('open');
    });

    // Login & Signup form handlers (wired to auth)
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');

    loginForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = (document.getElementById('loginEmail')?.value || '').trim();
      const password = (document.getElementById('loginPassword')?.value || '').trim();
      if (!email || password.length < 6) { alert('Please enter valid credentials (password >= 6 chars).'); return; }

      const success = await authenticateUser({ email, password }, true);
      if (success) { closeModal(loginModal); }
    });

    signupForm?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = (document.getElementById('signupName')?.value || '').trim();
      const email = (document.getElementById('signupEmail')?.value || '').trim();
      const password = (document.getElementById('signupPassword')?.value || '').trim();
      if (!name || !email || password.length < 6) { alert('Please complete the signup form (password >=6 chars).'); return; }

      const success = await authenticateUser({ name, email, password }, false);
      if (success) { closeModal(signupModal); }
    });

    // social buttons placeholder
    document.querySelectorAll('.social.google').forEach(btn => btn.addEventListener('click', () => alert('Google OAuth placeholder')));
    document.querySelectorAll('.social').forEach(btn => {
      if (!btn.classList.contains('google')) btn.addEventListener('click', () => alert('Social login placeholder'));
    });
  }

  // ---------- Dropdown helpers ----------
  function closeSolutions() {
    solutionsItem?.classList.remove('dropdown-open');
    solutionsItem?.querySelector('.dropdown-menu')?.setAttribute('aria-hidden', 'true');
    solutionsToggle?.setAttribute('aria-expanded', 'false');
  }
  function openSolutions() {
    solutionsItem?.classList.add('dropdown-open');
    solutionsItem?.querySelector('.dropdown-menu')?.setAttribute('aria-hidden', 'false');
    solutionsToggle?.setAttribute('aria-expanded', 'true');
  }

  // ---------- Theme ----------
  function initTheme() {
    const saved = localStorage.getItem('cordex_theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      themeIcon?.classList.remove('fa-moon'); themeIcon?.classList.add('fa-sun');
      mobileThemeIcon?.classList.remove('fa-moon'); mobileThemeIcon?.classList.add('fa-sun');
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      themeIcon?.classList.remove('fa-sun'); themeIcon?.classList.add('fa-moon');
      mobileThemeIcon?.classList.remove('fa-sun'); mobileThemeIcon?.classList.add('fa-moon');
    }
  }
  function toggleTheme() {
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    if (isLight) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('cordex_theme', 'dark');
      themeIcon?.classList.replace('fa-sun','fa-moon');
      mobileThemeIcon?.classList.replace('fa-sun','fa-moon');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('cordex_theme', 'light');
      themeIcon?.classList.replace('fa-moon','fa-sun');
      mobileThemeIcon?.classList.replace('fa-moon','fa-sun');
    }
  }

  // ---------- Modal helpers ----------
  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.setAttribute('aria-hidden','false');
    modalEl.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
  function closeModal(modalEl) {
    if (!modalEl) return;
    modalEl.setAttribute('aria-hidden','true');
    modalEl.style.display = 'none';
    document.body.style.overflow = '';
  }

  // ---------- AUTH (login & signup) ----------
  async function authenticateUser(userData, isLogin = false) {
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        alert(data.error || 'Authentication failed');
        return false;
      }

      // Save token & user
      localStorage.setItem('app_token', data.token);
      localStorage.setItem('app_user', JSON.stringify(data.user));

      // Build nav
      buildUserNav(data.user);

      // Redirect to dashboard/admin
      if (data.user.role === 'admin') {
        window.location.href = '/admin';
      } else {
        window.location.href = '/dashboard';
      }

      return true;
    } catch (err) {
      console.error('Auth error', err);
      alert('Network error: ' + (err.message || 'unknown'));
      return false;
    }
  }

  // Build nav when user is logged in
  function buildUserNav(user) {
    if (!navAuth) return;
    navAuth.innerHTML = `
      <div class="user-menu">
        <button id="userBtn" class="auth-btn">${escapeHtml(user.name)} <i class="fas fa-chevron-down"></i></button>
        <div id="userDrop" class="user-drop hidden">
          <a href="/dashboard" class="dropdown-item">Dashboard</a>
          ${user.role === 'admin' ? '<a href="/admin" class="dropdown-item">Admin Panel</a>' : ''}
          <button id="logoutBtn" class="dropdown-item">Logout</button>
        </div>
      </div>
    `;
    document.getElementById('userBtn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      document.getElementById('userDrop')?.classList.toggle('hidden');
    });
    document.getElementById('logoutBtn')?.addEventListener('click', () => {
      localStorage.removeItem('app_token');
      localStorage.removeItem('app_user');
      localStorage.removeItem('cordex_user');
      location.href = '/';
    });

    // close on outside click
    document.addEventListener('click', () => {
      const drop = document.getElementById('userDrop');
      if (drop) drop.classList.add('hidden');
    });
  }

  // Restore user session
  function restoreUser() {
    const token = localStorage.getItem('app_token') || localStorage.getItem('coredex_token');
    const userStr = localStorage.getItem('app_user') || localStorage.getItem('cordex_user');
    if (!token || !userStr) return;

    try {
      const user = JSON.parse(userStr);
      buildUserNav(user);
    } catch (e) {
      console.error('Failed to parse stored user', e);
    }
  }

  // Removed detector functions

  // ---------- Helpers ----------
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
  }

  // ---------- Export small helpers to window if needed ----------
  // Removed detector helpers

})(); 
