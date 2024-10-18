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

// Initialize OpenAI client with the API key directly
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Your API key from .env
});

const MODEL = "gpt-4o-mini"; // Define the model name

// Serve the HTML file at the root URL
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Handle POST requests to '/ask'
app.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  const timestamp = new Date().toLocaleString();

  try {
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
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content;
    const tokensUsed = response.usage ? response.usage.total_tokens : null;

    // Save GPT-4 response to the database with tokens
    db.run(`
      INSERT INTO conversations (user, message, timestamp, tokens)
      VALUES (?, ?, ?, ?)
    `, [MODEL, answer, timestamp, tokensUsed], function(err) {
      if (err) {
        console.error('Error inserting GPT-4 message:', err.message);
      } else {
        console.log(`GPT-4 message saved with ID: ${this.lastID}`);
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
