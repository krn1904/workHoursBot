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
        // Note: This won't work in webhook mode, but keeping for compatibility
        console.log('Daily reminder scheduled but not sent in webhook mode');
        scheduleDailyReminder();
      } catch (error) {
        console.error('Error with reminder:', error);
      }
    });
    console.log(`Scheduled daily reminder at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} UTC`);
  }

  // Schedule reminders (though they won't send in webhook mode)
  scheduleDailyReminder();
}

module.exports = setupWorkLoggerBot;