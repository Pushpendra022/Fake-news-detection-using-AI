const express = require('express');
const router = express.Router();
const db = require('./database');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'coredex_secret';

// Middleware to verify admin token
function verifyAdmin(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    db.get('SELECT * FROM users WHERE id = ?', [decoded.userId], (err, user) => {
      if (err || !user) return res.status(401).json({ error: 'User not found' });
      if (user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      req.user = user;
      next();
    });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.use(verifyAdmin);

// Get all users for admin panel
router.get('/users', (req, res) => {
  db.all(`
    SELECT
      u.id,
      u.name,
      u.email,
      u.role,
      u.created_at,
      COUNT(a.id) as total_analyses
    FROM users u
    LEFT JOIN analysis_history a ON u.id = a.user_id
    GROUP BY u.id, u.name, u.email, u.role, u.created_at
    ORDER BY u.created_at DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json({ success: true, users: rows });
  });
});

// Delete user
router.delete('/users/:id', (req, res) => {
  const { id } = req.params;
  // Prevent deleting self or other admins
  if (id == req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });

  db.get('SELECT role FROM users WHERE id = ?', [id], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.role === 'admin') return res.status(403).json({ error: 'Cannot delete admin users' });

    // First, delete all analysis history for this user
    db.run('DELETE FROM analysis_history WHERE user_id = ?', [id], function(err1) {
      if (err1) return res.status(500).json({ error: 'Failed to delete user analysis history' });

      // Then delete the user
      db.run('DELETE FROM users WHERE id = ?', [id], function(err2) {
        if (err2) return res.status(500).json({ error: 'Delete failed' });
        res.json({
          success: true,
          message: 'User and all associated analysis data deleted successfully',
          deletedAnalyses: this.changes
        });
      });
    });
  });
});

// Get analytics data
router.get('/analytics', (req, res) => {
  db.get("SELECT COUNT(*) AS totalUsers FROM users", [], (err, u) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    db.get("SELECT COUNT(*) AS totalAnalysis FROM analysis_history", [], (err2, a) => {
      if (err2) return res.status(500).json({ error: 'Database error' });
      
      db.get(`SELECT COUNT(*) AS fakeCount FROM analysis_history WHERE result = 'fake'`, [], (err3, f) => {
        if (err3) return res.status(500).json({ error: 'Database error' });
        
        const total = a?.totalAnalysis || 0;
        const fakePercent = total ? Math.round((f.fakeCount / total) * 100) : 0;
        
        res.json({
          success: true,
          totalUsers: u.totalUsers || 0,
          totalAnalysis: total,
          fakePercentage: fakePercent,
          // Add more analytics as needed
          recentAnalyses: [], // Could add recent analysis data
          userGrowth: [] // Could add user growth data
        });
      });
    });
  });
});

module.exports = router;
