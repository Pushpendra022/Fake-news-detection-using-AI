console.log("✅ History JS Loaded (USER ISOLATION ENABLED)");

async function loadHistory() {
  const list = document.getElementById("historyList");
  const token = localStorage.getItem("app_token");
  const user = JSON.parse(localStorage.getItem("app_user") || "{}");

  if (!token || !user.id) {
    list.innerHTML = "<p>Please log in to view your analysis history.</p>";
    return;
  }

  list.innerHTML = "Loading your personal history...";

  try {
    const res = await fetch("/api/news/history", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    const data = await res.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to load history");
    }

    const history = data.history || data;

    if (!Array.isArray(history) || history.length === 0) {
      list.innerHTML = "<p>You haven't analyzed any content yet. Start by analyzing some news!</p>";
      return;
    }

    list.innerHTML = `<h3>Your Analysis History (${history.length} items)</h3>`;

    history.forEach(item => {
      let analysis = {};
      try { analysis = JSON.parse(item.analysis_data); } catch {}

      const div = document.createElement("div");
      div.className = "history-item";

      div.innerHTML = `
        <h4>${(analysis.verdict || "UNKNOWN").toUpperCase()} (${analysis.score ?? 0}%)</h4>
        <p><strong>Content:</strong> ${item.content?.slice(0, 100)}...</p>
        <p><strong>Summary:</strong> ${analysis.summary || "No summary"}</p>
        <small>Analyzed on ${new Date(item.created_at).toLocaleString()}</small>
        <hr>
      `;

      list.appendChild(div);
    });

  } catch (err) {
    console.error("History load error:", err);
    list.innerHTML = "<p>Error loading your history. Please try again.</p>";
  }
}

// Load history on page load
document.addEventListener("DOMContentLoaded", loadHistory);
