// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'conversations.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        // Set busy timeout to prevent SQLITE_BUSY errors
        db.run('PRAGMA busy_timeout = 3000;', (err) => {
            if (err) {
                console.error('Error setting busy_timeout:', err.message);
            } else {
                console.log('Busy timeout set to 3000 ms.');
            }
        });
        // Initialize the database after setting busy_timeout
        initializeDatabase();
    }
});

// Function to check if a column exists in a table
function columnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName})`, [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const exists = rows.some(row => row.name === columnName);
                resolve(exists);
            }
        });
    });
}

// Initialize the database
async function initializeDatabase() {
    try {
        // Check if conversations table exists
        db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='conversations'", async (err, row) => {
            if (err) {
                console.error('Error checking conversations table:', err.message);
            } else if (!row) {
                // Table does not exist, create it with correct schema including modelName
                db.run(`
                    CREATE TABLE conversations (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        chatBoxNumber INTEGER,
                        modelName TEXT NOT NULL DEFAULT 'Human',
                        user TEXT,
                        message TEXT,
                        timestamp TEXT,
                        tokens INTEGER
                    )
                `, (err) => {
                    if (err) {
                        console.error('Error creating conversations table:', err.message);
                    } else {
                        console.log('Conversations table created with chatBoxNumber and modelName columns.');
                        addIndexes();
                    }
                });
            } else {
                // Table exists, check for modelName column
                const hasModelName = await columnExists('conversations', 'modelName');
                if (!hasModelName) {
                    // Add modelName column with NOT NULL and default 'Human'
                    db.run(`ALTER TABLE conversations ADD COLUMN modelName TEXT NOT NULL DEFAULT 'Human'`, async (err) => {
                        if (err) {
                            console.error('Error adding modelName column:', err.message);
                        } else {
                            console.log('modelName column added to conversations table with default "Human".');
                            await migrateData();
                            addIndexes();
                        }
                    });
                } else {
                    console.log('Conversations table already has modelName column.');
                    await migrateData();
                    addIndexes();
                }
            }
        });
    } catch (error) {
        console.error('Error initializing database:', error.message);
    }
}

// Function to migrate existing data to correct schema
async function migrateData() {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Update modelName to 'Human' for user messages where modelName is NULL
            db.run(`
                UPDATE conversations
                SET modelName = 'Human'
                WHERE user LIKE 'You%' AND (modelName IS NULL OR modelName = '')
            `, function(err) {
                if (err) {
                    console.error('Error updating modelName for user messages:', err.message);
                    return reject(err);
                } else {
                    console.log(`modelName updated to 'Human' for ${this.changes} user messages.`);
                    resolve();
                }
            });
        });
    });
}

// Function to add indexes for performance optimization
function addIndexes() {
    // Add index on chatBoxNumber
    db.run(`CREATE INDEX IF NOT EXISTS idx_chatBoxNumber ON conversations(chatBoxNumber)`, (err) => {
        if (err) {
            console.error('Error creating index on chatBoxNumber:', err.message);
        } else {
            console.log('Index on chatBoxNumber created or already exists.');
        }
    });

    // Add index on modelName
    db.run(`CREATE INDEX IF NOT EXISTS idx_modelName ON conversations(modelName)`, (err) => {
        if (err) {
            console.error('Error creating index on modelName:', err.message);
        } else {
            console.log('Index on modelName created or already exists.');
        }
    });
}

module.exports = db;
