// database/config.js
const path = require('path');
const config = require('../../config');

module.exports = {
  dbPath: path.resolve(process.cwd(), config.database.path || 'conversations.db'),
  pragmas: {
    foreignKeys: 'ON',
    journalMode: 'WAL',
    synchronous: 'NORMAL'
  }
};
