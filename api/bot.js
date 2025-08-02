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

    // Initialize bot instance only once for serverless efficiency
    if (!bot) {
      console.log('Creating new TelegramBot instance...');
      bot = new TelegramBot(token);
      
      if (!isSetup) {
        console.log('Setting up bot handlers...');
        await setupWorkLoggerBot(bot);
        isSetup = true;
        console.log('Bot setup completed successfully');
      }
    }

    if (req.method === 'POST') {
      try {
        // Process the Telegram update and get response
        const response = await processUpdateWithResponse(req.body);
        
        if (response) {
          // Send response directly back to Telegram via webhook response
          // This avoids outbound HTTP requests that can fail in serverless environments
          return res.status(200).json({
            method: 'sendMessage',
            chat_id: response.chatId,
            text: response.text,
            parse_mode: response.parseMode || undefined
          });
        } else {
          // No response needed, acknowledge receipt
          return res.status(200).json({ ok: true });
        }
        
      } catch (updateError) {
        console.error('Error processing update:', updateError);
        return res.status(200).json({ ok: true });
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
// This approach works better in serverless environments where outbound connections may be restricted
async function processUpdateWithResponse(update) {
  if (!update.message) {
    return null;
  }

  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);

  // Check if user is authorized to use this bot
  if (userId !== authorizedUserId) {
    return {
      chatId,
      text: '🚫 Unauthorized access. This bot is for personal use only.'
    };
  }

  // Handle greeting message
  if (text.trim().toLowerCase() === 'hi') {
    return {
      chatId,
      text: `🤖 **Work Hours Bot is Ready!**\n\n👋 Hello! Your work hours tracking bot is now active.\n\n💡 **Quick Start:**\n• Send a message like "Worked 6 hours today"\n• Use /help to see all commands`,
      parseMode: 'Markdown'
    };
  }

  // Handle bot commands
  if (text.startsWith('/')) {
    const command = text.split(' ')[0].toLowerCase();
    const arg = text.split(' ').slice(1).join(' ');
    
    try {
      // Initialize database and command handler
      const Database = require('../database');
      const MessageParser = require('../messageParser');
      const Commands = require('../commands');
      
      const db = new Database();
      await db.connectToMongoDB();
      const parser = new MessageParser();
      const commands = new Commands(db, parser);
      
      let response;
      
      switch (command) {
        case '/today':
          response = await commands.handleToday();
          break;
        case '/summary':
          response = await commands.handleSummary();
          break;
        case '/log':
          response = await commands.handleLog();
          break;
        case '/category':
          response = await commands.handleCategory(arg);
          break;
        case '/paycycle':
          response = await commands.handlePayCycle();
          break;
        case '/help':
          response = commands.getHelpMessage();
          break;
        default:
          response = `❌ Unknown command: ${command}\n\nUse /help to see available commands.`;
          break;
      }
      
      return {
        chatId,
        text: response,
        parseMode: 'Markdown'
      };
      
    } catch (error) {
      console.error('Error processing command:', error);
      return {
        chatId,
        text: '❌ Error processing command. Please try again.'
      };
    }
  }

  // Parse message for work log entries
  const MessageParser = require('../messageParser');
  const parser = new MessageParser();
  const parsed = parser.parseMessage(text);

  if (parsed.isValidWorkLog) {
    try {
      // Save work entry to database
      const Database = require('../database');
      const db = new Database();
      await db.connectToMongoDB();
      
      const result = await db.logWorkEntry(
        parsed.date,
        parsed.hours,
        parsed.tag,
        text
      );
      
      // Format confirmation message
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
    // Message doesn't contain valid work log, provide help
    return {
      chatId,
      text: `🤔 I didn't detect work hours in your message.\n\n💡 Try messages like:\n• "Worked 6 hours today"\n• "5.5 hrs on freelance"\n• "Yesterday I did 3 hours"\n\nOr use /help for more information.`
    };
  }
} 