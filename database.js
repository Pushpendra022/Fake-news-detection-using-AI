// backend/database.js - ENHANCED VERSION
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'coredex.db');

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME,
        is_active BOOLEAN DEFAULT 1
    )`, (err) => {
        if (err) {
            console.error('Error creating users table:', err);
        } else {
            console.log('✅ Users table ready');
            
            // Create default admin user if doesn't exist
            createDefaultAdmin();
        }
    });

    // Analysis history table
    db.run(`CREATE TABLE IF NOT EXISTS analysis_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        content TEXT NOT NULL,
        content_type TEXT DEFAULT 'text',
        analysis_data TEXT,
        credibility_score INTEGER,
        result TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating analysis_history table:', err);
        } else {
            console.log('✅ Analysis history table ready');
        }
    });

    // Chat history table
    db.run(`CREATE TABLE IF NOT EXISTS chat_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        session_id TEXT,
        user_message TEXT NOT NULL,
        ai_response TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating chat_history table:', err);
        } else {
            console.log('✅ Chat history table ready');
            // Add session_id column if it doesn't exist (for existing databases)
            db.run(`ALTER TABLE chat_history ADD COLUMN session_id TEXT`, (alterErr) => {
                if (alterErr && !alterErr.message.includes('duplicate column name')) {
                    console.warn('Could not add session_id column:', alterErr.message);
                }
            });
        }
    });

    // User sessions table for better session management
    db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('Error creating user_sessions table:', err);
        } else {
            console.log('✅ User sessions table ready');
        }
    });

    // System settings table
    db.run(`CREATE TABLE IF NOT EXISTS system_settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        setting_key TEXT UNIQUE NOT NULL,
        setting_value TEXT,
        description TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating system_settings table:', err);
        } else {
            console.log('✅ System settings table ready');
            initializeDefaultSettings();
        }
    });

    // API logs table for monitoring
    db.run(`CREATE TABLE IF NOT EXISTS api_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        endpoint TEXT NOT NULL,
        method TEXT NOT NULL,
        user_id INTEGER,
        status_code INTEGER,
        response_time INTEGER,
        user_agent TEXT,
        ip_address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
    )`, (err) => {
        if (err) {
            console.error('Error creating api_logs table:', err);
        } else {
            console.log('✅ API logs table ready');
        }
    });

    // Create indexes for better performance
    db.run(`CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis_history(user_id)`, (err) => {
        if (err) console.error('Error creating index:', err);
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_history(created_at)`, (err) => {
        if (err) console.error('Error creating index:', err);
    });
    
    db.run(`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`, (err) => {
        if (err) console.error('Error creating index:', err);
    });
}

// Create default admin user
function createDefaultAdmin() {
    const bcrypt = require('bcryptjs');
    const defaultAdmin = {
        name: 'System Administrator',
        email: 'admin@coredex.ai',
        password: bcrypt.hashSync('admin123', 12),
        role: 'admin'
    };

    // Check if admin already exists
    db.get('SELECT id FROM users WHERE email = ?', [defaultAdmin.email], (err, row) => {
        if (err) {
            console.error('Error checking admin user:', err);
            return;
        }

        if (!row) {
            db.run(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [defaultAdmin.name, defaultAdmin.email, defaultAdmin.password, defaultAdmin.role],
                function(err) {
                    if (err) {
                        console.error('Error creating default admin:', err);
                    } else {
                        console.log('✅ Default admin user created');
                        console.log('📧 Email: admin@coredex.ai');
                        console.log('🔑 Password: admin123');
                        console.log('⚠️  Please change the default password immediately!');
                    }
                }
            );
        }
    });
}

// Initialize default system settings
function initializeDefaultSettings() {
    const defaultSettings = [
        {
            key: 'system_name',
            value: 'COREDEX AI News Analyzer',
            description: 'Name of the application'
        },
        {
            key: 'max_analysis_length',
            value: '10000',
            description: 'Maximum character length for analysis'
        },
        {
            key: 'analysis_timeout',
            value: '30000',
            description: 'Timeout for analysis requests in milliseconds'
        },
        {
            key: 'allow_registration',
            value: 'true',
            description: 'Whether new user registration is allowed'
        },
        {
            key: 'maintenance_mode',
            value: 'false',
            description: 'System maintenance mode'
        },
        {
            key: 'version',
            value: '2.0.0',
            description: 'System version'
        }
    ];

    defaultSettings.forEach(setting => {
        db.run(
            `INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) 
             VALUES (?, ?, ?)`,
            [setting.key, setting.value, setting.description],
            (err) => {
                if (err) {
                    console.error('Error inserting default setting:', err);
                }
            }
        );
    });
}

// Database utility functions
const dbUtils = {
    // Get system setting
    getSetting: (key) => {
        return new Promise((resolve, reject) => {
            db.get(
                'SELECT setting_value FROM system_settings WHERE setting_key = ?',
                [key],
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.setting_value : null);
                }
            );
        });
    },

    // Update system setting
    updateSetting: (key, value) => {
        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE system_settings SET setting_value = ?, updated_at = CURRENT_TIMESTAMP 
                 WHERE setting_key = ?`,
                [value, key],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    },

    // Log API request
    logApiRequest: (endpoint, method, userId, statusCode, responseTime, userAgent, ipAddress) => {
        db.run(
            `INSERT INTO api_logs (endpoint, method, user_id, status_code, response_time, user_agent, ip_address) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [endpoint, method, userId, statusCode, responseTime, userAgent, ipAddress],
            (err) => {
                if (err) {
                    console.error('Error logging API request:', err);
                }
            }
        );
    },

    // Get database statistics
    getDatabaseStats: () => {
        return new Promise((resolve, reject) => {
            const stats = {};
            let completed = 0;
            const totalQueries = 4;

            const queries = {
                users: 'SELECT COUNT(*) as count FROM users',
                analysis: 'SELECT COUNT(*) as count FROM analysis_history',
                settings: 'SELECT COUNT(*) as count FROM system_settings',
                logs: 'SELECT COUNT(*) as count FROM api_logs'
            };

            Object.keys(queries).forEach(key => {
                db.get(queries[key], [], (err, row) => {
                    if (err) {
                        console.error(`Error getting ${key} count:`, err);
                        stats[key] = 0;
                    } else {
                        stats[key] = row.count;
                    }

                    completed++;
                    if (completed === totalQueries) {
                        resolve(stats);
                    }
                });
            });
        });
    },

    // Backup database (simplified version)
    backupDatabase: (backupPath) => {
        return new Promise((resolve, reject) => {
            const backupDB = new sqlite3.Database(backupPath);
            
            db.backup(backupDB, {
                progress: (status) => {
                    console.log(`Backup progress: ${status.remaining} pages remaining`);
                }
            }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    backupDB.close();
                    resolve();
                }
            });
        });
    },

    // Optimize database
    optimizeDatabase: () => {
        return new Promise((resolve, reject) => {
            db.run('VACUUM', (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    },

    // Clean old data
    cleanOldData: (days = 30) => {
        return new Promise((resolve, reject) => {
            db.run(
                'DELETE FROM analysis_history WHERE created_at < datetime("now", ?)',
                [`-${days} days`],
                function(err) {
                    if (err) reject(err);
                    else resolve(this.changes);
                }
            );
        });
    }
};

// Error handling
db.on('error', (err) => {
    console.error('Database error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('Error closing database:', err);
            process.exit(1);
        } else {
            console.log('✅ Database connection closed');
            process.exit(0);
        }
    });
});

module.exports = {
    db,
    ...dbUtils
};