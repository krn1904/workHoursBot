const TelegramBot = require('node-telegram-bot-api');
const setupWorkLoggerBot = require('../bot');

// Only create and set up the bot once (on cold start)
let bot;
let isSetup = false;

module.exports = async (req, res) => {
  try {
    // Check if required environment variables are set
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const authorizedUserId = process.env.AUTHORIZED_USER_ID;
    const mongoUri = process.env.MONGODB_URI;
    const webhookUrl = process.env.WEBHOOK_URL;

    if (!token || !authorizedUserId || !mongoUri) {
      console.error('Missing required environment variables');
      return res.status(500).json({ error: 'Configuration error' });
    }

    if (!bot) {
      console.log('Creating new TelegramBot instance...');
      
      // Create bot in webhook mode with proper options
      const options = {
        webHook: {
          port: process.env.PORT || 3000
        }
      };
      
      // If webhook URL is provided, set it up
      if (webhookUrl) {
        console.log('Setting up webhook URL:', webhookUrl);
        options.webHook.host = '0.0.0.0';
        bot = new TelegramBot(token, options);
        
        // Set webhook URL
        try {
          await bot.setWebHook(webhookUrl);
          console.log('Webhook set successfully');
        } catch (webhookError) {
          console.error('Error setting webhook:', webhookError);
        }
      } else {
        // Fallback to basic webhook mode
        console.log('Creating bot without explicit webhook URL');
        bot = new TelegramBot(token);
      }
      
      if (!isSetup) {
        console.log('Setting up bot handlers...');
        await setupWorkLoggerBot(bot);
        isSetup = true;
        console.log('Bot setup completed successfully');
      }
    }

    if (req.method === 'POST') {
      console.log('Processing Telegram update...');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
      
      // Add debugging for the update processing
      try {
        await bot.processUpdate(req.body);
        console.log('Update processed successfully');
      } catch (updateError) {
        console.error('Error processing update:', updateError);
        throw updateError;
      }
      
      res.status(200).end();
    } else {
      res.status(405).end();
    }
  } catch (error) {
    console.error('Error in bot function:', error);
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message
    });
  }
}; 