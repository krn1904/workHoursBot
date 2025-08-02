const Database = require('./database');
const MessageParser = require('./messageParser');
const Commands = require('./commands');
const schedule = require('node-schedule');

// This function attaches all handlers and logic to a provided TelegramBot instance
async function setupWorkLoggerBot(bot) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
  if (!token || !authorizedUserId) {
    throw new Error('Missing required environment variables: TELEGRAM_BOT_TOKEN and AUTHORIZED_USER_ID');
  }

  const db = new Database();
  // Ensure database connection is established before proceeding
  await db.connectToMongoDB();
  
  const parser = new MessageParser();
  const commands = new Commands(db, parser);

  // Helper to get a random time between 11:00 and 23:59
  function getRandomReminderTime() {
    const min = 11 * 60; // 11:00 in minutes
    const max = 23 * 60 + 59; // 23:59 in minutes
    const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
    const hours = Math.floor(randomMinutes / 60);
    const minutes = randomMinutes % 60;
    return { hours, minutes };
  }

  // Schedule a daily reminder at a random time
  function scheduleDailyReminder() {
    const { hours, minutes } = getRandomReminderTime();
    const rule = new schedule.RecurrenceRule();
    rule.tz = 'Etc/UTC';
    rule.hour = hours;
    rule.minute = minutes;

    if (scheduleDailyReminder.reminderJob) {
      scheduleDailyReminder.reminderJob.cancel();
    }

    scheduleDailyReminder.reminderJob = schedule.scheduleJob(rule, async () => {
      try {
        await bot.sendMessage(authorizedUserId, '⏰ Don\'t forget to log your work hours today!');
        scheduleDailyReminder();
      } catch (error) {
        console.error('Error sending reminder:', error);
      }
    });
    console.log(`Scheduled daily reminder at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} UTC`);
  }

  // Send greeting message to user
  async function sendGreeting() {
    try {
      const { cycleStart, cycleEnd } = commands.getCurrentPayCycle();
      const greeting = `🤖 **Work Hours Bot is Ready!**\n\n` +
        `👋 Hello! Your work hours tracking bot is now active.\n\n` +
        `📅 **Current Pay Cycle:** ${cycleStart} to ${cycleEnd}\n\n` +
        `💡 **Quick Start:**\n` +
        `• Send a message like "Worked 6 hours today"\n` +
        `• Use /help to see all commands\n` +
        `• Use /paycycle to check current cycle hours`;
      await bot.sendMessage(authorizedUserId, greeting, { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('Error sending greeting:', error);
    }
  }

  // Configure all bot event handlers
  function setupHandlers() {
    bot.on('message', async (msg) => {
      try {
        await handleMessage(msg);
      } catch (error) {
        console.error('Error handling message:', error);
        bot.sendMessage(msg.chat.id, '❌ An error occurred. Please try again.');
      }
    });
  }

  // Main message processing logic
  async function handleMessage(msg) {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;
    
    console.log(`Handling message from user ${userId} in chat ${chatId}: "${text}"`);
    console.log(`Authorized user ID: ${authorizedUserId}`);
    
    if (userId !== authorizedUserId) {
      console.log('Unauthorized user, sending rejection message');
      await bot.sendMessage(chatId, '🚫 Unauthorized access. This bot is for personal use only.');
      return;
    }
    
    if (text.trim().toLowerCase() === 'hi') {
      console.log('Greeting message detected, sending greeting');
      await sendGreeting();
      return;
    }
    
    if (text.startsWith('/')) {
      console.log('Command detected:', text);
      await handleCommand(chatId, text);
      return;
    }
    
    console.log('Parsing message for work log...');
    const parsed = parser.parseMessage(text);
    console.log('Parse result:', JSON.stringify(parsed, null, 2));
    
    if (parsed.isValidWorkLog) {
      console.log('Valid work log detected, logging entry...');
      await logWorkEntry(chatId, parsed, text);
    } else {
      console.log('Invalid work log, sending help message');
      await bot.sendMessage(chatId, 
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
  async function handleCommand(chatId, text) {
    const command = text.split(' ')[0].toLowerCase();
    const arg = text.split(' ').slice(1).join(' ');
    let response;
    switch (command) {
      case '/summary':
        response = await commands.handleSummary();
        break;
      case '/today':
        response = await commands.handleToday();
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
      default:
        response = commands.getHelpMessage();
        break;
    }
    await bot.sendMessage(chatId, response, { parse_mode: 'Markdown' });
  }

  // Save work entry to database and send confirmation
  async function logWorkEntry(chatId, parsed, originalMessage) {
    try {
      console.log('Attempting to log work entry to database...');
      console.log('Entry data:', { date: parsed.date, hours: parsed.hours, tag: parsed.tag });
      
      const result = await db.logWorkEntry(
        parsed.date,
        parsed.hours,
        parsed.tag,
        originalMessage
      );
      
      console.log('Database entry saved successfully:', result);
      
      const hoursText = parser.formatHours(parsed.hours);
      const tagText = parsed.tag ? ` under '${parsed.tag}'` : '';
      const dateText = parsed.date === require('moment')().format('YYYY-MM-DD') ? 'today' : parsed.date;
      const response = `✅ Logged ${hoursText} hours for ${dateText}${tagText}.`;
      
      console.log('Sending confirmation message:', response);
      await bot.sendMessage(chatId, response);
      console.log('Confirmation message sent successfully');
      
    } catch (error) {
      console.error('Error logging work entry:', error);
      console.log('Sending error message to user');
      await bot.sendMessage(chatId, '❌ Error saving your work log. Please try again.');
    }
  }

  // Attach handlers and schedule reminders
  setupHandlers();
  // Removed automatic greeting to avoid network errors on cold start
  // sendGreeting();
  scheduleDailyReminder();
}

module.exports = setupWorkLoggerBot;