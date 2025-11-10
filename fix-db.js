// backend/fix-db.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'coredex.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  console.log('🛠️  Starting DB migration: allow NULL user_id in analysis_history');

  db.run(`PRAGMA foreign_keys = OFF;`, (e) => {
    if (e) console.warn('pragma off error', e);
  });

  db.run(`ALTER TABLE analysis_history RENAME TO analysis_history_old;`, (err) => {
    if (err) {
      console.error('Rename failed (table may not exist):', err.message);
      // try to exit gracefully
    }
  });

  db.run(`CREATE TABLE IF NOT EXISTS analysis_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT NULL,
      content TEXT NOT NULL,
      analysis_data TEXT,
      credibility_score INTEGER DEFAULT 0,
      result TEXT DEFAULT 'uncertain',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );`, (err) => {
    if (err) console.error('Create new table error', err);
  });

  db.run(`INSERT INTO analysis_history (user_id, content, analysis_data, credibility_score, result, created_at)
          SELECT user_id, content, analysis_data, credibility_score, result, created_at
          FROM analysis_history_old;`, (err) => {
    if (err) console.warn('Insert from old -> may fail if old table not present:', err.message);
  });

  db.run(`DROP TABLE IF EXISTS analysis_history_old;`, (err) => {
    if (err) console.warn('Drop old table failed:', err.message);
  });

  db.run(`PRAGMA foreign_keys = ON;`, (e) => {
    if (e) console.warn('pragma on error', e);
  });

  console.log('✅ DB migration done (if original table existed).');
});

db.close();
