const TelegramBot = require('node-telegram-bot-api');
const setupWorkLoggerBot = require('../bot');

module.exports = async (req, res) => {
  try {
    // Check if required environment variables are set
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const authorizedUserId = process.env.AUTHORIZED_USER_ID;
    const mongoUri = process.env.MONGODB_URI;

    if (!token) {
      console.error('Missing TELEGRAM_BOT_TOKEN environment variable');
      return res.status(500).json({ error: 'Bot token not configured' });
    }

    if (!authorizedUserId) {
      console.error('Missing AUTHORIZED_USER_ID environment variable');
      return res.status(500).json({ error: 'Authorized user ID not configured' });
    }

    if (!mongoUri) {
      console.error('Missing MONGODB_URI environment variable');
      return res.status(500).json({ error: 'MongoDB URI not configured' });
    }

    // Only create and set up the bot once (on cold start)
    let bot;
    let isSetup = false;

    if (!bot) {
      console.log('Creating new TelegramBot instance...');
      bot = new TelegramBot(token);
      
      if (!isSetup) {
        console.log('Setting up bot handlers...');
        setupWorkLoggerBot(bot);
        isSetup = true;
        console.log('Bot setup completed successfully');
      }
    }

    if (req.method === 'POST') {
      console.log('Processing Telegram update...');
      await bot.processUpdate(req.body);
      res.status(200).end();
    } else {
      res.status(405).end();
    }
  } catch (error) {
    console.error('Error in bot function:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message,
      stack: error.stack 
    });
  }
}; 