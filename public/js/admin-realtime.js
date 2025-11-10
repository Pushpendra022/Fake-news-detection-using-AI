function startAdminStatsStream() {
    console.log("Starting admin real-time stream...");

    const stream = new EventSource("/api/stream/admin-stats");

    stream.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // Update stats cards
        document.getElementById("totalUsers").textContent = data.total_users;
        document.getElementById("totalAnalysis").textContent = data.total_analysis;
        document.getElementById("fakeNewsPercentage").textContent = data.fake_percentage + '%';
        document.getElementById("todayAnalysis").textContent = data.today_analysis;

        // Update charts if they exist
        if (window.updateCharts) {
            window.updateCharts(data);
        }

        // Update live badge
        const liveBadge = document.getElementById("liveBadge");
        if (liveBadge) {
            liveBadge.textContent = "Connected";
            liveBadge.style.color = "var(--success)";
        }
    };

    stream.onerror = (err) => {
        console.log("Admin stream error:", err);
        const liveBadge = document.getElementById("liveBadge");
        if (liveBadge) {
            liveBadge.textContent = "Disconnected";
            liveBadge.style.color = "var(--danger)";
        }
    };

    // Store stream reference for cleanup
    window.adminStatsStream = stream;
}

document.addEventListener("DOMContentLoaded", startAdminStatsStream);
