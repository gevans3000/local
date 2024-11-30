// logger.js
const winston = require('winston');
const config = require('../../../config');

/**
 * Creates a Winston logger instance with console and file transports
 * @param {Object} options - Logger configuration options
 * @returns {winston.Logger} Configured logger instance
 */
function createLogger(options = {}) {
  const {
    level = config.logging.level,
    errorFile = config.logging.errorFile,
    combinedFile = config.logging.combinedFile
  } = options;

  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        )
      }),
      new winston.transports.File({
        filename: errorFile,
        level: 'error',
      }),
      new winston.transports.File({
        filename: combinedFile,
      }),
    ],
  });
}

// Create default logger instance
const logger = createLogger();

module.exports = {
  logger,
  createLogger
};
