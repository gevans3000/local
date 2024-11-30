// database/index.js
const DatabaseService = require('./services/database');
const { logger } = require('../utils');

let dbInstance = null;

/**
 * Get the database instance, creating it if it doesn't exist
 * @returns {Promise<DatabaseService>}
 */
async function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseService();
    await dbInstance.initialize();

    // Handle process exit
    process.on('SIGINT', async () => {
      await dbInstance.close();
      process.exit(0);
    });
  }
  return dbInstance;
}

// Initialize database instance
const db = getDatabase().then(instance => {
  // Create a proxy object that matches the old interface
  return {
    addMessage: (...args) => instance.conversation.addMessage(...args),
    getMessages: (...args) => instance.conversation.getMessages(...args),
    addTrainingMessage: (...args) => instance.training.addMessage(...args),
    getTrainingConversation: (...args) => instance.training.getConversation(...args),
    exportTrainingData: (...args) => instance.training.exportData(...args),
    closeDatabase: () => instance.close()
  };
}).catch(err => {
  logger.error(`Failed to initialize database: ${err.message}`);
  process.exit(1);
});

module.exports = db;
