// database/models/training.js
const { logger } = require('../../utils');

class Training {
  constructor(db) {
    this.db = db;
  }

  /**
   * Add a new training conversation message
   * @param {string} conversationId - Unique conversation identifier
   * @param {string} bot1Name - Name of the first bot
   * @param {string} bot2Name - Name of the second bot
   * @param {string} message - Message content
   * @param {boolean} isBot1 - Whether the message is from bot1
   * @param {number} qualityScore - Message quality score
   * @param {string} topic - Conversation topic
   * @param {string} metadata - Additional metadata
   * @returns {Promise<number>} - ID of the inserted message
   */
  async addMessage(conversationId, bot1Name, bot2Name, message, isBot1, qualityScore, topic = null, metadata = null) {
    const timestamp = new Date().toISOString();
    const tokens = message.length;

    return new Promise((resolve, reject) => {
      this.db.run(
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

  /**
   * Get all messages from a specific training conversation
   * @param {string} conversationId - Conversation identifier
   * @returns {Promise<Array>} - Array of conversation messages
   */
  async getConversation(conversationId) {
    return new Promise((resolve, reject) => {
      this.db.all(
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

  /**
   * Export training data in JSONL format for LLM fine-tuning
   * @param {number} minQualityScore - Minimum quality score threshold
   * @returns {Promise<Array>} - Array of formatted training data
   */
  async exportData(minQualityScore = 0.7) {
    return new Promise((resolve, reject) => {
      this.db.all(
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
            const trainingData = Object.values(conversations).map(conversation => ({
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
            }));

            resolve(trainingData);
          }
        }
      );
    });
  }
}

module.exports = Training;
