// public/js/analyze-client.js

async function runAnalysis() {
    const input = document.getElementById("analysisContent");
    const output = document.getElementById("analysisResult");
    const btn = document.getElementById("analyzeBtn");

    if (!input) return alert("Error: analysisContent input missing on page.");
    if (!output) return alert("Error: analysisResult output div missing.");
    if (!btn) return alert("Error: analyzeBtn button missing.");

    const content = input.value.trim();
    if (!content) {
        alert("Please enter text to analyze.");
        return;
    }

    // Check authentication
    const token = localStorage.getItem('app_token');
    const user = JSON.parse(localStorage.getItem('app_user') || '{}');

    if (!token || !user.id) {
        alert("Please log in to analyze content.");
        window.location.href = '/';
        return;
    }

    btn.disabled = true;
    btn.textContent = "Analyzing...";

    try {
        const headers = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch("/api/news/analyze", {
            method: "POST",
            headers: headers,
            body: JSON.stringify({ content })
        });

        const data = await res.json();

        if (!data.success) {
            output.innerHTML = `<p style="color:red;">Error: ${data.error || "Unknown error"}</p>`;
            return;
        }

        const a = data.analysis;

        output.innerHTML = `
            <h2>Analysis Result</h2>
            <p><b>Verdict:</b> ${a.verdict}</p>
            <p><b>Score:</b> ${a.score}</p>
            <p><b>Confidence:</b> ${a.confidence}</p>
            <p><b>Summary:</b> ${a.summary}</p>
            <p><b>Reasons:</b> ${(a.reasons || []).join(", ")}</p>
            <p><b>Source:</b> ${data.source}</p>
            <small style="color: #666;">This analysis has been saved to your personal account.</small>
        `;

    } catch (err) {
        console.error("Analyze error:", err);
        output.innerHTML = `<p style="color:red;">Analysis error. Check console.</p>`;
    } finally {
        btn.disabled = false;
        btn.textContent = "Analyze";
    }
}
