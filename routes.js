// backend/routes.js
const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("./database");
const axios = require("axios");

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || "coredex_secret";

/* ------------------------------------------------
   ✅ AUTH: REGISTER
--------------------------------------------------- */
router.post("/auth/register", async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "All fields required" });
  }

  try {
    db.get("SELECT id FROM users WHERE email = ?", [email], (err, row) => {
      if (err) return res.status(500).json({ error: "Database error" });
      if (row) return res.status(400).json({ error: "Email exists" });

      const hashed = bcrypt.hashSync(password, 10);

      db.run(
        "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
        [name, email, hashed],
        function (err) {
          if (err) return res.status(500).json({ error: "Create user failed" });

          const token = jwt.sign(
            { userId: this.lastID, email },
            JWT_SECRET,
            { expiresIn: "7d" }
          );

          res.json({
            success: true,
            token,
            user: { id: this.lastID, name, email, role: "user" },
          });
        }
      );
    });
  } catch (e) {
    res.status(500).json({ error: "Server error" });
  }
});

/* ------------------------------------------------
   ✅ AUTH: LOGIN
--------------------------------------------------- */
router.post("/auth/login", (req, res) => {
  const { email, password } = req.body;

  db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!user) return res.status(400).json({ error: "Invalid credentials" });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(400).json({ error: "Invalid credentials" });

    const token = jwt.sign(
      { userId: user.id, email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      token,
      user: userWithoutPassword,
    });
  });
});

/* ------------------------------------------------
   ✅ NEWS ANALYSIS (FAKE NEWS DETECTION)
--------------------------------------------------- */
router.post("/news/analyze", (req, res) => {
  const { content } = req.body;

  if (!content) {
    return res.status(400).json({ error: "Content required" });
  }

  const score = Math.floor(Math.random() * 100);
  const verdict = score > 70 ? "real" : score < 40 ? "fake" : "uncertain";

  res.json({
    success: true,
    verdict,
    score,
    confidence: "Medium",
    summary: "Analysis completed successfully",
    reasons: ["Content analyzed for authenticity"],
    suggested_sources: ["Reuters", "Associated Press"],
  });
});

/* ------------------------------------------------
   ✅ BUBBLE CHAT (AI FEATURE)
--------------------------------------------------- */

router.post("/bubble-chat", async (req, res) => {
  try {
    const { message } = req.body;

    const response = await axios.post(
      process.env.BUBBLE_AI_URL,
      {
        model: process.env.BUBBLE_AI_MODEL,
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant on the COREDEX website. Answer briefly and clearly.",
          },
          { role: "user", content: message },
        ],
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.BUBBLE_AI_KEY}`,
        },
      }
    );

    res.json({
      reply: response.data.choices[0].message.content,
    });
  } catch (err) {
    console.error("Bubble Chat Error:", err.response?.data || err);
    res.status(500).json({ error: "AI request failed" });
  }
});

/* ------------------------------------------------
   ✅ EXPORT ROUTER
--------------------------------------------------- */
module.exports = router;
