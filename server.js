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
const MAX_PORT_ATTEMPTS = 5;

// Function to check if port is valid
function isValidPort(port) {
  return Number.isInteger(port) && port >= 0 && port < 65536;
}

/**
 * Initialize OpenAI clients with configurable base URLs and API keys
 */
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
 * Function to start the server with port handling
 */
function startServer(port, attempt = 1) {
  if (attempt > MAX_PORT_ATTEMPTS) {
    logger.error('Maximum port attempts reached. Server could not start.');
    process.exit(1);
  }

  if (!isValidPort(port)) {
    logger.warn(`Invalid port number: ${port}. Trying port ${port + 1}`);
    return startServer(port + 1, attempt + 1);
  }

  app.listen(port, () => {
    logger.info(`Server is running on port ${port}`);
  }).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${port} is in use. Trying port ${port + 1}`);
      startServer(port + 1, attempt + 1);
    } else {
      logger.error(`Server error: ${err.message}`);
      process.exit(1);
    }
  });
}

// Start the server with initial PORT
startServer(PORT);
