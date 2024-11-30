// database/services/database.js
const sqlite3 = require('sqlite3').verbose();
const dbConfig = require('../config');
const { logger } = require('../../utils');
const Conversation = require('../models/conversation');
const Training = require('../models/training');

class DatabaseService {
  constructor() {
    this.db = null;
    this.conversation = null;
    this.training = null;
  }

  /**
   * Initialize the database connection and models
   * @returns {Promise<void>}
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(
        dbConfig.dbPath,
        sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
        async (err) => {
          if (err) {
            logger.error(`Error opening database: ${err.message}`);
            reject(err);
            return;
          }

          logger.info('Connected to the SQLite database.');
          
          try {
            await this.setPragmas();
            await this.createTables();
            
            // Initialize models
            this.conversation = new Conversation(this.db);
            this.training = new Training(this.db);
            
            resolve();
          } catch (error) {
            reject(error);
          }
        }
      );
    });
  }

  /**
   * Set database PRAGMA options
   * @returns {Promise<void>}
   */
  async setPragmas() {
    const pragmas = Object.entries(dbConfig.pragmas).map(
      ([key, value]) => new Promise((resolve, reject) => {
        this.db.run(`PRAGMA ${key} = ${value};`, (err) => {
          if (err) {
            logger.error(`Error setting PRAGMA ${key}: ${err.message}`);
            reject(err);
          } else {
            logger.info(`PRAGMA ${key} set to ${value}.`);
            resolve();
          }
        });
      })
    );

    return Promise.all(pragmas);
  }

  /**
   * Create database tables if they don't exist
   * @returns {Promise<void>}
   */
  async createTables() {
    const createConversationsTable = new Promise((resolve, reject) => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          chatBoxNumber INTEGER NOT NULL,
          user TEXT NOT NULL,
          message TEXT NOT NULL,
          timestamp TEXT NOT NULL,
          tokens INTEGER,
          modelName TEXT,
          system_prompt TEXT
        )
      `, (err) => {
        if (err) {
          logger.error(`Error creating conversations table: ${err.message}`);
          reject(err);
        } else {
          logger.info('Conversations table is ready.');
          resolve();
        }
      });
    });

    const createTrainingTable = new Promise((resolve, reject) => {
      this.db.run(`
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
      `, (err) => {
        if (err) {
          logger.error(`Error creating training_conversations table: ${err.message}`);
          reject(err);
        } else {
          logger.info('Training conversations table is ready.');
          resolve();
        }
      });
    });

    const createIndices = new Promise((resolve, reject) => {
      const indices = [
        'CREATE INDEX IF NOT EXISTS idx_chatBoxNumber ON conversations(chatBoxNumber)',
        'CREATE INDEX IF NOT EXISTS idx_timestamp ON conversations(timestamp)',
        'CREATE INDEX IF NOT EXISTS idx_conversation_id ON training_conversations(conversation_id)',
        'CREATE INDEX IF NOT EXISTS idx_quality_score ON training_conversations(quality_score)',
        'CREATE INDEX IF NOT EXISTS idx_training_timestamp ON training_conversations(timestamp)'
      ];

      const createIndex = (sql) => new Promise((resolve, reject) => {
        this.db.run(sql, (err) => {
          if (err) {
            logger.error(`Error creating index: ${err.message}`);
            reject(err);
          } else {
            resolve();
          }
        });
      });

      Promise.all(indices.map(createIndex))
        .then(() => {
          logger.info('All indices are ready.');
          resolve();
        })
        .catch(reject);
    });

    return Promise.all([
      createConversationsTable,
      createTrainingTable,
      createIndices
    ]);
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    return new Promise((resolve) => {
      if (this.db && this.db.open) {
        this.db.close((err) => {
          if (err) {
            logger.error(`Error closing database: ${err.message}`);
          } else {
            logger.info('Database connection closed.');
          }
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = DatabaseService;
