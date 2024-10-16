require('dotenv').config();
const express = require('express');
const OpenAI = require('openai'); // Import OpenAI directly
const path = require('path');
const fs = require('fs');

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
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Specify the model
      messages: [{ role: "user", content: req.body.question }], // Use the question from the request body
      temperature: 0.7, // Optional: Set temperature for response creativity
    });
    res.json({ 
      answer: response.choices[0].message.content,
      usage: response.usage // Include usage data
    }); // Send back the response and usage from OpenAI
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message }); // Send a server error response
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
