// public/js/auth-client.js

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
      alert(data.error || data.message || 'Authentication failed');
      return false;
    }

    // Save token & user - ensure consistent keys
    localStorage.setItem('app_token', data.token);
    localStorage.setItem('app_user', JSON.stringify(data.user));

    // Clear any old keys
    localStorage.removeItem('coredex_token');

    // Redirect based on role
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

// helper to attach Authorization header
function authFetch(url, opts = {}) {
  const token = localStorage.getItem('app_token');
  const headers = Object.assign({}, opts.headers || {});
  if (token) headers['Authorization'] = 'Bearer ' + token;
  return fetch(url, { ...opts, headers });
}
