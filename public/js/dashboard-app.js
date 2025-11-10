 
 // public/js/dashboard-app.js
// Dashboard app: handles auth verify, SSE, analyze, history, UI and theme toggle.

// TOKEN KEY used by auth-client.js (keep consistent)
const TOKEN_KEY = 'app_token';
const USER_KEY = 'app_user';

let currentHistoryType = 'analysis';
let currentSessionId = null;

// small helper for auth header
function authHeaders() {
  const token = localStorage.getItem(TOKEN_KEY) || localStorage.getItem('coredex_token');
  return token ? { 'Authorization': 'Bearer ' + token } : {};
}

// escape html
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// --- UI helpers ---
function q(id) { return document.getElementById(id); }
function showSection(name) {
  // Hide all sections first
  ['overview','analyze','chat','history','account'].forEach(sec => {
    q('section-' + sec).style.display = 'none';
  });

  // Show only the active section
  if (q('section-' + name)) {
    q('section-' + name).style.display = '';
  }

  // Update navigation active states (only for sections that have nav buttons)
  ['analyze','chat','history','account'].forEach(sec => {
    q('nav-' + sec).classList.toggle('active', sec === name);
  });

  // Load data when switching to sections
  if (name === 'history' && localStorage.getItem(TOKEN_KEY)) {
    loadHistory();
  }
  if (name === 'chat' && localStorage.getItem(TOKEN_KEY)) {
    loadChatHistory();
  }
}

// --- Theme toggle (removed) ---

// --- Navigation buttons ---
q('nav-analyze').addEventListener('click', () => showSection('analyze'));
q('nav-chat').addEventListener('click', () => showSection('chat'));
q('nav-history').addEventListener('click', () => showSection('history'));
q('nav-account').addEventListener('click', () => showSection('account'));
q('logoutBtn').addEventListener('click', () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  window.location.href = '/';
});



// --- Verify auth on load (if present) ---
async function verifyAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token) {
    // no stored token — redirect to home (login)
    alert("Please log in to access your dashboard.");
    window.location.href = '/';
    return;
  }
  try {
    const res = await fetch('/api/auth/verify', { headers: { 'Authorization': 'Bearer ' + token }});
    if (!res.ok) {
      // invalid token
      alert("Your session has expired. Please log in again.");
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      window.location.href = '/';
      return;
    }
    const data = await res.json();
    if (data && data.success && data.user) {
      const user = data.user;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      q('welcomeText').textContent = `Welcome, ${user.name || user.email}`;
      q('accountName').textContent = user.name || user.email.split('@')[0];
      q('accountEmail').textContent = user.email;
      q('avatarBox').textContent = (user.name || user.email).charAt(0).toUpperCase();
    } else {
      alert("Authentication failed. Please log in again.");
      window.location.href = '/';
    }
  } catch (e) {
    console.warn('verifyAuth error', e);
    alert("Authentication error. Please log in again.");
    window.location.href = '/';
  }
}

// --- SSE (real-time stats) ---
function startSSE() {
  try {
    const es = new EventSource('/api/stream/stats');
    es.onmessage = (ev) => {
      try {
        const d = JSON.parse(ev.data);
        q('statTotalAnalysis').textContent = d.totalAnalysis ?? 0;
        q('statFakePercent').textContent = (d.fakePercentage ?? 0) + '%';
        q('liveBadge').textContent = 'Connected';
        // Force refresh history when stats update (indicating new analysis)
        if (localStorage.getItem(TOKEN_KEY)) {
          loadHistory();
        }
      } catch (e) { console.error('SSE parse', e); }
    };
    es.onerror = (err) => {
      console.warn('SSE error', err);
      q('liveBadge').textContent = 'Disconnected';
      // try reconnect in 5s
      setTimeout(() => {
        startSSE();
      }, 5000);
      es.close();
    };
  } catch (e) {
    console.warn('SSE not supported', e);
    q('liveBadge').textContent = 'Unavailable';
  }
}

