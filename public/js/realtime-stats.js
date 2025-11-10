function startStatsStream() {
    console.log("Starting real-time stream...");

    const stream = new EventSource("/api/stream/stats");

    stream.onmessage = (event) => {
        const data = JSON.parse(event.data);

        document.getElementById("totalUsers").textContent = data.totalUsers;
        document.getElementById("totalAnalysis").textContent = data.totalAnalysis;

        // Calculate fake % locally if backend provides totalAnalysis & fake count later
        if (data.fakePercentage) {
            document.getElementById("fakePercentage").textContent = data.fakePercentage + "%";
        }
    };

    stream.onerror = (err) => {
        console.log("Stream error:", err);
    };
}

document.addEventListener("DOMContentLoaded", startStatsStream);
