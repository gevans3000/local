// server.js

const favicon = require('serve-favicon');
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai'); // Import OpenAI directly
const path = require('path');
const db = require('./database'); // Import the database module
const { encode } = require('gpt-3-encoder'); // Import the encoder

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(favicon(path.join(__dirname, 'favicon.ico')));

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

// Serve the HTML file at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle POST requests to '/ask'
app.post('/ask', async (req, res) => {
  const { question, model, chatBoxNumber } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

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
      return res.status(400).json({ error: 'Invalid model specified.' });
    }

    // Calculate tokens used for the user question
    const tokensUsedUser = encode(question).length;

    // Save user question to the database with tokens and chatBoxNumber
    await run(`
      INSERT INTO conversations (chatBoxNumber, modelName, user, message, timestamp, tokens)
      VALUES (?, NULL, 'You', ?, ?, ?)
    `, [chatBoxNumber, question, timestamp, tokensUsedUser]);

    console.log(`User message saved for chatBoxNumber ${chatBoxNumber}`);

    // Get response from OpenAI
    const response = await openaiClient.chat.completions.create({
      model: selectedModel,
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content;
    const tokensUsed = response.usage ? response.usage.total_tokens : null;

    // Save GPT response to the database with tokens and chatBoxNumber
    await run(`
      INSERT INTO conversations (chatBoxNumber, modelName, user, message, timestamp, tokens)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [chatBoxNumber, selectedModel, responseUserIdentifier, answer, timestamp, tokensUsed]);

    console.log(`AI message saved for chatBoxNumber ${chatBoxNumber}`);

    res.json({ answer, usage: response.usage });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Handle POST requests to '/get-context'
app.post('/get-context', async (req, res) => {
  const { chatBoxNumbers } = req.body;
  if (!Array.isArray(chatBoxNumbers) || chatBoxNumbers.length === 0) {
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
  } catch (error) {
    console.error('Error retrieving context:', error.message);
    res.status(500).json({ error: 'Failed to retrieve context.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
