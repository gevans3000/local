// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Connect to SQLite database (creates the file if it doesn't exist)
const dbPath = path.resolve(__dirname, 'chatbot.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
    }
});

// Create Conversations table
db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    `, (err) => {
        if (err) {
            console.error('Error creating conversations table:', err.message);
        } else {
            console.log('Conversations table ready.');
        }
    });
});

module.exports = db;
