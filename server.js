// server.js

// Import dependencies
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');
const favicon = require('serve-favicon');
const winston = require('winston');
const Joi = require('joi');
const { encode } = require('gpt-3-encoder');
const db = require('./database');
const net = require('net');
const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Initialize Express app
const app = express();
app.use(express.json());
app.use(favicon(path.join(__dirname, 'favicon.ico')));

// Setup Winston logger with environment variables for configurability
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: process.env.LOG_FILE_ERROR || 'error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: process.env.LOG_FILE_COMBINED || 'combined.log',
    }),
  ],
});

// Serve static files from the project directory
app.use(express.static(__dirname));

// Configuration constants
const PORT = parseInt(process.env.PORT, 10) || 3000;
const MAX_PORT_ATTEMPTS = 10;
let server = null;

// Function to kill process on a specific port (Windows)
async function killProcessOnPort(port) {
  try {
    // Find process ID using port
    const { stdout } = await execAsync(`netstat -ano | findstr :${port}`);
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 4 && parts[1].includes(`:${port}`)) {
        const pid = parts[parts.length - 1];
        try {
          // Kill the process
          await execAsync(`taskkill /F /PID ${pid}`);
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

// Kill any existing Node process on port 3000
async function killExistingProcess() {
  try {
    const { stdout } = await execAsync('netstat -ano | findstr :3000');
    const lines = stdout.split('\n');
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length > 4 && parts[1].includes(':3000')) {
        const pid = parts[parts.length - 1];
        try {
          await execAsync(`taskkill /F /PID ${pid}`);
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

// Function to check if a port is in use
function isPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
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

// Find first available port
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

// Cleanup function
async function cleanup() {
  if (server) {
    // Close the server first
    await new Promise(resolve => {
      server.close(() => {
        logger.info('Server closed');
        resolve();
      });
      // Immediately destroy all connections
      server.unref();
    });

    // Close database connection
    if (db.closeDatabase) {
      await db.closeDatabase();
    }

    server = null;
  }
}

// Handle all termination signals
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

// Handle unhandled rejections
process.on('unhandledRejection', async (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  await cleanup();
  process.exit(1);
});

// Handle normal process exit
process.on('exit', (code) => {
  logger.info(`Process exit with code: ${code}`);
});

// Initialize OpenAI clients with configurable base URLs and API keys
const openaiDefault = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const openaiNVIDIA = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY,
  baseURL: process.env.NVIDIA_BASE_URL || 'https://integrate.api.nvidia.com/v1',
});

// Model constants
const MODEL_DEFAULT = 'gpt-4o-mini';
const MODEL_OPENAI_ALTERNATE = 'gpt-4o-mini-2024-07-18';
const MODEL_NVIDIA = 'nvidia/llama-3.1-nemotron-70b-instruct';
const MODEL_META = 'meta/llama-3.2-3b-instruct';

// Allowed models, configurable via environment variable
const ALLOWED_MODELS = process.env.ALLOWED_MODELS
  ? process.env.ALLOWED_MODELS.split(',').map(model => model.trim())
  : [MODEL_DEFAULT, MODEL_OPENAI_ALTERNATE, MODEL_NVIDIA, MODEL_META];

// Helper functions to promisify db.run and db.all
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
const askSchema = Joi.object({
  question: Joi.string().min(1).required(),
  model: Joi.string().optional(),
  chatBoxNumber: Joi.number().integer().min(1).required(),
  context: Joi.array()
    .items(
      Joi.object({
        user: Joi.string().required(),
        message: Joi.string().required(),
        timestamp: Joi.string().optional(),
        tokens: Joi.number().optional(),
      })
    )
    .optional(),
  system_prompt: Joi.string().optional().allow(''),
});

const getContextSchema = Joi.object({
  chatBoxNumbers: Joi.array().items(Joi.number().integer().min(1)).required(),
});

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle '/ask' endpoint
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
    let responseUserIdentifier = selectedModel;

    // Validate model
    if (!ALLOWED_MODELS.includes(selectedModel)) {
      logger.error(`Invalid model specified: ${selectedModel}`);
      return res.status(400).json({ error: 'Invalid model specified.' });
    }

    // Select OpenAI client based on model
    if (selectedModel.startsWith('gpt-')) {
      openaiClient = openaiDefault;
    } else {
      openaiClient = openaiNVIDIA;
    }

    // Calculate tokens used for the user question
    const tokensUsedUser = encode(question).length;

    // Set user identifier
    const userIdentifier = `You${chatBoxNumber}`;

    // Save user question to the database
    await db.addMessage(
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
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7,
    });

    if (!response.choices || response.choices.length === 0) {
      throw new Error('No response from OpenAI API.');
    }

    const answer = response.choices[0].message.content;
    const tokensUsed = response.usage ? response.usage.total_tokens : null;

    // Save AI response to the database
    await db.addMessage(
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

// Handle '/get-context' endpoint
app.post('/get-context', async (req, res) => {
  // Validate request body
  const { error, value } = getContextSchema.validate(req.body);
  if (error) {
    logger.warn(`Validation error in /get-context: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }

  const { chatBoxNumbers } = value;

  try {
    const messages = await db.getMessages(chatBoxNumbers);

    res.json({ context: messages });
  } catch (err) {
    logger.error(`Error in /get-context endpoint: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'An error occurred while fetching context.' });
  }
});

// Endpoint for bot-to-bot conversation
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
      const currentClient = currentModel.startsWith('nvidia/') ? openaiNVIDIA : openaiDefault;

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
        await db.addTrainingMessage(
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

// Endpoint to export training data
app.get('/api/export-training-data', async (req, res) => {
  try {
    const minQualityScore = parseFloat(req.query.minQualityScore) || 0.7;
    const trainingData = await db.exportTrainingData(minQualityScore);
    
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

/**
 * Function to start the server
 */
async function startServer() {
  try {
    // Kill any existing process on port 3000
    await killExistingProcess();

    // Clean up if server exists
    if (server) {
      await cleanup();
    }

    server = app.listen(PORT);
    
    server.on('error', async (err) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use. Please free the port and try again.`);
      } else {
        logger.error(`Server error: ${err.message}`);
      }
      await cleanup();
      process.exit(1);
    });

    server.on('listening', () => {
      logger.info(`Server is running on port ${PORT}`);
    });

    return server;
  } catch (err) {
    logger.error(`Error starting server: ${err.message}`);
    await cleanup();
    process.exit(1);
  }
}

// Suppress the punycode deprecation warning
process.noDeprecation = true;

// Start the server
startServer().catch(async err => {
  logger.error(`Failed to start server: ${err.message}`);
  await cleanup();
  process.exit(1);
});