// --- Analyze (shared for quick/detailed) ---
async function analyzeText(content, targetResultElem) {
  if (!content || content.trim().length < 10) {
    alert('Please provide at least 10 characters of content.');
    return null;
  }

  try {
    const res = await fetch('/api/news/analyze', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, authHeaders()),
      body: JSON.stringify({ content })
    });

    const data = await res.json().catch(()=>null);
    if (!res.ok || !data) {
      console.error('Analyze failed', res.status, data);
      alert('Analysis failed. See console for details.');
      return null;
    }

    // data.success, data.analysis
    const analysis = data.analysis || data;
    // format output
    const verdict = analysis.verdict || 'uncertain';
    const score = analysis.score ?? 50;
    const summary = analysis.summary || '';
    const reasons = Array.isArray(analysis.reasons) ? analysis.reasons.join(', ') : (analysis.reasons || '');

    const card = targetResultElem;
    card.style.display = 'block';
    card.className = 'result ' + (verdict === 'real' ? 'real' : verdict === 'fake' ? 'fake' : '');
    card.innerHTML = `
      <strong>Verdict:</strong> ${verdict.toUpperCase()} &nbsp; <small class="muted">(${score}%)</small>
      <div style="margin-top:8px">${summary}</div>
      <div style="margin-top:8px;color:var(--muted)"><strong>Reasons:</strong> ${reasons}</div>
      <div style="margin-top:8px;font-size:12px;color:var(--muted)"><em>Source: ${data.source || 'unknown'}</em></div>
    `;

    // refresh history if logged in
    if (localStorage.getItem(TOKEN_KEY)) {
      await loadHistory();
    }

    return analysis;
  } catch (e) {
    console.error('analyzeText error', e);
    alert('Analysis failed: ' + (e.message || 'unknown'));
    return null;
  }
}

// --- Quick analyze handler ---
q('quickAnalyzeBtn').addEventListener('click', async () => {
  const content = q('quickContent').value;
  const card = q('quickResult');
  card.style.display = 'none';
  await analyzeText(content, card);
});

// --- Detailed analyze handler ---
q('analyzeBtn').addEventListener('click', async () => {
  let content = q('analyzeContent').value;
  const url = q('analyzeUrl').value.trim();

  if (!content && !url) {
    alert('Please provide either text content or a URL to analyze.');
    return;
  }

  // If URL is provided, use it as content
  if (url && !content) {
    content = url;
  }

  const card = q('analyzeResult');
  card.style.display = 'none';
  await analyzeText(content, card);
});

q('clearQuickBtn').addEventListener('click', () => { q('quickContent').value = ''; q('quickResult').style.display='none'; });
q('clearAnalyzeBtn').addEventListener('click', () => {
  q('analyzeContent').value = '';
  q('analyzeUrl').value = '';
  q('analyzeResult').style.display='none';
});

