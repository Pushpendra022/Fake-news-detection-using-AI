// auth.js - Enhanced with admin routes and session management
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { db } = require('./database');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'coredex_secret_key_2024_enhanced';
const TOKEN_EXPIRES = '7d';

// Generate secure session token
function generateSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || req.query.token;
  if (!authHeader) return res.status(401).json({ success: false, error: 'Missing token' });

  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.userId, email: payload.email, role: payload.role, name: payload.name };
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }
}

// Admin middleware
function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Admin access required' });
  }
  next();
}

router.post('/register', (req, res) => {
  const { name, email, password } = req.body || {};

  if (!name || !email || !password)
    return res.status(400).json({ success: false, error: 'All fields required' });

  const hashed = bcrypt.hashSync(password, 10);

  db.run(
    `INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`,
    [name.trim(), email.toLowerCase().trim(), hashed, 'user'],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          return res.status(400).json({ success: false, error: 'Email already exists' });
        }
        return res.status(500).json({ success: false, error: 'DB Error' });
      }

      const user = {
        id: this.lastID,
        name,
        email: email.toLowerCase(),
        role: 'user'
      };

      const token = createToken(user);

      // Create session
      const sessionToken = generateSessionToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      db.run(
        'INSERT INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
        [this.lastID, sessionToken, expiresAt.toISOString()],
        (sessionErr) => {
          if (sessionErr) console.error('Session creation error:', sessionErr);
        }
      );

      return res.json({ success: true, token, user });
    }
  );
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};

  if (!email || !password)
    return res.status(400).json({ success: false, error: 'All fields required' });

  db.get(`SELECT * FROM users WHERE email = ?`, [email.toLowerCase()], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });

    if (!user) return res.status(400).json({ success: false, error: 'Invalid credentials' });

    const valid = bcrypt.compareSync(password, user.password);

    if (!valid) return res.status(400).json({ success: false, error: 'Invalid credentials' });

    const userData = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    const token = createToken(userData);

    // Create/update session
    const sessionToken = generateSessionToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    db.run(
      'INSERT OR REPLACE INTO user_sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
      [user.id, sessionToken, expiresAt.toISOString()],
      (sessionErr) => {
        if (sessionErr) console.error('Session creation error:', sessionErr);
      }
    );

    res.json({ success: true, token, user: userData });
  });
});

router.post('/logout', authenticateToken, (req, res) => {
  // Remove session
  db.run('DELETE FROM user_sessions WHERE user_id = ?', [req.user.id], (err) => {
    if (err) console.error('Session removal error:', err);
  });

  res.json({ success: true, message: 'Logged out successfully' });
});

router.get('/verify', authenticateToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Profile routes
router.get('/profile', authenticateToken, (req, res) => {
  db.get('SELECT id, name, email, role, created_at, last_login FROM users WHERE id = ?', [req.user.id], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    res.json({ success: true, user });
  });
});

router.put('/profile', authenticateToken, (req, res) => {
  const { name, email } = req.body || {};

  if (!name || !email)
    return res.status(400).json({ success: false, error: 'Name and email required' });

  // Check if email is taken by another user
  db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase(), req.user.id], (err, existing) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });
    if (existing) return res.status(400).json({ success: false, error: 'Email already taken' });

    db.run('UPDATE users SET name = ?, email = ? WHERE id = ?', [name.trim(), email.toLowerCase(), req.user.id], function(err) {
      if (err) return res.status(500).json({ success: false, error: 'DB Error' });

      res.json({ success: true, message: 'Profile updated', user: { id: req.user.id, name: name.trim(), email: email.toLowerCase(), role: req.user.role } });
    });
  });
});

router.put('/change-password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};

  if (!currentPassword || !newPassword)
    return res.status(400).json({ success: false, error: 'Both passwords required' });

  if (newPassword.length < 6)
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });

  db.get('SELECT password FROM users WHERE id = ?', [req.user.id], async (err, user) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ success: false, error: 'Current password incorrect' });

    const hashed = await bcrypt.hash(newPassword, 10);
    db.run('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user.id], function(err) {
      if (err) return res.status(500).json({ success: false, error: 'DB Error' });

      res.json({ success: true, message: 'Password changed successfully' });
    });
  });
});

// Admin routes
router.get('/admin/users', authenticateToken, requireAdmin, (req, res) => {
  db.all(`
    SELECT u.id, u.name, u.email, u.role, u.created_at, u.last_login,
           COUNT(a.id) as analysis_count
    FROM users u
    LEFT JOIN analysis_history a ON u.id = a.user_id
    GROUP BY u.id, u.name, u.email, u.role, u.created_at, u.last_login
    ORDER BY u.created_at DESC
  `, [], (err, users) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });

    res.json({ success: true, users: users || [] });
  });
});

router.put('/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const { name, email, role } = req.body || {};
  const userId = parseInt(req.params.id);

  if (!name || !email || !role)
    return res.status(400).json({ success: false, error: 'Name, email, and role required' });

  if (!['user', 'admin'].includes(role))
    return res.status(400).json({ success: false, error: 'Invalid role' });

  // Check if email is taken by another user
  db.get('SELECT id FROM users WHERE email = ? AND id != ?', [email.toLowerCase(), userId], (err, existing) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });
    if (existing) return res.status(400).json({ success: false, error: 'Email already taken' });

    db.run('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?', [name.trim(), email.toLowerCase(), role, userId], function(err) {
      if (err) return res.status(500).json({ success: false, error: 'DB Error' });
      if (this.changes === 0) return res.status(404).json({ success: false, error: 'User not found' });

      res.json({ success: true, message: 'User updated successfully' });
    });
  });
});

router.delete('/admin/users/:id', authenticateToken, requireAdmin, (req, res) => {
  const userId = parseInt(req.params.id);

  // Prevent deleting admin users
  db.get('SELECT role FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) return res.status(500).json({ success: false, error: 'DB Error' });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });
    if (user.role === 'admin') return res.status(400).json({ success: false, error: 'Cannot delete admin users' });

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) return res.status(500).json({ success: false, error: 'DB Error' });

      res.json({ success: true, message: 'User deleted successfully' });
    });
  });
});

module.exports = { router, authenticateToken, requireAdmin };
