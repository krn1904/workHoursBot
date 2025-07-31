const Database = require('./database');
const MessageParser = require('./messageParser');
const Commands = require('./commands');
const schedule = require('node-schedule');

// This function attaches all handlers and logic to a provided TelegramBot instance
function setupWorkLoggerBot(bot) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
  if (!token || !authorizedUserId) {
    throw new Error('Missing required environment variables: TELEGRAM_BOT_TOKEN and AUTHORIZED_USER_ID');
  }

  const db = new Database();
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
      await bot.sendMessage(authorizedUserId, '⏰ Don\'t forget to log your work hours today!');
      scheduleDailyReminder();
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
    if (userId !== authorizedUserId) {
      await bot.sendMessage(chatId, '🚫 Unauthorized access. This bot is for personal use only.');
      return;
    }
    if (text.trim().toLowerCase() === 'hi') {
      await sendGreeting();
      return;
    }
    if (text.startsWith('/')) {
      await handleCommand(chatId, text);
      return;
    }
    const parsed = parser.parseMessage(text);
    if (parsed.isValidWorkLog) {
      await logWorkEntry(chatId, parsed, text);
    } else {
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
      const result = await db.logWorkEntry(
        parsed.date,
        parsed.hours,
        parsed.tag,
        originalMessage
      );
      const hoursText = parser.formatHours(parsed.hours);
      const tagText = parsed.tag ? ` under '${parsed.tag}'` : '';
      const dateText = parsed.date === require('moment')().format('YYYY-MM-DD') ? 'today' : parsed.date;
      const response = `✅ Logged ${hoursText} hours for ${dateText}${tagText}.`;
      await bot.sendMessage(chatId, response);
    } catch (error) {
      console.error('Error logging work entry:', error);
      await bot.sendMessage(chatId, '❌ Error saving your work log. Please try again.');
    }
  }

  // Attach handlers and schedule reminders
  setupHandlers();
  sendGreeting();
  scheduleDailyReminder();
}

module.exports = setupWorkLoggerBot;