// --- History functions ---
async function loadHistory() {
  const list = q('historyList');
  const token = localStorage.getItem(TOKEN_KEY);
  const user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");

  // Check if user is logged in
  if (!token || !user.id) {
    list.innerHTML = '<div class="muted">Please log in to view your history</div>';
    return;
  }

  list.innerHTML = '<div class="muted">Loading your personal history...</div>';

  try {
    if (currentHistoryType === 'chat') {
      // Load chat history
      const res = await fetch('/api/news/chat/history', { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        console.warn('Failed to load chat history:', res.status, err);
        list.innerHTML = `<div class="muted">Unable to load your chat history: ${err.error || res.status}</div>`;
        return;
      }
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load chat history");
      }

      const sessions = data.history || [];

      if (!sessions || sessions.length === 0) {
        list.innerHTML = `<div class="muted">You haven't chatted yet. Start a conversation with COREDEX AI!</div>`;
        return;
      }

      console.log(`Chat history loaded:`, sessions.length, 'sessions for user', user.name || user.email);

      list.innerHTML = sessions.map(s => {
        const preview = (s.last_message || '').slice(0, 140) + ((s.last_message||'').length>140 ? '…' : '');
        return `<div class="history-item"><div><strong>Chat Session</strong><div class="muted" style="font-size:12px">${new Date(s.created_at).toLocaleString()}</div></div><div>${escapeHtml(preview)}</div><div class="flex"><button data-session-id="${s.session_id}" class="btn alt viewBtn">View</button><button data-session-id="${s.session_id}" class="btn alt delBtn">Delete</button></div></div>`;
      }).join('');

      // attach listeners for chat view
      list.querySelectorAll('.viewBtn').forEach(b=> b.addEventListener('click', async () => {
        const sessionId = b.getAttribute('data-session-id');
        // Switch to chat section and load the session
        showSection('chat');
        currentSessionId = sessionId;
        await loadChatHistory();
      }));

      // attach listeners for chat delete
      list.querySelectorAll('.delBtn').forEach(b=> b.addEventListener('click', async () => {
        const sessionId = b.getAttribute('data-session-id');
        if (!confirm('Delete this chat session? This will permanently remove it from your account.')) return;
        const res = await fetch(`/api/news/chat/history/${sessionId}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) { alert('Delete failed'); return; }
        await loadHistory();
      }));
    } else {
      // Load analysis history
      const res = await fetch('/api/news/history', { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        console.warn('Failed to load analysis history:', res.status, err);
        list.innerHTML = `<div class="muted">Unable to load your analysis history: ${err.error || res.status}</div>`;
        return;
      }
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load analysis history");
      }

      const rows = data.history || data;

      if (!rows || rows.length === 0) {
        list.innerHTML = `<div class="muted">You haven't analyzed any content yet. Start by analyzing some news!</div>`;
        return;
      }

      console.log(`Analysis history loaded:`, rows.length, 'items for user', user.name || user.email);

      list.innerHTML = rows.map(r => {
        const analysis = (typeof r.analysis_data === 'string') ? JSON.parse(r.analysis_data) : (r.analysis_data || {});
        const score = analysis.score ?? r.credibility_score ?? 0;
        const verdict = (analysis.verdict || r.result || 'uncertain').toUpperCase();
        const preview = (r.content || '').slice(0, 140) + ((r.content||'').length>140 ? '…' : '');
        return `<div class="history-item"><div><strong>${verdict}</strong> <span class="muted">(${score}%)</span><div class="muted" style="font-size:12px">${new Date(r.created_at).toLocaleString()}</div></div><div>${escapeHtml(preview)}</div><div class="flex"><button data-id="${r.id}" class="btn alt delBtn">Delete</button></div></div>`;
      }).join('');

      // attach listeners for analysis delete
      list.querySelectorAll('.delBtn').forEach(b=> b.addEventListener('click', async () => {
        const id = b.getAttribute('data-id');
        if (!confirm('Delete this analysis? This will permanently remove it from your account.')) return;
        const res = await fetch(`/api/news/history/${id}`, { method: 'DELETE', headers: authHeaders() });
        if (!res.ok) { alert('Delete failed'); return; }
        await loadHistory();
      }));
    }
  } catch (e) {
    console.error('loadHistory error', e);
    q('historyList').innerHTML = `<div class="muted">Failed to load your history</div>`;
  }
}

q('refreshHistoryBtn').addEventListener('click', loadHistory);
q('clearHistoryBtn').addEventListener('click', async () => {
  // Check if user is logged in
  const token = localStorage.getItem(TOKEN_KEY);
  const user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");

  if (!token || !user.id) {
    alert('Please log in to clear your history.');
    return;
  }

  const historyType = currentHistoryType === 'chat' ? 'chat' : 'analysis';
  if (!confirm(`Clear ALL your ${historyType} history? This will permanently delete all your saved ${historyType} data and cannot be undone.`)) return;

  try {
    if (currentHistoryType === 'chat') {
      const res = await fetch('/api/news/chat/history', { method: 'DELETE', headers: authHeaders() });
      if (!res.ok) { alert('Clear failed'); return; }
    } else {
      // iterate delete for analysis
      const res = await fetch('/api/news/history', { headers: authHeaders() });
      if (!res.ok) {
        alert('Cannot fetch items to clear');
        return;
      }
      const data = await res.json();
      const rows = data.history || data;

      console.log('Clearing', rows.length, `analysis history items for user`, user.name || user.email);

      for (const r of rows) {
        await fetch(`/api/news/history/${r.id}`, { method: 'DELETE', headers: authHeaders() });
      }
    }
    await loadHistory();
  } catch (e) {
    console.error('clear history error', e);
    alert('Clear failed');
  }
});

// --- History type toggle buttons ---
q('showAnalysisHistoryBtn').addEventListener('click', () => {
  currentHistoryType = 'analysis';
  q('showAnalysisHistoryBtn').classList.add('active');
  q('showChatHistoryBtn').classList.remove('active');
  loadHistory();
});

q('showChatHistoryBtn').addEventListener('click', () => {
  currentHistoryType = 'chat';
  q('showChatHistoryBtn').classList.add('active');
  q('showAnalysisHistoryBtn').classList.remove('active');
  loadHistory();
});



// --- Mobile hamburger menu toggle ---
const mobileMenuToggle = q('mobileMenuToggle');
const sidebar = q('app').querySelector('.sidebar');

if (mobileMenuToggle) {
  mobileMenuToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    mobileMenuToggle.classList.toggle('active');
  });
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768) {
    if (!sidebar.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
      sidebar.classList.remove('active');
      mobileMenuToggle.classList.remove('active');
    }
  }
});



