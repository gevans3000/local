// processManager.js
const { exec } = require('child_process');
const { promisify } = require('util');
const logger = require('./logger');

const execAsync = promisify(exec);

// Utility function to execute a command and log errors
async function executeCommand(command) {
  try {
    const { stdout } = await execAsync(command);
    return stdout;
  } catch (error) {
    logger.error(`Failed to execute command: ${command}. Error: ${error.message}`);
    throw error;
  }
}

class ProcessManager {
  static async killProcessOnPort(port) {
    try {
      const stdout = await executeCommand(`netstat -ano | findstr :${port}`);
      const lines = stdout.split('\n');
      
      for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length > 4 && parts[1].includes(`:${port}`)) {
          const pid = parts[parts.length - 1];
          try {
            await executeCommand(`taskkill /F /PID ${pid}`);
            logger.info(`Killed process ${pid} on port ${port}`);
          } catch (err) {
            logger.warn(`Process ${pid} not found or already terminated`);
          }
        }
      }
    } catch (err) {
      logger.info(`No existing process found on port ${port}`);
    }
  }

  static setupSignalHandlers(cleanup) {
    ['SIGINT', 'SIGTERM', 'SIGQUIT'].forEach(signal => {
      process.on(signal, async () => {
        logger.info(`Received ${signal}, shutting down...`);
        await cleanup();
        process.exit(0);
      });
    });

    // Handle nodemon restart
    process.once('SIGUSR2', async () => {
      await cleanup();
      process.kill(process.pid, 'SIGUSR2');
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', async (err) => {
      logger.error(`Uncaught Exception: ${err.message}`);
      await cleanup();
      process.exit(1);
    });

    process.on('unhandledRejection', async (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      await cleanup();
      process.exit(1);
    });
  }
}

module.exports = ProcessManager;