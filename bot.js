/**
 * Telegram Work Hours Logger Bot - Core Setup Module
 * 
 * This module sets up the main bot functionality by configuring database connections,
 * message parsing, and command handlers. It's designed to work with both polling
 * and webhook modes, though webhook mode is preferred for production deployment.
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const Database = require('./database');
const MessageParser = require('./messageParser');
const Commands = require('./commands');
const schedule = require('node-schedule');

/**
 * Sets up the Telegram bot with all necessary handlers and functionality
 * 
 * This function configures:
 * - Database connection (MongoDB)
 * - Message parsing for natural language work logs
 * - Command handlers for bot commands
 * - Daily reminder scheduling (note: not functional in webhook mode)
 * 
 * @param {TelegramBot} bot - The TelegramBot instance to configure
 * @throws {Error} If required environment variables are missing
 * @returns {Promise<void>}
 */
async function setupWorkLoggerBot(bot) {
  // Validate required environment variables
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
  
  if (!token || !authorizedUserId) {
    throw new Error('Missing required environment variables: TELEGRAM_BOT_TOKEN and AUTHORIZED_USER_ID');
  }

  // Initialize core components
  const db = new Database();
  
  // Establish database connection before proceeding
  await db.connectToMongoDB();
  
  const parser = new MessageParser();
  const commands = new Commands(db, parser);

  /**
   * Generates a random time between 11:00 and 23:59 for daily reminders
   * This helps vary reminder times to feel more natural
   * 
   * @returns {Object} Object with hours and minutes properties
   */
  function getRandomReminderTime() {
    const min = 11 * 60; // 11:00 AM in minutes
    const max = 23 * 60 + 59; // 11:59 PM in minutes
    const randomMinutes = Math.floor(Math.random() * (max - min + 1)) + min;
    
    return {
      hours: Math.floor(randomMinutes / 60),
      minutes: randomMinutes % 60
    };
  }

  /**
   * Schedules a daily reminder at a random time
   * Note: This functionality is not effective in webhook/serverless mode
   * as the server instance doesn't persist between requests
   */
  function scheduleDailyReminder() {
    const { hours, minutes } = getRandomReminderTime();
    const rule = new schedule.RecurrenceRule();
    rule.tz = 'Etc/UTC';
    rule.hour = hours;
    rule.minute = minutes;

    // Cancel existing reminder if it exists
    if (scheduleDailyReminder.reminderJob) {
      scheduleDailyReminder.reminderJob.cancel();
    }

    // Schedule new reminder
    scheduleDailyReminder.reminderJob = schedule.scheduleJob(rule, async () => {
      try {
        // Note: This won't work in webhook mode due to serverless nature
        console.log('Daily reminder scheduled but not sent in webhook mode');
        
        // Reschedule for next day with new random time
        scheduleDailyReminder();
      } catch (error) {
        console.error('Error with reminder scheduling:', error);
      }
    });
    
    console.log(`Scheduled daily reminder at ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} UTC`);
  }

  // Initialize reminder scheduling
  // Note: This is mainly for development/polling mode
  scheduleDailyReminder();
}

module.exports = setupWorkLoggerBot;