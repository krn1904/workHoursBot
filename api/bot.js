/**
 * Telegram Bot Webhook Handler for Vercel Serverless Functions
 * 
 * This module handles incoming webhook requests from Telegram in a serverless
 * environment. It processes messages, executes commands, and returns responses
 * directly through the webhook response mechanism for optimal performance.
 * 
 * Features:
 * - Serverless-optimized bot initialization
 * - Direct webhook response (no outbound HTTP calls)
 * - Authorization checking for security
 * - Natural language work log parsing
 * - Command processing and response generation
 * - Admin commands for database management
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const TelegramBot = require('node-telegram-bot-api');
const setupWorkLoggerBot = require('../src/bot/bot');

/**
 * Bot instance and setup state management
 * These variables persist across function invocations for efficiency
 */
let bot;
let isSetup = false;

/**
 * Main webhook handler function for Vercel serverless deployment
 * 
 * This function is the entry point for all incoming Telegram webhook requests.
 * It handles bot initialization, message processing, and response generation
 * in a serverless-optimized manner.
 * 
 * @param {Object} req - Express request object from Vercel
 * @param {Object} res - Express response object from Vercel
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  try {
    // Validate required environment variables
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const authorizedUserId = process.env.AUTHORIZED_USER_ID;

  // Only require token and authorizedUserId at this layer. DB may be optional for some commands.
  if (!token || !authorizedUserId) {
      console.error('Missing required environment variables');
      return res.status(500).json({ error: 'Configuration error' });
    }

    // Initialize bot instance only once per cold start for efficiency
    if (!bot) {
      console.log('Creating new TelegramBot instance...');
      bot = new TelegramBot(token);
      
      // In serverless, avoid heavy setup/DB connection on cold start.
      // Only run setup when explicitly enabled.
      if (!isSetup && process.env.ENABLE_BOT_SETUP === 'true') {
        try {
          console.log('Setting up bot handlers (explicitly enabled)...');
          await setupWorkLoggerBot(bot);
          console.log('Bot setup completed successfully');
        } catch (e) {
          console.warn('⚠️ Bot setup skipped/failed:', e.message);
        }
        isSetup = true;
      } else {
        console.log('⏭️ Skipping bot setup on serverless cold start (set ENABLE_BOT_SETUP=true to enable).');
        isSetup = true;
      }
    }

    // Only handle POST requests (webhook updates)
    if (req.method === 'POST') {
      try {
        // Process the Telegram update and get response
        const response = await processUpdateWithResponse(req.body);
        
        if (response) {
          // Use bot.sendMessage for reliable message delivery
          try {
            const options = {};
            if (response.parseMode) {
              options.parse_mode = response.parseMode;
            }
            await bot.sendMessage(response.chatId, response.text, options);
            return res.status(200).json({ ok: true });
          } catch (sendError) {
            console.error('Failed to send message:', sendError.message);
            console.error('Full error:', sendError);
            // Try again without parse_mode
            try {
              await bot.sendMessage(response.chatId, response.text);
              return res.status(200).json({ ok: true });
            } catch (retryError) {
              console.error('Retry also failed:', retryError.message);
              return res.status(200).json({ ok: true });
            }
          }
        } else {
          // No response needed, acknowledge receipt
          return res.status(200).json({ ok: true });
        }
        
      } catch (updateError) {
        console.error('Error processing update:', updateError);
        // Always return 200 to prevent Telegram from retrying
        return res.status(200).json({ ok: true });
      }
      
    } else {
      // Return 405 for non-POST requests
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

/**
 * Processes Telegram updates and returns response data instead of sending directly
 * 
 * This approach is optimized for serverless environments where outbound HTTP
 * connections may be restricted or unreliable. By returning response data,
 * we can use Telegram's webhook response mechanism.
 * 
 * @param {Object} update - Telegram update object
 * @returns {Promise<Object|null>} Response object or null if no response needed
 */