// --- Chat functions ---
async function sendChatMessage() {
  const input = q('chatInput');
  const message = input.value.trim();
  if (!message) return;

  const messagesDiv = q('chatMessages');
  const token = localStorage.getItem(TOKEN_KEY);

  // Add user message to UI
  const userMsgDiv = document.createElement('div');
  userMsgDiv.className = 'chat-message user';
  userMsgDiv.innerHTML = `<strong>You:</strong> ${escapeHtml(message)}`;
  messagesDiv.appendChild(userMsgDiv);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  input.value = '';

  try {
    const res = await fetch('/api/news/chat', {
      method: 'POST',
      headers: Object.assign({'Content-Type': 'application/json'}, authHeaders()),
      body: JSON.stringify({ message, session_id: currentSessionId })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Chat failed');
    }

    // Add AI response to UI
    const aiMsgDiv = document.createElement('div');
    aiMsgDiv.className = 'chat-message bot';
    aiMsgDiv.innerHTML = `<strong>COREDEX AI:</strong> ${escapeHtml(data.response)}`;
    messagesDiv.appendChild(aiMsgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Set session ID if not set
    if (!currentSessionId && data.session_id) {
      currentSessionId = data.session_id;
    }

  } catch (e) {
    console.error('Chat error', e);
    const errorMsgDiv = document.createElement('div');
    errorMsgDiv.className = 'chat-message error';
    errorMsgDiv.innerHTML = `<strong>Error:</strong> ${escapeHtml(e.message || 'Failed to send message')}`;
    messagesDiv.appendChild(errorMsgDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
  }
}

async function loadChatHistory() {
  const messagesDiv = q('chatMessages');
  const token = localStorage.getItem(TOKEN_KEY);
  const user = JSON.parse(localStorage.getItem(USER_KEY) || "{}");

  if (!token || !user.id) {
    messagesDiv.innerHTML = '<div class="muted">Please log in to chat with COREDEX AI</div>';
    return;
  }

  messagesDiv.innerHTML = '<div class="muted">Loading chat history...</div>';

  try {
    if (currentSessionId) {
      // Load specific session if currentSessionId is set
      const sessionRes = await fetch(`/api/news/chat/history/${currentSessionId}`, { headers: authHeaders() });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const messages = sessionData.messages || [];

        messagesDiv.innerHTML = '';
        messages.forEach(msg => {
          const msgDiv = document.createElement('div');
          msgDiv.className = `chat-message ${msg.sender}`;
          msgDiv.innerHTML = `<strong>${msg.sender === 'user' ? 'You' : 'COREDEX AI'}:</strong> ${escapeHtml(msg.message)}`;
          messagesDiv.appendChild(msgDiv);
        });
      } else {
        messagesDiv.innerHTML = '<div class="muted">Failed to load the selected chat session.</div>';
      }
    } else {
      // Load the most recent session
      const res = await fetch('/api/news/chat/history', { headers: authHeaders() });
      if (!res.ok) {
        const err = await res.json().catch(()=>({}));
        console.warn('Failed to load chat history:', res.status, err);
        messagesDiv.innerHTML = `<div class="muted">Unable to load chat history: ${err.error || res.status}</div>`;
        return;
      }
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load chat history");
      }

      const sessions = data.history || [];

      if (!sessions || sessions.length === 0) {
        messagesDiv.innerHTML = '<div class="muted">Welcome to COREDEX AI Chat! How can I help you today?</div>';
        return;
      }

      // Load the most recent session
      const latestSession = sessions[0];
      currentSessionId = latestSession.session_id;

      // Load full conversation for this session
      const sessionRes = await fetch(`/api/news/chat/history/${currentSessionId}`, { headers: authHeaders() });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        const messages = sessionData.messages || [];

        messagesDiv.innerHTML = '';
        messages.forEach(msg => {
          const msgDiv = document.createElement('div');
          msgDiv.className = `chat-message ${msg.sender}`;
          msgDiv.innerHTML = `<strong>${msg.sender === 'user' ? 'You' : 'COREDEX AI'}:</strong> ${escapeHtml(msg.message)}`;
          messagesDiv.appendChild(msgDiv);
        });
      } else {
        messagesDiv.innerHTML = '<div class="muted">Welcome to COREDEX AI Chat! How can I help you today?</div>';
      }
    }

  } catch (e) {
    console.error('loadChatHistory error', e);
    messagesDiv.innerHTML = '<div class="muted">Failed to load chat history</div>';
  }
}

