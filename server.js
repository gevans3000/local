/**
 * Main server application file that handles API endpoints, database interactions,
 * and chat functionality. Implements caching and conversation management.
 * 
 * Key features:
 * - Express server setup
 * - OpenAI integration
 * - Database operations
 * - Caching mechanism
 * - Bot-to-bot conversations
 * - Context management
 */
// server.js
const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const favicon = require('serve-favicon');
const config = require('./config');
const { logger, ProcessManager } = require('./src/utils');
const db = require('./src/database');

/**
 * Initialize Express app
 */
const app = express();
app.use(express.json());
app.use(favicon(path.join(__dirname, 'favicon.ico')));
app.use(express.static(__dirname));

// Server state
let server = null;

/**
 * Cleanup function to perform necessary cleanup operations
 * before server shutdown. Handles database connections and
 * active processes.
 */
async function cleanup() {
  if (server) {
    await new Promise(resolve => {
      server.close(() => {
        logger.info('Server closed');
        resolve();
      });
      server.unref();
    });

    const database = await db;
    if (database.closeDatabase) {
      await database.closeDatabase();
    }

    server = null;
  }
}

/**
 * Sets up process handlers for graceful shutdown
 * Ensures cleanup is performed when process is terminated
 */
ProcessManager.setupSignalHandlers(cleanup);

/**
 * Initializes and starts the Express server
 * Configures middleware, routes, and error handlers
 * Attempts to find an available port if default is in use
 */
async function startServer() {
  try {
    // Kill any existing process on our port
    await ProcessManager.killProcessOnPort(config.server.port);

    // Clean up if server exists
    if (server) {
      await cleanup();
    }

    server = app.listen(config.server.port, config.server.host);
    
    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.server.port} is already in use. Please free the port and try again.`);
      } else {
        logger.error(`Server error: ${err.message}`);
      }
      await cleanup();
      process.exit(1);
    });

    server.on('listening', () => {
      logger.info(`Server is running on http://${config.server.host}:${config.server.port}`);
    });

    return server;
  } catch (err) {
    logger.error(`Error starting server: ${err.message}`);
    await cleanup();
    process.exit(1);
  }
}

/**
 * OpenAI client initialization with configuration
 * Sets up API key and base URL for OpenAI interactions
 */
const openai = new OpenAI({
  apiKey: config.openai.apiKey,
  baseURL: config.openai.baseURL
});

// Suppress the punycode deprecation warning
process.noDeprecation = true;

// Start the server
startServer().catch(async err => {
  logger.error(`Failed to start server: ${err.message}`);
  await cleanup();
  process.exit(1);
});

// Configuration constants
const PORT = config.server.port;
const MAX_PORT_ATTEMPTS = 10;

/**
 * Terminates any process running on the specified port (Windows specific)
 * @param {number} port - The port number to check
 * Returns a promise that resolves when the process is killed
 */
async function killProcessOnPort(port) {
  try {
    // Find process ID using port
    const { stdout } = await ProcessManager.execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 4 && parts[1].includes(`:${port}`)) {
        const pid = parts[parts.length - 1];
        try {
          // Kill the process
          await ProcessManager.execAsync(`taskkill /F /PID ${pid}`);
          logger.info(`Killed process ${pid} on port ${port}`);
        } catch (err) {
          // Process might already be gone
          logger.warn(`Process ${pid} not found or already terminated`);
        }
      }
    }
  } catch (err) {
    // No process found on port
    logger.info(`No process found on port ${port}`);
  }
}

/**
 * Attempts to kill any existing Node process on port 3000
 * Used during server startup to ensure clean port availability
 */
async function killExistingProcess() {
  try {
    const { stdout } = await ProcessManager.execAsync('netstat -ano | findstr :3000');
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 4 && parts[1].includes(':3000')) {
        const pid = parts[parts.length - 1];
        try {
          await ProcessManager.execAsync(`taskkill /F /PID ${pid}`);
          logger.info(`Killed process ${pid} on port 3000`);
        } catch (err) {
          // Process might already be gone
          logger.warn(`Process ${pid} not found or already terminated`);
        }
      }
    }
  } catch (err) {
    // No process found on port
    logger.info('No existing process found on port 3000');
  }
}

/**
 * Checks if a specific port is available for use
 * @param {number} port - The port to check
 * @returns {Promise<boolean>} - True if port is available
 */
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = require('net').createServer()
      .once('error', () => {
        resolve(false);
      })
      .once('listening', () => {
        tester.once('close', () => {
          resolve(true);
        }).close();
      })
      .listen(port);
  });
}

