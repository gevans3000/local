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
      db.run(
        `
          CREATE TABLE IF NOT EXISTS conversations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              chatBoxNumber INTEGER NOT NULL CHECK(chatBoxNumber > 0),
              modelName TEXT NOT NULL DEFAULT 'Human',
              user TEXT NOT NULL,
              message TEXT NOT NULL,
              timestamp TEXT NOT NULL,
              tokens INTEGER CHECK(tokens >= 0),
              system_prompt TEXT
          )
      `,
        (err) => {
          if (err) {
            logger.error(`Error creating conversations table: ${err.message}`);
          } else {
            logger.info('Conversations table is ready.');
          }
        }
      );

      // Create index on chatBoxNumber for faster queries
      db.run(
        `
          CREATE INDEX IF NOT EXISTS idx_chatBoxNumber ON conversations(chatBoxNumber)
      `,
        (err) => {
          if (err) {
            logger.error(`Error creating index on chatBoxNumber: ${err.message}`);
          } else {
            logger.info('Index on chatBoxNumber is ready.');
          }
        }
      );

      // Add index on timestamp for faster queries based on timestamp
      db.run(
        `
          CREATE INDEX IF NOT EXISTS idx_timestamp ON conversations(timestamp)
      `,
        (err) => {
          if (err) {
            logger.error(`Error creating index on timestamp: ${err.message}`);
          } else {
            logger.info('Index on timestamp is ready.');
          }
        }
      );

      // Create the training_conversations table for bot-to-bot interactions
      db.run(
        `
          CREATE TABLE IF NOT EXISTS training_conversations (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              conversation_id TEXT NOT NULL,
              bot1_name TEXT NOT NULL,
              bot2_name TEXT NOT NULL,
              message TEXT NOT NULL,
              is_bot1 BOOLEAN NOT NULL,
              quality_score FLOAT CHECK(quality_score >= 0 AND quality_score <= 1),
              topic TEXT,
              metadata TEXT,
              timestamp TEXT NOT NULL,
              tokens INTEGER CHECK(tokens >= 0)
          )
      `,
        (err) => {
          if (err) {
            logger.error(`Error creating training_conversations table: ${err.message}`);
          } else {
            logger.info('Training conversations table is ready.');
          }
        }
      );

      // Create indices for the training_conversations table
      db.run(
        `
          CREATE INDEX IF NOT EXISTS idx_conversation_id ON training_conversations(conversation_id);
          CREATE INDEX IF NOT EXISTS idx_quality_score ON training_conversations(quality_score);
          CREATE INDEX IF NOT EXISTS idx_training_timestamp ON training_conversations(timestamp);
      `,
        (err) => {
          if (err) {
            logger.error(`Error creating training conversation indices: ${err.message}`);
          } else {
            logger.info('Training conversation indices are ready.');
          }
        }
      );
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
 * @param {string} systemPrompt
 * @returns {Promise<number>}
 */
function addMessage(chatBoxNumber, user, message, timestamp, tokens, modelName, systemPrompt) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(
      `
            INSERT INTO conversations (chatBoxNumber, user, message, timestamp, tokens, modelName, system_prompt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `
    );
    stmt.run([chatBoxNumber, user, message, timestamp, tokens, modelName, systemPrompt], function (err) {
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
            SELECT chatBoxNumber, user, message, timestamp, tokens, modelName, system_prompt
            FROM conversations
            WHERE chatBoxNumber IN (${placeholders})
            ORDER BY datetime(timestamp) ASC
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
 * @returns {Promise<void>}
 */
function closeDatabase() {
  return new Promise((resolve) => {
    // Check if database is already closed
    if (db.open) {
      db.close((err) => {
        if (err) {
          logger.error(`Error closing database: ${err.message}`);
        } else {
          logger.info('Database connection closed.');
        }
        messageCache.clear();
        logger.info('Message cache cleared.');
        resolve();
      });
    } else {
      messageCache.clear();
      logger.info('Message cache cleared.');
      resolve();
    }
  });
}

// Handle process exit to close the database connection gracefully
process.on('SIGINT', async () => {
  await closeDatabase();
  process.exit(0);
});

// Add a new training conversation message
async function addTrainingMessage(conversationId, bot1Name, bot2Name, message, isBot1, qualityScore, topic = null, metadata = null) {
  const timestamp = new Date().toISOString();
  const tokens = message.length;

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO training_conversations 
       (conversation_id, bot1_name, bot2_name, message, is_bot1, quality_score, topic, metadata, timestamp, tokens)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [conversationId, bot1Name, bot2Name, message, isBot1 ? 1 : 0, qualityScore, topic, metadata, timestamp, tokens],
      function(err) {
        if (err) {
          logger.error(`Error adding training message: ${err.message}`);
          reject(err);
        } else {
          resolve(this.lastID);
        }
      }
    );
  });
}

// Get all messages from a specific training conversation
async function getTrainingConversation(conversationId) {
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT * FROM training_conversations WHERE conversation_id = ? ORDER BY timestamp ASC',
      [conversationId],
      (err, rows) => {
        if (err) {
          logger.error(`Error retrieving training conversation: ${err.message}`);
          reject(err);
        } else {
          resolve(rows);
        }
      }
    );
  });
}

// Export training data in JSONL format for LLM fine-tuning
async function exportTrainingData(minQualityScore = 0.7) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM training_conversations 
       WHERE quality_score >= ? 
       ORDER BY conversation_id, timestamp`,
      [minQualityScore],
      (err, rows) => {
        if (err) {
          logger.error(`Error exporting training data: ${err.message}`);
          reject(err);
        } else {
          // Group messages by conversation
          const conversations = {};
          rows.forEach(row => {
            if (!conversations[row.conversation_id]) {
              conversations[row.conversation_id] = [];
            }
            conversations[row.conversation_id].push(row);
          });

          // Format data for fine-tuning
          const trainingData = Object.values(conversations).map(conversation => {
            return {
              messages: conversation.map(msg => ({
                role: msg.is_bot1 ? "assistant" : "user",
                content: msg.message
              })),
              metadata: {
                topic: conversation[0].topic,
                quality_score: conversation[0].quality_score,
                bot1_name: conversation[0].bot1_name,
                bot2_name: conversation[0].bot2_name,
                timestamp: conversation[0].timestamp
              }
            };
          });

          resolve(trainingData);
        }
      }
    );
  });
}

// Attach addMessage and getMessages to the db instance
db.addMessage = addMessage;
db.getMessages = getMessages;
db.addTrainingMessage = addTrainingMessage;
db.getTrainingConversation = getTrainingConversation;
db.exportTrainingData = exportTrainingData;
db.closeDatabase = closeDatabase;

// Export the db instance
module.exports = db;
