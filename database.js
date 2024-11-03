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

            // Create index on chatBoxNumber for faster queries
            db.run(`
                CREATE INDEX IF NOT EXISTS idx_chatBoxNumber ON conversations(chatBoxNumber)
            `, (err) => {
                if (err) {
                    logger.error(`Error creating index on chatBoxNumber: ${err.message}`);
                } else {
                    logger.info('Index on chatBoxNumber is ready.');
                }
            });
        });
    }
});

// In-memory cache for getMessages
const messageCache = new Map();

/**
 * Generates a cache key based on chatBoxNumbers
 * @param {number[]} chatBoxNumbers 
 * @returns {string}
 */
function generateCacheKey(chatBoxNumbers) {
    return chatBoxNumbers.slice().sort((a, b) => a - b).join(',');
}

/**
 * Adds a message to the database and invalidates relevant cache entries
 * @param {number} chatBoxNumber 
 * @param {string} user 
 * @param {string} message 
 * @param {string} timestamp 
 * @param {number} tokens 
 * @param {string} modelName 
 * @returns {Promise<number>}
 */
function addMessage(chatBoxNumber, user, message, timestamp, tokens, modelName) {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO conversations (chatBoxNumber, user, message, timestamp, tokens, modelName)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        stmt.run([chatBoxNumber, user, message, timestamp, tokens, modelName], function(err) {
            if (err) {
                reject(err);
            } else {
                // Invalidate cache for this chatBoxNumber
                messageCache.forEach((_, key) => {
                    const numbers = key.split(',').map(Number);
                    if (numbers.includes(chatBoxNumber)) {
                        messageCache.delete(key);
                        logger.info(`Cache invalidated for key: ${key}`);
                    }
                });
                resolve(this.lastID);
            }
        });
        stmt.finalize();
    });
}

/**
 * Retrieves messages from the database for given chatBoxNumbers with caching
 * @param {number[]} chatBoxNumbers 
 * @returns {Promise<Array>}
 */
function getMessages(chatBoxNumbers) {
    return new Promise((resolve, reject) => {
        if (chatBoxNumbers.length === 0) {
            resolve([]);
            return;
        }

        const cacheKey = generateCacheKey(chatBoxNumbers);
        if (messageCache.has(cacheKey)) {
            logger.info(`Cache hit for chatBoxNumbers: ${cacheKey}`);
            return resolve(messageCache.get(cacheKey));
        }

        const placeholders = chatBoxNumbers.map(() => '?').join(',');
        const query = `
            SELECT chatBoxNumber, user, message, timestamp, tokens, modelName
            FROM conversations
            WHERE chatBoxNumber IN (${placeholders})
        `;
        db.all(query, chatBoxNumbers, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                messageCache.set(cacheKey, rows);
                logger.info(`Cache set for chatBoxNumbers: ${cacheKey}`);
                resolve(rows);
            }
        });
    });
}

/**
 * Closes the database connection gracefully and clears the cache.
 */
function closeDatabase() {
    db.close((err) => {
        if (err) {
            logger.error(`Error closing database: ${err.message}`);
        } else {
            logger.info('Database connection closed.');
        }
    });
    messageCache.clear();
    logger.info('Message cache cleared.');
}

// Handle process exit to close the database connection gracefully
process.on('SIGINT', () => {
    closeDatabase();
    process.exit(0);
});

// Attach addMessage and getMessages to the db instance
db.addMessage = addMessage;
db.getMessages = getMessages;

// Export the db instance
module.exports = db;