/**
 * Finds the first available port starting from the specified port
 * @param {number} startPort - The port to start checking from
 * @returns {Promise<number>} - First available port
 */
async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + MAX_PORT_ATTEMPTS; port++) {
    const available = await isPortAvailable(port);
    if (available) {
      return port;
    }
    logger.warn(`Port ${port} is in use`);
  }
  throw new Error('No available ports found');
}

/**
 * Model constants for different AI models
 * Defines available models and their configurations
 */
const MODEL_DEFAULT = 'gpt-4o-mini';
const MODEL_OPENAI_ALTERNATE = 'gpt-4o-mini-2024-07-18';
const MODEL_NVIDIA = 'nvidia/llama-3.1-nemotron-70b-instruct';
const MODEL_META = 'meta/llama-3.2-3b-instruct';

// Allowed models, configurable via environment variable
const ALLOWED_MODELS = config.allowedModels
  ? config.allowedModels.split(',').map(model => model.trim())
  : [MODEL_DEFAULT, MODEL_OPENAI_ALTERNATE, MODEL_NVIDIA, MODEL_META];

/**
 * Promisified database run operation
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise} - Resolves when query completes
 */
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        reject(err);
      } else {
        resolve(this);
      }
    });
  });

/**
 * Promisified database all operation for retrieving multiple rows
 * @param {string} sql - SQL query to execute
 * @param {Array} params - Query parameters
 * @returns {Promise<Array>} - Resolves with query results
 */
const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

// Joi schemas for input validation
const { askSchema, getContextSchema } = require('./src/utils');

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

/**
 * Handle '/ask' endpoint
 * Validates request body, processes user query, and returns AI response
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
app.post('/ask', async (req, res) => {
  // Validate request body
  const { error, value } = askSchema.validate(req.body);
  if (error) {
    logger.warn(`Validation error: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }

  const { question, model, chatBoxNumber, context, system_prompt } = value;
  const selectedModel = model || MODEL_DEFAULT;
  const timestamp = new Date().toLocaleString();

  try {
    let openaiClient;
    let responseUserIdentifier = `Assistant${chatBoxNumber}`;  

    // Select OpenAI client based on model prefix
    if (selectedModel.startsWith('gpt-')) {
      openaiClient = openai;
    } else if (selectedModel.startsWith('nvidia/') || selectedModel.startsWith('meta/')) {
      openaiClient = new OpenAI({
        apiKey: config.nvidia.apiKey,
        baseURL: config.nvidia.baseURL
      });
    } else {
      // For any other model, default to NVIDIA API
      openaiClient = new OpenAI({
        apiKey: config.nvidia.apiKey,
        baseURL: config.nvidia.baseURL
      });
    }

    // Calculate tokens used for the user question
    const tokensUsedUser = require('gpt-3-encoder').encode(question).length;

    // Set user identifier
    const userIdentifier = `You${chatBoxNumber}`;

    // Save user question to the database
    const database = await db;
    await database.addMessage(
      chatBoxNumber,
      userIdentifier,
      question,
      timestamp,
      tokensUsedUser,
      'Human',
      system_prompt
    );

    logger.info(`User message saved for chatBoxNumber ${chatBoxNumber}`);

    // Prepare messages array for OpenAI
    let messages = [];

    if (system_prompt) {
      messages.push({ role: 'system', content: system_prompt });
    }

    if (Array.isArray(context) && context.length > 0) {
      context.forEach((msg) => {
        if (msg.user.startsWith('You')) {
          messages.push({ role: 'user', content: msg.message });
        } else if (msg.user === 'System') {
          messages.push({ role: 'system', content: msg.message });
        } else {
          messages.push({ role: 'assistant', content: msg.message });
        }
      });
    }

    // Add the current user question
    messages.push({ role: 'user', content: question });

    // Get response from OpenAI
    const response = await openaiClient.chat.completions.create({
      model: selectedModel,
      messages: messages,
      temperature: parseFloat(config.openai.temperature) || 0.7,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from OpenAI API.');
    }

    const answer = response.choices[0].message.content;
    const tokensUsed = response.usage ? response.usage.total_tokens : null;

    // Save AI response to the database
    await database.addMessage(
      chatBoxNumber,
      responseUserIdentifier,
      answer,
      timestamp,
      tokensUsed,
      selectedModel,
      system_prompt
    );

    logger.info(`AI message saved for chatBoxNumber ${chatBoxNumber}`);

    res.json({ answer, usage: response.usage });
  } catch (err) {
    logger.error(`Error in /ask endpoint: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'An error occurred while processing your request.' });
  }
});

/**
 * Cache configuration for context messages
 * Implements a simple in-memory cache with TTL
 */
