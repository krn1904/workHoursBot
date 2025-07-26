// Load environment variables from .env file
require('dotenv').config();
const express = require('express');
const WorkLoggerBot = require('./bot');

// Initialize Express server for health checks and deployment compatibility
// Initialize Express server
const app = express();
const PORT = process.env.PORT || 3000;

// Health check endpoint - returns bot status and timestamp
// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'running',
    message: 'Telegram Work Logger Bot is active',
    timestamp: new Date().toISOString()
  });
});

// Additional health check for deployment platforms like Railway, Render
// Health check for deployment platforms
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy' });
});

// Initialize the Telegram bot with error handling
// Initialize bot
let bot;

try {
  bot = new WorkLoggerBot();
  console.log('✅ Work Logger Bot initialized successfully');
} catch (error) {
  console.error('❌ Failed to initialize bot:', error.message);
  process.exit(1);
}

// Start the Express server
// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Bot is ready to receive messages from user ID: ${process.env.AUTHORIZED_USER_ID}`);
});

// Handle graceful shutdown when deployment platform sends SIGTERM
// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  if (bot) {
    bot.bot.stopPolling();
    bot.db.close();
  }
  process.exit(0);
});