// --- Chat event listeners ---
q('sendChatBtn').addEventListener('click', sendChatMessage);
q('chatInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});
q('newChatBtn').addEventListener('click', () => {
  currentSessionId = null;
  q('chatMessages').innerHTML = '<div class="muted">Welcome to COREDEX AI Chat! How can I help you today?</div>';
});
q('clearChatBtn').addEventListener('click', async () => {
  if (!confirm('Clear all chat history? This will permanently delete all your conversations.')) return;
  try {
    const res = await fetch('/api/news/chat/history', { method: 'DELETE', headers: authHeaders() });
    if (!res.ok) { alert('Clear failed'); return; }
    currentSessionId = null;
    q('chatMessages').innerHTML = '<div class="muted">Welcome to COREDEX AI Chat! How can I help you today?</div>';
  } catch (e) {
    console.error('clear chat error', e);
    alert('Clear failed');
  }
});

// --- init: verify auth, sse, load stats and history if logged in ---
(async function init(){
  verifyAuth();
  startSSE();
  // load stats quickly via SSE fallback (if SSE hasn't arrived)
  setTimeout(() => {
    q('statTotalAnalysis').textContent = q('statTotalAnalysis').textContent || '0';
  }, 500);
  // if user logged in then load history
  if (localStorage.getItem(TOKEN_KEY)) {
    await loadHistory();

    // Check URL parameters for section
    const urlParams = new URLSearchParams(window.location.search);
    const section = urlParams.get('section');
    if (section) {
      showSection(section);
    } else {
      // Default to analyze section for regular users
      showSection('analyze');
    }
  }
})();

















