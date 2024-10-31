// database.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const winston = require('winston');

// Setup Winston logger for database operations
const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message }) => {
            return `${timestamp} [${level.toUpperCase()}]: ${message}`;
        })
    ),
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'database.log', level: 'info' }),
        new winston.transports.File({ filename: 'database-error.log', level: 'error' }),
    ],
});

// Initialize SQLite database
const dbPath = path.resolve(__dirname, 'conversations.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        logger.error(`Error opening database: ${err.message}`);
    } else {
        logger.info('Connected to the SQLite database.');

        // Set PRAGMA options for performance and integrity
        db.serialize(() => {
            db.run(`PRAGMA foreign_keys = ON;`, (err) => {
                if (err) {
                    logger.error(`Error setting PRAGMA foreign_keys: ${err.message}`);
                } else {
                    logger.info('PRAGMA foreign_keys set to ON.');
                }
            });
            db.run(`PRAGMA journal_mode = WAL;`, (err) => {
                if (err) {
                    logger.error(`Error setting PRAGMA journal_mode: ${err.message}`);
                } else {
                    logger.info('PRAGMA journal_mode set to WAL.');
                }
            });
            db.run(`PRAGMA synchronous = NORMAL;`, (err) => {
                if (err) {
                    logger.error(`Error setting PRAGMA synchronous: ${err.message}`);
                } else {
                    logger.info('PRAGMA synchronous set to NORMAL.');
                }
            });

            // Create the conversations table if it doesn't exist
            db.run(`
                CREATE TABLE IF NOT EXISTS conversations (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    chatBoxNumber INTEGER NOT NULL,
                    modelName TEXT NOT NULL DEFAULT 'Human',
                    user TEXT NOT NULL,
                    message TEXT NOT NULL,
                    timestamp TEXT NOT NULL,
                    tokens INTEGER
                )
            `, (err) => {
                if (err) {
                    logger.error(`Error creating conversations table: ${err.message}`);
                } else {
                    logger.info('Conversations table is ready.');
                }
            });
        });
    }
});

/**
 * Closes the database connection gracefully.
 */
function closeDatabase() {
    db.close((err) => {
        if (err) {
            logger.error(`Error closing database: ${err.message}`);
        } else {
            logger.info('Database connection closed.');
        }
    });
}

// Handle process exit to close the database connection gracefully
process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});

module.exports = db;