async function processUpdateWithResponse(update) {
  // Only process message updates
  if (!update.message) {
    return null;
  }

  const msg = update.message;
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;
  const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);

  // Security check: verify user is authorized
  if (userId !== authorizedUserId) {
    return {
      chatId,
      text: '🚫 Unauthorized access. This bot is for personal use only.'
    };
  }

  // Handle greeting message for user-friendly onboarding
  if (text && text.trim().toLowerCase() === 'hi') {
    return {
      chatId,
      text: `🤖 <b>Work Hours Bot is Ready!</b>\n\n👋 Hello! Your work hours tracking bot is now active.\n\n💡 <b>Quick Start:</b>\n• Send a message like "Worked 6 hours today"\n• Use /help to see all commands`,
      parseMode: 'HTML'
    };
  }

  // Handle bot commands (starting with /)
  if (text && text.startsWith('/')) {
    return await handleCommand(text, chatId);
  }

  // Handle natural language work log messages
  if (text) {
    return await handleWorkLogMessage(text, chatId);
  }

  // No processable content in the message
  return null;
}

/**
 * Handles bot commands and returns appropriate responses
 * 
 * @param {string} text - Command text from user
 * @param {number} chatId - Telegram chat ID for response
 * @returns {Promise<Object>} Response object with chat ID and message
 */
async function handleCommand(text, chatId) {
  const command = text.split(' ')[0].toLowerCase();
  const arg = text.split(' ').slice(1).join(' ');
  
  try {
    // Initialize parser (no DB needed for some commands)
    const MessageParser = require('../src/bot/handlers/messageParser');
    const Commands = require('../src/bot/handlers/commands');
    const parser = new MessageParser();

    let response;
    
    // Route commands to appropriate handlers
    switch (command) {
      case '/today':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleToday();
        }
        break;
      case '/summary':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleSummary();
        }
        break;
      case '/log':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleLog();
        }
        break;
      case '/category':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleCategory(arg);
        }
        break;
      case '/paycycle':
        {
          // arg contains optional tag filter (e.g., "project1", "freelance")
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handlePayCycle(arg);
        }
        break;
      case '/paycycles':
        {
          // arg contains optional tag filter for all 5 pay cycles
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handlePayCycles(arg);
        }
        break;
      case '/delete':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleDelete(arg);
        }
        break;
      case '/help':
      case '/start':
        {
          // Help doesn't need DB
          const commands = new Commands(null, parser);
          response = commands.getHelpMessage();
        }
        break;
      case '/stats':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleStats();
        }
        break;
      case '/validate':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleValidate();
        }
        break;
      case '/reset':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleReset(arg);
        }
        break;
      case '/backup':
        {
          const Database = require('../src/bot/services/database');
          const db = new Database();
          await db.connectToMongoDB();
          const commands = new Commands(db, parser);
          response = await commands.handleBackup();
        }
        break;
      case '/reminder':
        {
          // Reminder info/test output doesn't need DB
          const commands = new Commands(null, parser);
          response = await commands.handleReminder(arg);
        }
        break;
      default:
        response = `❌ Unknown command: ${command}\n\nUse /help to see available commands.`;
        break;
    }
    
    // Safety check: ensure response is set
    if (!response || typeof response !== 'string') {
      console.error('Invalid response for command:', command);
      response = '❌ Error processing command. Please try again.';
    }
    
    return {
      chatId,
      text: response,
      parseMode: 'HTML'
    };
    
  } catch (error) {
    console.error('Error processing command:', error);
    return {
      chatId,
      text: '❌ Error processing command. Please try again.'
    };
  }
}

/**
 * Handles natural language work log messages
 * 
 * @param {string} text - User message text
 * @param {number} chatId - Telegram chat ID for response
 * @returns {Promise<Object>} Response object with chat ID and message
 */
async function handleWorkLogMessage(text, chatId) {
  // Parse message for work log entries
  const MessageParser = require('../src/bot/handlers/messageParser');
  const parser = new MessageParser();
  const parsed = parser.parseMessage(text);

  if (parsed.isValidWorkLog) {
    try {
      // If DB isn't configured, inform the user gracefully instead of failing silently
      if (!process.env.MONGODB_URI) {
        return {
          chatId,
          text: `ℹ️ I can see you logged ${parser.formatHours(parsed.hours)}h for ${parsed.date}${parsed.tag ? ` under '${parsed.tag}'` : ''}, but the database isn’t configured.\n\nPlease set MONGODB_URI in your deployment environment to save entries.`
        };
      }
      // Save work entry to database
      const Database = require('../src/bot/services/database');
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
    // Message doesn't contain valid work log, provide helpful guidance
    return {
      chatId,
      text: `🤔 I didn't detect work hours in your message.\n\n💡 Try messages like:\n• "Worked 6 hours today"\n• "5.5 hrs on freelance"\n• "Yesterday I did 3 hours"\n\nOr use /help for more information.`
    };
  }
}
