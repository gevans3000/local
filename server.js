// server.js

const favicon = require('serve-favicon');
require('dotenv').config();
const express = require('express');
const OpenAI = require('openai'); // Import OpenAI directly
const path = require('path');
const fs = require('fs');
const db = require('./database'); // Import the database module
const { encode } = require('gpt-3-encoder'); // Import the encoder

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies
app.use(favicon(path.join(__dirname, 'favicon.ico')));

// Serve static files (JavaScript, CSS, etc.) from the project directory
app.use(express.static(__dirname));

// Initialize OpenAI clients with different configurations
const openaiDefault = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Your primary OpenAI API key from .env
});

const openaiNVIDIA = new OpenAI({
  apiKey: process.env.NVIDIA_API_KEY, // NVIDIA API key from .env
  baseURL: 'https://integrate.api.nvidia.com/v1', // NVIDIA API base URL
});

const MODEL_DEFAULT = "gpt-4o-mini";
const MODEL_NVIDIA = "nvidia/llama-3.1-nemotron-70b-instruct";

// Serve the HTML file at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle POST requests to '/ask'
app.post('/ask', async (req, res) => {
  const { question, model } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const selectedModel = model || MODEL_DEFAULT;
  const timestamp = new Date().toLocaleString();

  try {
    let openaiClient;
    let responseUser;

    // Select the appropriate OpenAI client based on the model
    if (selectedModel === MODEL_DEFAULT || selectedModel === "gpt-4o-mini-2024-07-18") {
      openaiClient = openaiDefault;
      responseUser = MODEL_DEFAULT;
    } else if (selectedModel === MODEL_NVIDIA) {
      openaiClient = openaiNVIDIA;
      responseUser = MODEL_NVIDIA;
    } else {
      return res.status(400).json({ error: 'Invalid model specified.' });
    }

    // Calculate tokens used for the user question
    const tokensUsedUser = encode(question).length;

    // Save user question to the database with tokens
    db.run(`
      INSERT INTO conversations (user, message, timestamp, tokens)
      VALUES (?, ?, ?, ?)
    `, ['You', question, timestamp, tokensUsedUser], function(err) {
      if (err) {
        console.error('Error inserting user message:', err.message);
      } else {
        console.log(`User message saved with ID: ${this.lastID}`);
      }
    });

    // Get response from OpenAI
    const response = await openaiClient.chat.completions.create({
      model: selectedModel,
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content;
    const tokensUsed = response.usage ? response.usage.total_tokens : null;

    // Determine user identifier based on the model
    let responseUserIdentifier;
    if (selectedModel === MODEL_DEFAULT || selectedModel === "gpt-4o-mini-2024-07-18") {
      responseUserIdentifier = MODEL_DEFAULT;
    } else if (selectedModel === MODEL_NVIDIA) {
      responseUserIdentifier = MODEL_NVIDIA;
    }

    // Save GPT response to the database with tokens
    db.run(`
      INSERT INTO conversations (user, message, timestamp, tokens)
      VALUES (?, ?, ?, ?)
    `, [responseUserIdentifier, answer, timestamp, tokensUsed], function(err) {
      if (err) {
        console.error('Error inserting GPT message:', err.message);
      } else {
        console.log(`GPT message saved with ID: ${this.lastID}`);
      }
    });

    res.json({ answer, usage: response.usage });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
