require("dotenv").config();
const express = require("express");
const session = require("express-session");
const path = require("path");
const { db } = require("./database");
const authModule = require("./auth");
const newsAnalysis = require("./news-analysis");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));

app.use(
  session({
    secret: process.env.SESSION_SECRET || "session_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// ✅ Your existing APIs
app.use("/api/auth", authModule.router);
app.use("/api/news", newsAnalysis);

// ✅ NEW: Mounts all bubble-chat + analyze + login/register from routes.js
app.use("/api", require("./routes"));

/* ----------------------------------------------
   ✅ ADMIN ANALYTICS
-------------------------------------------------*/
app.get(
  "/api/news/admin/analytics",
  authModule.authenticateToken,
  authModule.requireAdmin,
  (req, res) => {
    db.get("SELECT COUNT(*) AS total_users FROM users", [], (err, users) => {
      db.get(
        "SELECT COUNT(*) AS total_analysis FROM analysis_history",
        [],
        (err2, analysis) => {
          db.get(
            "SELECT COUNT(*) AS fake_count FROM analysis_history WHERE result = 'fake'",
            [],
            (err3, fake) => {
              db.get(
                "SELECT COUNT(*) AS real_count FROM analysis_history WHERE result = 'real'",
                [],
                (err4, real) => {
                  db.get(
                    "SELECT COUNT(*) AS uncertain_count FROM analysis_history WHERE result = 'uncertain'",
                    [],
                    (err5, uncertain) => {
                      db.get(
                        "SELECT COUNT(*) AS today_analysis FROM analysis_history WHERE DATE(created_at) = DATE('now')",
                        [],
                        (err6, today) => {
                          const total = analysis?.total_analysis || 0;
                          const fakeCount = fake?.fake_count || 0;
                          const realCount = real?.real_count || 0;
                          const uncertainCount =
                            uncertain?.uncertain_count || 0;

                          const fake_percentage = total
                            ? Math.round((fakeCount / total) * 100)
                            : 0;
                          const real_percentage = total
                            ? Math.round((realCount / total) * 100)
                            : 0;

                          db.all(
                            `
                SELECT DATE(created_at) as date, COUNT(*) as count
                FROM analysis_history
                WHERE created_at >= date('now', '-30 days')
                GROUP BY DATE(created_at)
                ORDER BY date DESC
              `,
                            [],
                            (err7, activity) => {
                              db.all(
                                `
                  SELECT u.name, COUNT(a.id) as analysis_count
                  FROM users u
                  LEFT JOIN analysis_history a ON u.id = a.user_id
                  GROUP BY u.id, u.name
                  ORDER BY analysis_count DESC
                  LIMIT 10
                `,
                                [],
                                (err8, userStats) => {
                                  res.json({
                                    total_users: users?.total_users || 0,
                                    total_analysis: total,
                                    fake_count: fakeCount,
                                    real_count: realCount,
                                    uncertain_count: uncertainCount,
                                    fake_percentage: fake_percentage,
                                    real_percentage: real_percentage,
                                    today_analysis: today?.today_analysis || 0,
                                    user_activity: activity || [],
                                    user_stats: userStats || [],
                                  });
                                }
                              );
                            }
                          );
                        }
                      );
                    }
                  );
                }
              );
            }
          );
        }
      );
    });
  }
);

/* ----------------------------------------------
   ✅ REAL TIME STATS (Dashboard streaming)
-------------------------------------------------*/
app.get("/api/stream/stats", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.flushHeaders();

  const sendStats = () => {
    db.get("SELECT COUNT(*) AS totalUsers FROM users", [], (err, u) => {
      db.get(
        "SELECT COUNT(*) AS totalAnalysis FROM analysis_history",
        [],
        (err2, a) => {
          db.get(
            `SELECT COUNT(*) AS fakeCount FROM analysis_history WHERE result = 'fake'`,
            [],
            (err3, f) => {
              const total = a?.totalAnalysis || 0;
              const fakePercent = total
                ? Math.round((f.fakeCount / total) * 100)
                : 0;

              res.write(
                `data: ${JSON.stringify({
                  totalUsers: u.totalUsers,
                  totalAnalysis: total,
                  fakePercentage: fakePercent,
                })}\n\n`
              );
            }
          );
        }
      );
    });
  };

  sendStats();
  const interval = setInterval(sendStats, 3000);

  req.on("close", () => {
    clearInterval(interval);
    res.end();
  });
});

/* ----------------------------------------------
   ✅ PAGES
-------------------------------------------------*/
app.get("/", (_, res) =>
  res.sendFile(path.join(__dirname, "public/index.html"))
);
app.get("/dashboard", (_, res) =>
  res.sendFile(path.join(__dirname, "public/dashboard.html"))
);
app.get("/admin", (_, res) =>
  res.sendFile(path.join(__dirname, "public/admin.html"))
);
app.get("/history", (_, res) =>
  res.sendFile(path.join(__dirname, "public/history.html"))
);

/* ----------------------------------------------
   ✅ SERVER START
-------------------------------------------------*/
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("✅ Server running on port " + PORT));
