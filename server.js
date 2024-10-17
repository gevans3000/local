// server.js

require('dotenv').config();
const express = require('express');
const OpenAI = require('openai'); // Import OpenAI directly
const path = require('path');
const fs = require('fs');
const db = require('./database'); // Import the database module

const app = express();
app.use(express.json()); // Middleware to parse JSON bodies

// Serve static files (JavaScript, CSS, etc.) from the project directory
app.use(express.static(__dirname));

// Initialize OpenAI client with the API key directly
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,  // Your API key from .env
});

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
    // Save user question to the database
    db.run(`
      INSERT INTO conversations (user, message, timestamp)
      VALUES (?, ?, ?)
    `, ['You', question, timestamp], function(err) {
      if (err) {
        console.error('Error inserting user message:', err.message);
      } else {
        console.log(`User message saved with ID: ${this.lastID}`);
      }
    });

    // Get response from OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: question }],
      temperature: 0.7,
    });

    const answer = response.choices[0].message.content;

    // Save GPT-4 response to the database
    db.run(`
      INSERT INTO conversations (user, message, timestamp)
      VALUES (?, ?, ?)
    `, ['GPT-4o-mini', answer, timestamp], function(err) {
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
