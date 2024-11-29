// config.js
require('dotenv').config();

module.exports = {
  server: {
    port: parseInt(process.env.PORT, 10) || 3000,
    host: process.env.HOST || 'localhost'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    errorFile: process.env.LOG_FILE_ERROR || 'error.log',
    combinedFile: process.env.LOG_FILE_COMBINED || 'combined.log'
  },
  database: {
    path: process.env.DB_PATH || 'conversations.db'
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL
  }
};
