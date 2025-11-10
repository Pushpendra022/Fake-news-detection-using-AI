console.log("✅ Dashboard JS Loaded (USER ISOLATION ENABLED)");

/* ────────────────────────────────
    LIVE STATS (SSE)
──────────────────────────────── */
const totalUsersBox = document.getElementById("totalUsers");
const totalAnalysisBox = document.getElementById("totalAnalysis");
const fakePercentBox = document.getElementById("fakePercent");
const liveStatus = document.getElementById("liveStatus");

function connectLiveStats() {
  const events = new EventSource("/api/stream/stats");

  events.onopen = () => {
    liveStatus.innerText = "Connected";
    liveStatus.style.color = "green";
  };

  events.onerror = () => {
    liveStatus.innerText = "Disconnected";
    liveStatus.style.color = "red";
  };

  events.onmessage = (event) => {
    const data = JSON.parse(event.data);

    totalUsersBox.innerText = data.totalUsers ?? 0;
    totalAnalysisBox.innerText = data.totalAnalysis ?? 0;
    fakePercentBox.innerText = (data.fakePercentage ?? 0) + "%";
  };
}

connectLiveStats();

/* ────────────────────────────────
   MAIN DASHBOARD CLASS
──────────────────────────────── */
class Dashboard {
  constructor() {
    // Use consistent token key
    this.token = localStorage.getItem("app_token");
    this.user = JSON.parse(localStorage.getItem("app_user") || "{}");

    this.resultsContainer = document.getElementById("resultsContainer");
    this.historyContainer = document.getElementById("historyContainer");

    this.analyzeBtn = document.getElementById("analyzeBtn");
    this.refreshHistoryBtn = document.getElementById("refreshHistory");

    this.bindEvents();
    this.checkAuth();
    this.loadUserHistory();
  }

  checkAuth() {
    if (!this.token || !this.user.id) {
      // Redirect to login if not authenticated
      alert("Please log in to access your dashboard.");
      window.location.href = "/";
      return;
    }

    // Update welcome message
    const welcomeElement = document.getElementById("welcomeMessage");
    if (welcomeElement) {
      welcomeElement.textContent = `Welcome back, ${this.user.name || this.user.email}!`;
    }
  }

  /* ─────────────── ANALYZE ─────────────── */
  bindEvents() {
    this.analyzeBtn?.addEventListener("click", () => this.analyzeContent());
    this.refreshHistoryBtn?.addEventListener("click", () => this.loadUserHistory());
  }

  async analyzeContent() {
    const content = document.getElementById("inputText")?.value.trim();

    if (!content) {
      return alert("Enter some text to analyze.");
    }

    if (!this.token) {
      return alert("Please log in to analyze content.");
    }

    this.analyzeBtn.innerHTML = "Analyzing...";
    this.analyzeBtn.disabled = true;

    try {
      const res = await fetch("/api/news/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.token}`
        },
        body: JSON.stringify({ content })
      });

      const data = await res.json();

      if (!data.success) throw new Error(data.error);

      this.displayResults(data.analysis);
      this.loadUserHistory();

    } catch (err) {
      console.error("Analysis Error:", err);
      alert("Analysis failed: " + err.message);
    }

    this.analyzeBtn.innerHTML = "Analyze";
    this.analyzeBtn.disabled = false;
  }

  /* ─────────────── DISPLAY RESULTS ─────────────── */
  displayResults(a) {
    const verdict = a.verdict ?? "uncertain";
    const score = a.score ?? 50;

    this.resultsContainer.innerHTML = `
      <div class="result-card">
        <h2>${verdict.toUpperCase()} (${score}%)</h2>
        <p><b>Summary:</b> ${a.summary || "No summary."}</p>

        <h4>Reasons:</h4>
        <ul>
          ${(a.reasons || []).map(r => `<li>${r}</li>`).join("")}
        </ul>
        <small style="color: #666;">Analysis saved to your personal history</small>
      </div>
    `;
  }

  /* ─────────────── USER-SPECIFIC HISTORY ─────────────── */
  async loadUserHistory() {
    if (!this.token) {
      this.historyContainer.innerHTML = "<p>Please log in to view your analysis history.</p>";
      return;
    }

    this.historyContainer.innerHTML = `<p>Loading your analysis history...</p>`;

    try {
      const res = await fetch("/api/news/history", {
        headers: {
          "Authorization": `Bearer ${this.token}`
        }
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to load history");
      }

      const list = data.history || data;

      if (!Array.isArray(list)) {
        this.historyContainer.innerHTML = "<p>No history found.</p>";
        return;
      }

      if (list.length === 0) {
        this.historyContainer.innerHTML = "<p>You haven't analyzed any content yet. Try analyzing some news above!</p>";
        return;
      }

      this.historyContainer.innerHTML = `
        <h3>Your Analysis History (${list.length} items)</h3>
        ${list.map(item => {
          let a = {};
          try { a = JSON.parse(item.analysis_data); } catch {}

          return `
            <div class="history-item">
              <h4>${(a.verdict || "UNKNOWN").toUpperCase()} (${a.score ?? 0}%)</h4>
              <p>${(item.content || "").slice(0, 120)}...</p>
              <small>${new Date(item.created_at).toLocaleString()}</small>
            </div>
          `;
        }).join("")}
      `;

    } catch (err) {
      console.error("History error:", err);
      this.historyContainer.innerHTML = "<p>Error loading your history. Please try again.</p>";
    }
  }
}

document.addEventListener("DOMContentLoaded", () => new Dashboard());
