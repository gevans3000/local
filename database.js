// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'conversations.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Set busy timeout to prevent SQLITE_BUSY errors
db.configure('busyTimeout', 3000);

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
                        modelName TEXT,
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
                        // Optionally, insert initial data or handle as needed
                    }
                });
            } else {
                // Table exists, check for modelName column
                const hasModelName = await columnExists('conversations', 'modelName');
                if (!hasModelName) {
                    // Add modelName column
                    db.run(`ALTER TABLE conversations ADD COLUMN modelName TEXT`, (err) => {
                        if (err) {
                            console.error('Error adding modelName column:', err.message);
                        } else {
                            console.log('modelName column added to conversations table.');
                            migrateData();
                        }
                    });
                } else {
                    console.log('Conversations table already has modelName column.');
                    migrateData();
                }
            }
        });
    } catch (error) {
        console.error('Error initializing database:', error.message);
    }
}

// Function to migrate existing data to correct schema
function migrateData() {
    // Update AI messages: Move current chatBoxNumber to modelName and set chatBoxNumber as INTEGER
    db.all(`SELECT id, chatBoxNumber, user FROM conversations`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching conversations for migration:', err.message);
            return;
        }

        rows.forEach(row => {
            if (row.user !== 'You') {
                // AI message: chatBoxNumber currently holds modelName
                let newChatBoxNumber = null;
                let modelName = row.chatBoxNumber;

                // Map modelName to chatBoxNumber
                switch(modelName) {
                    case 'gpt-4o-mini':
                        newChatBoxNumber = 2;
                        break;
                    case 'nvidia/llama-3.1-nemotron-70b-instruct':
                        newChatBoxNumber = 3;
                        break;
                    case 'meta/llama-3.2-3b-instruct':
                        newChatBoxNumber = 4;
                        break;
                    default:
                        console.warn(`Unrecognized modelName "${modelName}" for conversation ID ${row.id}. Setting chatBoxNumber to NULL.`);
                        newChatBoxNumber = null;
                }

                // Update the row with newChatBoxNumber and modelName
                db.run(`
                    UPDATE conversations
                    SET chatBoxNumber = ?, modelName = ?
                    WHERE id = ?
                `, [newChatBoxNumber, modelName, row.id], (err) => {
                    if (err) {
                        console.error(`Error updating conversation ID ${row.id}:`, err.message);
                    } else {
                        console.log(`Conversation ID ${row.id} updated with chatBoxNumber=${newChatBoxNumber} and modelName='${modelName}'.`);
                    }
                });
            } else {
                // User message: Assign to chatBoxNumber 1 if not already set
                if (row.chatBoxNumber !== 1) {
                    db.run(`
                        UPDATE conversations
                        SET chatBoxNumber = 1
                        WHERE id = ?
                    `, [row.id], (err) => {
                        if (err) {
                            console.error(`Error updating user conversation ID ${row.id}:`, err.message);
                        } else {
                            console.log(`User Conversation ID ${row.id} assigned to chatBoxNumber=1.`);
                        }
                    });
                }
            }
        });
    });
}

// Run the initialization
initializeDatabase();

module.exports = db;
