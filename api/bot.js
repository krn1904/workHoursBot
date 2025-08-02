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

    if (!token || !authorizedUserId || !mongoUri) {
      console.error('Missing required environment variables');
      return res.status(500).json({ error: 'Configuration error' });
    }

    if (!bot) {
      console.log('Creating new TelegramBot instance...');
      // Create bot without webhook for serverless - we'll handle responses manually
      bot = new TelegramBot(token);
      
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
      
      try {
        // Process the update and get response
        const response = await processUpdateWithResponse(req.body);
        
        if (response) {
          console.log('Sending response via webhook:', response);
          // Send response directly back to Telegram via webhook response
          return res.status(200).json({
            method: 'sendMessage',
            chat_id: response.chatId,
            text: response.text,
            parse_mode: response.parseMode || undefined
          });
        } else {
          console.log('No response needed, sending OK');
          return res.status(200).json({ ok: true });
        }
        
      } catch (updateError) {
        console.error('Error processing update:', updateError);
        return res.status(200).json({ ok: true }); // Always return 200 to Telegram
      }
      
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

// Process update and return response instead of sending directly
async function processUpdateWithResponse(update) {
  if (!update.message) {
    return null;
  }

  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);

  console.log(`Processing message from user ${userId} in chat ${chatId}: "${text}"`);
  console.log(`Authorized user ID: ${authorizedUserId}`);

  if (userId !== authorizedUserId) {
    console.log('Unauthorized user, returning rejection message');
    return {
      chatId,
      text: '🚫 Unauthorized access. This bot is for personal use only.'
    };
  }

  if (text.trim().toLowerCase() === 'hi') {
    console.log('Greeting message detected, returning greeting');
    return {
      chatId,
      text: `🤖 **Work Hours Bot is Ready!**\n\n👋 Hello! Your work hours tracking bot is now active.\n\n💡 **Quick Start:**\n• Send a message like "Worked 6 hours today"\n• Use /help to see all commands`,
      parseMode: 'Markdown'
    };
  }

  if (text.startsWith('/')) {
    console.log('Command detected:', text);
    const command = text.split(' ')[0].toLowerCase();
    
    if (command === '/help') {
      return {
        chatId,
        text: `🤖 **Work Hours Tracker Bot**\n\n📝 **Log Work Hours:**\nJust send a natural message like:\n• "Worked 6 hours today"\n• "5.5 hrs on freelance project"\n• "Yesterday I did 3 hours of coding"\n\n📊 **Commands:**\n• \`/today\` - Show today's logged hours\n• \`/summary\` - Weekly summary\n• \`/log\` - Recent entries\n• \`/paycycle\` - Current pay cycle summary\n• \`/help\` - Show this help\n\n💡 The bot automatically detects hours and dates from your messages!`,
        parseMode: 'Markdown'
      };
    }
    
    // For other commands, we'd need to implement them here or use a different approach
    return {
      chatId,
      text: 'Command processing not yet implemented in webhook mode. Use /help for available options.'
    };
  }

  // Parse message for work log
  console.log('Parsing message for work log...');
  const MessageParser = require('../messageParser');
  const parser = new MessageParser();
  const parsed = parser.parseMessage(text);
  console.log('Parse result:', JSON.stringify(parsed, null, 2));

  if (parsed.isValidWorkLog) {
    console.log('Valid work log detected, attempting to log entry...');
    try {
      const Database = require('../database');
      const db = new Database();
      await db.connectToMongoDB();
      
      const result = await db.logWorkEntry(
        parsed.date,
        parsed.hours,
        parsed.tag,
        text
      );
      
      console.log('Database entry saved successfully:', result);
      
      const hoursText = parser.formatHours(parsed.hours);
      const tagText = parsed.tag ? ` under '${parsed.tag}'` : '';
      const dateText = parsed.date === require('moment')().format('YYYY-MM-DD') ? 'today' : parsed.date;
      
      return {
        chatId,
        text: `✅ Logged ${hoursText} hours for ${dateText}${tagText}.`
      };
      
    } catch (error) {
      console.error('Error logging work entry:', error);
      return {
        chatId,
        text: '❌ Error saving your work log. Please try again.'
      };
    }
  } else {
    console.log('Invalid work log, returning help message');
    return {
      chatId,
      text: `🤔 I didn't detect work hours in your message.\n\n💡 Try messages like:\n• "Worked 6 hours today"\n• "5.5 hrs on freelance"\n• "Yesterday I did 3 hours"\n\nOr use /help for more information.`
    };
  }
} 