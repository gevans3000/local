// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Initialize SQLite database
const dbPath = path.resolve(__dirname, 'conversations.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');

        // Set PRAGMA options for performance and integrity
        db.serialize(() => {
            db.run(`PRAGMA foreign_keys = ON;`, (err) => {
                if (err) {
                    console.error(`Error setting PRAGMA foreign_keys: ${err.message}`);
                } else {
                    console.log('PRAGMA foreign_keys set to ON.');
                }
            });
            db.run(`PRAGMA journal_mode = WAL;`, (err) => {
                if (err) {
                    console.error(`Error setting PRAGMA journal_mode: ${err.message}`);
                } else {
                    console.log('PRAGMA journal_mode set to WAL.');
                }
            });
            db.run(`PRAGMA synchronous = NORMAL;`, (err) => {
                if (err) {
                    console.error(`Error setting PRAGMA synchronous: ${err.message}`);
                } else {
                    console.log('PRAGMA synchronous set to NORMAL.');
                }
            });

            // Create the conversations table if it doesn't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS conversations (
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
                    console.log('Conversations table is ready.');
                }
            });
        });
    }
});

module.exports = db;
