// server.js

const favicon = require('serve-favicon');
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai'); // Import OpenAI directly
const path = require('path');
const db = require('./database'); // Import the database module
const { encode } = require('gpt-3-encoder'); // Import the encoder
const Joi = require('joi'); // Import Joi for input validation
const winston = require('winston'); // Import Winston for logging

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(favicon(path.join(__dirname, 'favicon.ico')));

// Setup Winston logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
  ),
  transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'error.log', level: 'error' }),
      new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// Serve static files (JavaScript, CSS, etc.) from the project directory
app.use(express.static(__dirname));

// Initialize OpenAI clients with different configurations
const openaiDefault = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Your primary OpenAI API key from .env
});

const openaiNVIDIA = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY, // NVIDIA API key from .env
  baseURL: 'https://integrate.api.nvidia.com/v1', // NVIDIA and Meta API base URL
});

// Define model constants
const MODEL_DEFAULT = "gpt-4o-mini";
const MODEL_OPENAI_ALTERNATE = "gpt-4o-mini-2024-07-18";
const MODEL_NVIDIA = "nvidia/llama-3.1-nemotron-70b-instruct";
const MODEL_META = "meta/llama-3.2-3b-instruct";

// Helper functions to promisify db.run and db.all
const run = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
};

const all = (sql, params = []) => {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};

// Define Joi schemas
const askSchema = Joi.object({
    question: Joi.string().min(1).required(),
    model: Joi.string().optional(),
    chatBoxNumber: Joi.number().integer().min(1).required(),
    context: Joi.array().items(
        Joi.object({
            user: Joi.string().required(),
            message: Joi.string().required(),
            timestamp: Joi.string().optional(),
            tokens: Joi.number().optional()
        })
    ).optional()
});

// Serve the HTML file at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle POST requests to '/ask'
app.post('/ask', async (req, res, next) => {
  // Validate request body
  const { error, value } = askSchema.validate(req.body);
  if (error) {
    logger.warn(`Validation error: ${error.details[0].message}`);
    return res.status(400).json({ error: error.details[0].message });
  }

  const { question, model, chatBoxNumber, context } = value;
  const selectedModel = model || MODEL_DEFAULT;
  const timestamp = new Date().toLocaleString();

  try {
    let openaiClient;
    let responseUserIdentifier;

    // Select the appropriate OpenAI client based on the model name prefix
    if (selectedModel.startsWith("gpt-")) {
      openaiClient = openaiDefault;
      responseUserIdentifier = selectedModel;
    } else if (selectedModel.startsWith("nvidia/") || selectedModel.startsWith("meta/")) {
      openaiClient = openaiNVIDIA;
      responseUserIdentifier = selectedModel;
    } else {
      logger.error(`Invalid model specified: ${selectedModel}`);
      return res.status(400).json({ error: 'Invalid model specified.' });
    }

    // Calculate tokens used for the user question
    const tokensUsedUser = encode(question).length;

    // Set user identifier based on chatBoxNumber
    const userIdentifier = `You${chatBoxNumber}`;

    // Save user question to the database with tokens and chatBoxNumber
    await run(`
      INSERT INTO conversations (chatBoxNumber, modelName, user, message, timestamp, tokens)
      VALUES (?, 'Human', ?, ?, ?, ?)
    `, [chatBoxNumber, userIdentifier, question, timestamp, tokensUsedUser]);

    logger.info(`User message saved for chatBoxNumber ${chatBoxNumber}`);

    // Prepare messages array for OpenAI
    let messages = [];

    if (Array.isArray(context) && context.length > 0) {
      context.forEach(msg => {
        if (msg.user.startsWith('You')) {
          messages.push({ role: 'user', content: msg.message });
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
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content;
    const tokensUsed = response.usage ? response.usage.total_tokens : null;

    // Save GPT response to the database with tokens and chatBoxNumber
    await run(`
      INSERT INTO conversations (chatBoxNumber, modelName, user, message, timestamp, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [chatBoxNumber, selectedModel, responseUserIdentifier, answer, timestamp, tokensUsed]);

    logger.info(`AI message saved for chatBoxNumber ${chatBoxNumber}`);

    res.json({ answer, usage: response.usage });
  } catch (err) {
    logger.error(`Error in /ask endpoint: ${err.message}`, { stack: err.stack });
    next(err); // Pass to the global error handler
  }
});

// Handle POST requests to '/get-context'
app.post('/get-context', async (req, res, next) => {
  const { chatBoxNumbers } = req.body;
  
  if (!Array.isArray(chatBoxNumbers) || chatBoxNumbers.length === 0) {
    logger.warn('Invalid chatBoxNumbers provided.');
    return res.status(400).json({ error: 'chatBoxNumbers must be a non-empty array.' });
  }

  try {
    // Create placeholders for SQL IN clause
    const placeholders = chatBoxNumbers.map(() => '?').join(',');
    const sql = `
      SELECT user, message, timestamp, tokens
      FROM conversations
      WHERE chatBoxNumber IN (${placeholders})
      ORDER BY datetime(timestamp) ASC
    `;
    const rows = await all(sql, chatBoxNumbers);

    res.json({ context: rows });
  } catch (err) {
    logger.error(`Error retrieving context: ${err.message}`, { stack: err.stack });
    res.status(500).json({ error: 'Failed to retrieve context.' });
  }
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
    logger.error('Unhandled error:', {
        message: err.message,
        stack: err.stack,
        status: err.status || 500,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip
    });

    const isOperational = err.isOperational || false;

    res.status(err.status || 500).json({
        error: isOperational ? err.message : 'An unexpected error occurred. Please try again later.'
    });
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Server running on http://localhost:${PORT}`);
});
