const TelegramBot = require('node-telegram-bot-api');
const Database = require('./database');
const MessageParser = require('./messageParser');
const Commands = require('./commands');

// Main bot class that handles all Telegram interactions
class WorkLoggerBot {
  constructor() {
    // Load configuration from environment variables
    this.token = process.env.TELEGRAM_BOT_TOKEN;
    this.authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
    
    // Validate required environment variables
    if (!this.token || !this.authorizedUserId) {
      throw new Error('Missing required environment variables: TELEGRAM_BOT_TOKEN and AUTHORIZED_USER_ID');
    }

    // Initialize bot components
    this.bot = new TelegramBot(this.token, { polling: true });
    this.db = new Database();
    this.parser = new MessageParser();
    this.commands = new Commands(this.db, this.parser);

    // Set up message and error handlers
    this.setupHandlers();
    console.log('Telegram bot initialized and polling...');
  }

  // Configure all bot event handlers
  setupHandlers() {
    // Handle all incoming text messages
    // Handle text messages
    this.bot.on('message', async (msg) => {
      try {
        await this.handleMessage(msg);
      } catch (error) {
        console.error('Error handling message:', error);
        this.bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
      }
    });

    // Handle Telegram API polling errors
    // Handle polling errors
    this.bot.on('polling_error', (error) => {
      console.error('Polling error:', error);
    });

    // Clean shutdown on Ctrl+C
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log('Shutting down bot...');
      this.bot.stopPolling();
      this.db.close();
      process.exit(0);
    });
  }

  // Main message processing logic
  async handleMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    // Security: Only allow messages from authorized user
    // Security check - only authorized user
    if (userId !== this.authorizedUserId) {
      await this.bot.sendMessage(chatId, '🚫 Unauthorized access. This bot is for personal use only.');
      return;
    }

    // Route commands to command handler
    // Handle commands
    if (text.startsWith('/')) {
      await this.handleCommand(chatId, text);
      return;
    }

    // Parse natural language work log messages
    // Parse natural language work log
    const parsed = this.parser.parseMessage(text);
    
    if (parsed.isValidWorkLog) {
      // Log valid work entries to database
      await this.logWorkEntry(chatId, parsed, text);
    } else {
      // Provide helpful guidance for invalid messages
      // If it's not a work log, provide helpful guidance
      await this.bot.sendMessage(chatId, 
        '🤔 I didn\'t detect work hours in your message.\n\n' +
        '💡 Try messages like:\n' +
        '• "Worked 6 hours today"\n' +
        '• "5.5 hrs on freelance"\n' +
        '• "Yesterday I did 3 hours"\n\n' +
        'Or use /help for more information.'
      );
    }
  }

  // Handle bot commands like /summary, /today, etc.
  async handleCommand(chatId, text) {
    const command = text.split(' ')[0].toLowerCase();
    const arg = text.split(' ').slice(1).join(' ');
    let response;
    switch (command) {
      case '/summary':
        response = await this.commands.handleSummary();
        break;
      case '/today':
        response = await this.commands.handleToday();
        break;
      case '/log':
        response = await this.commands.handleLog();
        break;
      case '/category':
        response = await this.commands.handleCategory(arg);
        break;
      case '/paycycle':
        response = await this.commands.handlePayCycle();
        break;
      case '/help':
      default:
        response = this.commands.getHelpMessage();
        break;
    }
    await this.bot.sendMessage(chatId, response);
  }

  // Save work entry to database and send confirmation
  async logWorkEntry(chatId, parsed, originalMessage) {
    try {
      // Store in database
      const result = await this.db.logWorkEntry(
        parsed.date,
        parsed.hours,
        parsed.tag,
        originalMessage
      );

      // Format confirmation message
      const hoursText = this.parser.formatHours(parsed.hours);
      const tagText = parsed.tag ? ` under '${parsed.tag}'` : '';
      const dateText = parsed.date === require('moment')().format('YYYY-MM-DD') ? 'today' : parsed.date;

      const response = `✅ Logged ${hoursText} hours for ${dateText}${tagText}.`;
      
      await this.bot.sendMessage(chatId, response);
    } catch (error) {
      console.error('Error logging work entry:', error);
      await this.bot.sendMessage(chatId, '❌ Error saving your work log. Please try again.');
    }
  }
}

module.exports = WorkLoggerBot;