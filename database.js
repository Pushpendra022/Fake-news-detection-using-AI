// backend/database.js - UPDATED FOR VERCEL & LOCALHOST
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// ✅ FIX: Use /tmp directory in production (Vercel), local directory in development
const isProduction = process.env.NODE_ENV === 'production';
const dbPath = isProduction 
  ? '/tmp/coredex.db'  // Vercel's writable directory
  : path.join(__dirname, 'coredex.db'); // Local development

console.log(`📁 Database path: ${dbPath}`);
console.log(`🚀 Environment: ${isProduction ? 'Production' : 'Development'}`);

// Ensure database directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
    console.log(`📂 Creating database directory: ${dbDir}`);
    fs.mkdirSync(dbDir, { recursive: true });
}

// Create database connection
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error opening database:', err.message);
        console.error('💡 If running on Vercel, make sure NODE_ENV=production is set');
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Initialize database tables
function initializeDatabase() {
    console.log('🔄 Initializing database tables...');

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
            console.error('❌ Error creating users table:', err);
        } else {
            console.log('✅ Users table ready');
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating analysis_history table:', err);
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
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating chat_history table:', err);
        } else {
            console.log('✅ Chat history table ready');
        }
    });

    // User sessions table
    db.run(`CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        session_token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    )`, (err) => {
        if (err) {
            console.error('❌ Error creating user_sessions table:', err);
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
            console.error('❌ Error creating system_settings table:', err);
        } else {
            console.log('✅ System settings table ready');
            initializeDefaultSettings();
        }
    });

    // API logs table
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
            console.error('❌ Error creating api_logs table:', err);
        } else {
            console.log('✅ API logs table ready');
        }
    });

    // Create indexes for better performance
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_analysis_user_id ON analysis_history(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_analysis_created_at ON analysis_history(created_at)',
        'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
        'CREATE INDEX IF NOT EXISTS idx_chat_user_id ON chat_history(user_id)',
        'CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token)'
    ];

    let indexesCreated = 0;
    indexes.forEach((sql, index) => {
        db.run(sql, (err) => {
            if (err) console.error(`❌ Error creating index ${index + 1}:`, err);
            indexesCreated++;
            if (indexesCreated === indexes.length) {
                console.log('✅ All database indexes created');
            }
        });
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
            console.error('❌ Error checking admin user:', err);
            return;
        }

        if (!row) {
            db.run(
                'INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)',
                [defaultAdmin.name, defaultAdmin.email, defaultAdmin.password, defaultAdmin.role],
                function(err) {
                    if (err) {
                        console.error('❌ Error creating default admin:', err);
                    } else {
                        console.log('✅ Default admin user created');
                        console.log('📧 Email: admin@coredex.ai');
                        console.log('🔑 Password: admin123');
                        console.log('⚠️  Please change the default password in production!');
                    }
                }
            );
        } else {
            console.log('✅ Admin user already exists');
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

    let settingsInserted = 0;
    defaultSettings.forEach(setting => {
        db.run(
            `INSERT OR IGNORE INTO system_settings (setting_key, setting_value, description) 
             VALUES (?, ?, ?)`,
            [setting.key, setting.value, setting.description],
            (err) => {
                if (err) {
                    console.error('❌ Error inserting default setting:', err);
                }
                settingsInserted++;
                if (settingsInserted === defaultSettings.length) {
                    console.log('✅ All default settings initialized');
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
                    console.error('❌ Error logging API request:', err);
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
                        console.error(`❌ Error getting ${key} count:`, err);
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

    // Get database file info
    getDatabaseInfo: () => {
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(dbPath)) {
                resolve({ exists: false, path: dbPath, size: 0 });
                return;
            }

            try {
                const stats = fs.statSync(dbPath);
                resolve({
                    exists: true,
                    path: dbPath,
                    size: stats.size,
                    modified: stats.mtime,
                    environment: isProduction ? 'production' : 'development'
                });
            } catch (err) {
                reject(err);
            }
        });
    },

    // Test database connection
    testConnection: () => {
        return new Promise((resolve, reject) => {
            db.get('SELECT 1 as test', (err, row) => {
                if (err) {
                    reject(err);
                } else {
                    resolve({ success: true, message: 'Database connection successful', test: row.test });
                }
            });
        });
    }
};

// Error handling
db.on('error', (err) => {
    console.error('❌ Database error:', err);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🔄 Closing database connection...');
    db.close((err) => {
        if (err) {
            console.error('❌ Error closing database:', err);
            process.exit(1);
        } else {
            console.log('✅ Database connection closed');
            process.exit(0);
        }
    });
});

// Export both db and utilities
module.exports = {
    db,
    dbPath, // Export the path for debugging
    ...dbUtils
};
