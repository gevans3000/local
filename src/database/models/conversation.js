// database/models/conversation.js
const { logger } = require('../../utils');

class Conversation {
  constructor(db) {
    this.db = db;
    this.messageCache = new Map();
    
    // Bind methods to ensure correct 'this' context
    this.addMessage = this.addMessage.bind(this);
    this.getMessages = this.getMessages.bind(this);
    this.generateCacheKey = this.generateCacheKey.bind(this);
  }

  /**
   * Generates a cache key based on chatBoxNumbers
   * @param {number[]} chatBoxNumbers - Array of chat box numbers
   * @returns {string} - Cache key
   */
  generateCacheKey(chatBoxNumbers) {
    return chatBoxNumbers.sort((a, b) => a - b).join(',');
  }

  /**
   * Adds a message to the database and invalidates relevant cache entries
   * @param {number} chatBoxNumber - Chat box identifier
   * @param {string} user - User identifier
   * @param {string} message - Message content
   * @param {string} timestamp - Message timestamp
   * @param {number} tokens - Token count
   * @param {string} modelName - Model name
   * @param {string} systemPrompt - System prompt
   * @returns {Promise<number>} - ID of the inserted message
   */
  async addMessage(chatBoxNumber, user, message, timestamp, tokens, modelName, systemPrompt) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO conversations (chatBoxNumber, user, message, timestamp, tokens, modelName, system_prompt)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);

      const params = [chatBoxNumber, user, message, timestamp, tokens, modelName, systemPrompt];
      
      stmt.run(params, (err) => {
        if (err) {
          logger.error(`Error adding message: ${err.message}`);
          reject(err);
          return;
        }

        // Invalidate cache for this chatBoxNumber
        for (const [key, _] of this.messageCache) {
          const numbers = key.split(',').map(Number);
          if (numbers.includes(chatBoxNumber)) {
            this.messageCache.delete(key);
            logger.info(`Cache invalidated for key: ${key}`);
          }
        }
        
        resolve(this.lastID);
      });

      stmt.finalize();
    });
  }

  /**
   * Retrieves messages from the database for given chatBoxNumbers with caching
   * @param {number[]} chatBoxNumbers - Array of chat box numbers
   * @returns {Promise<Array>} - Array of messages
   */
  async getMessages(chatBoxNumbers) {
    return new Promise((resolve, reject) => {
      if (!Array.isArray(chatBoxNumbers) || chatBoxNumbers.length === 0) {
        resolve([]);
        return;
      }

      const cacheKey = this.generateCacheKey(chatBoxNumbers);
      if (this.messageCache.has(cacheKey)) {
        logger.info(`Cache hit for chatBoxNumbers: ${cacheKey}`);
        return resolve(this.messageCache.get(cacheKey));
      }

      const placeholders = chatBoxNumbers.map(() => '?').join(',');
      const query = `
        SELECT chatBoxNumber, user, message, timestamp, tokens, modelName, system_prompt
        FROM conversations
        WHERE chatBoxNumber IN (${placeholders})
        ORDER BY datetime(timestamp) ASC
      `;

      this.db.all(query, chatBoxNumbers, (err, rows) => {
        if (err) {
          logger.error(`Error getting messages: ${err.message}`);
          reject(err);
          return;
        }
        
        this.messageCache.set(cacheKey, rows);
        logger.info(`Cache set for chatBoxNumbers: ${cacheKey}`);
        resolve(rows);
      });
    });
  }
}

module.exports = Conversation;