// Simple in-memory cache for context messages
const contextCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Context retrieval endpoint handler
 * Implements caching mechanism to optimize performance
 * Fetches messages based on chat box numbers
 * @param {Array} chatBoxNumbers - Array of chat box identifiers
 * @returns {Object} - JSON response with context messages
 */
app.post('/get-context', async (req, res) => {
  const { error, value } = getContextSchema.validate(req.body);
  if (error) {
    logger.error(`Validation error in /get-context: ${error.message}`);
    return res.status(400).json({ error: error.message });
  }

  const { chatBoxNumbers } = value;
  const cacheKey = chatBoxNumbers.sort().join(',');

  try {
    // Check cache first
    const cached = contextCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_TTL) {
      return res.json({ context: cached.messages });
    }

    const database = await db;
    const messages = await database.getMessages(chatBoxNumbers);
    
    // Update cache
    contextCache.set(cacheKey, {
      messages,
      timestamp: Date.now()
    });

    res.json({ context: messages });
  } catch (err) {
    logger.error(`Error in /get-context endpoint: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'An error occurred while fetching context.' });
  }
});

/**
 * Bot-to-bot conversation endpoint
 * Handles automated conversations between two AI models
 * @param {string} bot1Model - First bot's model
 * @param {string} bot2Model - Second bot's model
 * @param {string} topic - Conversation topic
 * @param {string} initialPrompt - Starting prompt
 * @param {number} turns - Number of conversation turns
 */
app.post('/api/bot-conversation', async (req, res) => {
  try {
    const { bot1Model, bot2Model, topic, initialPrompt, turns = 5 } = req.body;

    // Validate input
    if (!bot1Model || !bot2Model || !initialPrompt) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Generate a unique conversation ID
    const conversationId = `train_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    let currentPrompt = initialPrompt;
    let isBot1Turn = true;

    // Conduct the conversation
    for (let i = 0; i < turns; i++) {
      const currentModel = isBot1Turn ? bot1Model : bot2Model;
      const currentClient = currentModel.startsWith('nvidia/') ? new OpenAI({
        apiKey: config.nvidia.apiKey,
        baseURL: config.nvidia.baseURL
      }) : openai;

      try {
        const completion = await currentClient.chat.completions.create({
          model: currentModel,
          messages: [{ role: 'user', content: currentPrompt }],
          temperature: 0.7,
          max_tokens: 1000
        });

        const response = completion.choices[0].message.content;
        
        // Calculate a simple quality score (can be enhanced with more sophisticated metrics)
        const qualityScore = Math.min(
          1.0,
          (response.length / 1000) * // Length factor
          (response.split(' ').length / 50) * // Word count factor
          0.9 + 0.1 // Base score
        );

        // Store the message
        const database = await db;
        await database.addTrainingMessage(
          conversationId,
          bot1Model,
          bot2Model,
          response,
          isBot1Turn,
          qualityScore,
          topic,
          JSON.stringify({ turn: i + 1, totalTurns: turns })
        );

        currentPrompt = response;
        isBot1Turn = !isBot1Turn;
      } catch (error) {
        logger.error(`Error in bot conversation turn ${i + 1}: ${error.message}`);
        break;
      }
    }

    res.json({ 
      success: true, 
      conversationId,
      message: `Generated ${turns} turns of conversation between ${bot1Model} and ${bot2Model}`
    });

  } catch (error) {
    logger.error(`Error in bot conversation: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Endpoint to export training data
 * @param {number} minQualityScore - Minimum quality score for exported data
 * @returns {Object} - JSON response with training data
 */
app.get('/api/export-training-data', async (req, res) => {
  try {
    const minQualityScore = parseFloat(req.query.minQualityScore) || 0.7;
    const database = await db;
    const trainingData = await database.exportTrainingData(minQualityScore);
    
    res.json({
      success: true,
      data: trainingData,
      count: trainingData.length,
      minQualityScore
    });
  } catch (error) {
    logger.error(`Error exporting training data: ${error.message}`);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * Global error handling middleware
 */
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
  });

  res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
});
