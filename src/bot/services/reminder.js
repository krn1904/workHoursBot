/**
 * Daily Reminder Module for Telegram Work Hours Logger Bot
 * 
 * This module handles daily reminders to encourage users to log their work hours.
 * It sends a random reminder between 3PM and 11PM each day with motivational messages
 * and helpful tips for logging work hours.
 * 
 * Features:
 * - Random reminder time between 15:00 and 23:00 (3PM - 11PM)
 * - Variety of reminder messages to keep engagement fresh
 * - Automatic timezone handling
 * - Smart scheduling that avoids weekends (optional)
 * - Graceful error handling
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const moment = require('moment');

/**
 * Collection of reminder messages to keep the bot engaging and helpful
 * These messages rotate randomly to avoid repetition and maintain user interest
 */
const reminderMessages = [
  "⏰ Time to log your work hours! How many hours did you work today?",
  "📝 Don't forget to track your progress! Send me your work hours for today.",
  "🎯 Quick reminder: Log your work hours to keep track of your productivity!",
  "⚡ Hey there! Ready to log today's work hours? Just send me a message like 'Worked 6 hours today'",
  "📊 Time for your daily check-in! How many hours of work did you complete today?",
  "🏆 Keep up the great tracking! What are your work hours for today?",
  "💼 End of day reminder: Don't forget to log your work hours!",
  "🌟 Great job staying productive! Time to record today's work hours.",
  "📈 Tracking your time helps you grow! What's your hour count for today?",
  "✨ Daily reminder: Log your work hours to maintain your awesome streak!",
  "🎪 Work hours logging time! Just tell me something like '8 hours coding today'",
  "🚀 Ready to close out the day? Log your work hours and see your progress!",
  "💡 Pro tip: Consistent logging helps you understand your work patterns better!",
  "🏃‍♂️ Quick check-in: How many hours did you put in today?",
  "📅 Another productive day? Time to log those work hours!",
  "🎨 Whether coding, designing, or meeting - every hour counts! Log them now.",
  "🔥 Keep the momentum going! Log your daily work hours.",
  "🌈 End your day right by tracking your work hours! What's the count?",
  "💪 You've got this! Time to record today's work accomplishments.",
  "🎯 Consistency is key! Don't forget to log your work hours for today."
];

/**
 * Class for managing daily reminder functionality
 * 
 * This class handles the scheduling and sending of daily work hour reminders.
 * It's designed to work in both polling and webhook environments, though
 * webhook environments may have limitations for background scheduling.
 */
class DailyReminder {
  /**
   * Creates a new DailyReminder instance
   * 
   * @param {TelegramBot} bot - The Telegram bot instance
   * @param {number} authorizedUserId - The user ID to send reminders to
   * @param {Database} database - Database instance for checking logged hours
   */
  constructor(bot, authorizedUserId, database = null) {
    this.bot = bot;
    this.authorizedUserId = authorizedUserId;
    this.database = database;
    this.reminderTimeout = null;
    this.isScheduled = false;
    
    // Configuration options
    this.config = {
      // Reminder time window (24-hour format)
      startHour: 15,  // 3 PM
      endHour: 23,    // 11 PM
      
      // Days to send reminders (0 = Sunday, 6 = Saturday)
      activeDays: [1, 2, 3, 4, 5], // Monday to Friday
      // To include weekends, use: [0, 1, 2, 3, 4, 5, 6]
      
      // Whether to skip reminder if hours already logged today
      skipIfAlreadyLogged: true,
      
      // Timezone (defaults to system timezone)
      timezone: null // You can set this to a specific timezone like 'America/New_York'
    };
  }

  /**
   * Starts the daily reminder scheduling
   * 
   * This method calculates the next reminder time and schedules it.
   * In serverless environments, this may not persist across function invocations.
   */
  start() {
    console.log('🔔 Starting daily reminder system...');
    
    // Check if we're in a serverless environment
    if (this.isServerlessEnvironment()) {
      console.log('⚠️ Serverless environment detected. Daily reminders may not work reliably.');
      console.log('💡 Consider using external cron services or webhook-based scheduling.');
      return;
    }
    
    this.scheduleNextReminder();
    this.isScheduled = true;
    console.log('✅ Daily reminder system started successfully');
  }

  /**
   * Stops the daily reminder scheduling
   */
  stop() {
    if (this.reminderTimeout) {
      clearTimeout(this.reminderTimeout);
      this.reminderTimeout = null;
    }
    this.isScheduled = false;
    console.log('🔕 Daily reminder system stopped');
  }

  /**
   * Checks if the current environment is serverless
   * 
   * @returns {boolean} True if running in serverless environment
   */
  isServerlessEnvironment() {
    return !!(
      process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      process.env.NETLIFY ||
      process.env.RAILWAY_ENVIRONMENT ||
      process.env.RENDER
    );
  }

  /**
   * Calculates and schedules the next reminder
   * 
   * This method determines when the next reminder should be sent based on
   * the current time, configuration, and whether it's an active day.
   */
  scheduleNextReminder() {
    const now = moment();
    const nextReminderTime = this.calculateNextReminderTime(now);
    
    if (!nextReminderTime) {
      console.log('📅 No more reminders scheduled (outside active days)');
      return;
    }
    
    const delay = nextReminderTime.diff(now);
    
    console.log(`⏰ Next reminder scheduled for: ${nextReminderTime.format('YYYY-MM-DD HH:mm:ss')}`);
    console.log(`⏳ Delay: ${moment.duration(delay).humanize()}`);
    
    // Clear any existing timeout
    if (this.reminderTimeout) {
      clearTimeout(this.reminderTimeout);
    }
    
    // Schedule the reminder
    this.reminderTimeout = setTimeout(async () => {
      await this.sendReminder();
      // Schedule the next reminder after sending this one
      this.scheduleNextReminder();
    }, delay);
  }

  /**
   * Calculates the next appropriate reminder time
   * 
   * @param {moment.Moment} now - Current time
   * @returns {moment.Moment|null} Next reminder time or null if none
   */
  calculateNextReminderTime(now) {
    let candidate = now.clone();
    
    // If we're past the end hour today, move to tomorrow
    if (now.hour() >= this.config.endHour) {
      candidate.add(1, 'day').startOf('day');
    }
    
    // Find the next active day
    let attempts = 0;
    while (attempts < 7 && !this.config.activeDays.includes(candidate.day())) {
      candidate.add(1, 'day').startOf('day');
      attempts++;
    }
    
    // If no active day found in the next week, return null
    if (attempts >= 7) {
      return null;
    }
    
    // Generate random time between start and end hour
    const randomHour = this.getRandomInt(this.config.startHour, this.config.endHour);
    const randomMinute = this.getRandomInt(0, 59);
    
    candidate.hour(randomHour).minute(randomMinute).second(0).millisecond(0);
    
    // If the calculated time is in the past (for today), move to tomorrow
    if (candidate.isBefore(now)) {
      candidate.add(1, 'day');
      // Recheck if the new day is active
      if (!this.config.activeDays.includes(candidate.day())) {
        return this.calculateNextReminderTime(candidate);
      }
    }
    
    return candidate;
  }

  /**
   * Generates a random integer between min and max (inclusive)
   * 
   * @param {number} min - Minimum value
   * @param {number} max - Maximum value
   * @returns {number} Random integer
   */
  getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Sends the daily reminder message to the user
   * 
   * This method checks if hours are already logged (if configured) and
   * sends an appropriate reminder message.
   */
  async sendReminder() {
    try {
      console.log('📨 Sending daily work hours reminder...');
      
      // Check if user already logged hours today (if database is available)
      if (this.config.skipIfAlreadyLogged && this.database) {
        const today = moment().format('YYYY-MM-DD');
        try {
          const todayEntries = await this.database.getTodayEntries(today);
          if (todayEntries && todayEntries.length > 0) {
            console.log('✅ User already logged hours today, skipping reminder');
            return;
          }
        } catch (e) {
          // If DB is not configured or unreachable, continue to send reminder
          console.warn('⚠️ Could not check today entries (DB unavailable). Proceeding to send reminder.');
        }
      }
      
      // Select a random reminder message
      const randomMessage = this.getRandomReminderMessage();
      
      // Add helpful context based on time of day
      const contextMessage = this.getContextualMessage();
      const fullMessage = `${randomMessage}\n\n${contextMessage}`;
      
      // Send the reminder
      await this.bot.sendMessage(this.authorizedUserId, fullMessage, {
        parse_mode: 'Markdown',
        disable_notification: false // Set to true for silent notifications
      });
      
      console.log('✅ Daily reminder sent successfully');
      
    } catch (error) {
      console.error('❌ Error sending daily reminder:', error.message);
      
      // Don't let reminder errors break the scheduling
      // The next reminder will still be scheduled
    }
  }

  /**
   * Gets a random reminder message from the collection
   * 
   * @returns {string} Random reminder message
   */
  getRandomReminderMessage() {
    const randomIndex = Math.floor(Math.random() * reminderMessages.length);
    return reminderMessages[randomIndex];
  }

  /**
   * Gets contextual message based on current time
   * 
   * @returns {string} Contextual message
   */
  getContextualMessage() {
    const hour = moment().hour();
    
    if (hour >= 15 && hour < 17) {
      return "💡 *Afternoon check-in* - Perfect time to log morning work!";
    } else if (hour >= 17 && hour < 19) {
      return "🌅 *Evening update* - How was your workday?";
    } else if (hour >= 19 && hour < 21) {
      return "🌆 *End of day* - Time to wrap up and log your hours!";
    } else {
      return "🌙 *Late evening* - Don't forget to track today's work before bed!";
    }
  }

  /**
   * Manually triggers a reminder (useful for testing)
   * 
   * @returns {Promise<void>}
   */
  async triggerManualReminder() {
    console.log('🧪 Triggering manual reminder for testing...');
    await this.sendReminder();
  }

  /**
   * Gets the status of the reminder system
   * 
   * @returns {Object} Status information
   */
  getStatus() {
    const now = moment();
    let nextReminderTime = null;
    
    if (this.isScheduled) {
      nextReminderTime = this.calculateNextReminderTime(now);
    }
    
    return {
      isActive: this.isScheduled,
      isServerless: this.isServerlessEnvironment(),
      nextReminder: nextReminderTime ? nextReminderTime.format('YYYY-MM-DD HH:mm:ss') : null,
      config: {
        timeWindow: `${this.config.startHour}:00 - ${this.config.endHour}:00`,
        activeDays: this.config.activeDays.map(day => {
          const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          return days[day];
        }),
        skipIfLogged: this.config.skipIfAlreadyLogged
      }
    };
  }

  /**
   * Updates the reminder configuration
   * 
   * @param {Object} newConfig - New configuration options
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Restart scheduling with new config
    if (this.isScheduled) {
      this.stop();
      this.start();
    }
    
    console.log('⚙️ Reminder configuration updated:', this.config);
  }
}

/**
 * Creates and starts a daily reminder system
 * 
 * This is a convenience function for quickly setting up reminders.
 * Note: In serverless environments, this may not work as expected.
 * 
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} authorizedUserId - User ID to send reminders to
 * @param {Database} database - Optional database instance
 * @returns {DailyReminder} Configured reminder instance
 */
function createDailyReminder(bot, authorizedUserId, database = null) {
  const reminder = new DailyReminder(bot, authorizedUserId, database);
  reminder.start();
  return reminder;
}

/**
 * Alternative implementation for serverless environments
 * 
 * This function can be called from external cron services or webhook schedulers
 * to trigger reminders in serverless deployments.
 * 
 * @param {TelegramBot} bot - Telegram bot instance
 * @param {number} authorizedUserId - User ID to send reminders to
 * @param {Database} database - Optional database instance
 * @param {boolean} forceReminder - Skip time/day checks for testing
 * @returns {Promise<void>}
 */
async function sendScheduledReminder(bot, authorizedUserId, database = null, forceReminder = false) {
  const reminder = new DailyReminder(bot, authorizedUserId, database);
  
  // For testing, allow forcing the reminder regardless of time
  if (forceReminder) {
    console.log('🧪 Force reminder mode - sending test reminder');
    await reminder.sendReminder();
    return;
  }
  
  // Check if it's an appropriate time to send reminder
  const now = moment();
  const hour = now.hour();
  const dayOfWeek = now.day();
  
  console.log(`⏰ Current time: ${now.format('YYYY-MM-DD HH:mm:ss')} (Hour: ${hour}, Day: ${dayOfWeek})`);
  
  // Check if it's within reminder hours and on an active day
  if (hour >= 15 && hour <= 23 && [1, 2, 3, 4, 5].includes(dayOfWeek)) {
    console.log('✅ Within reminder time window, sending reminder');
    await reminder.sendReminder();
  } else {
    console.log('⏭️ Outside reminder time window or inactive day, skipping');
    console.log(`   Expected: Hour 15-23 (currently ${hour}), Days Mon-Fri (currently ${dayOfWeek})`);
  }
}

module.exports = {
  DailyReminder,
  createDailyReminder,
  sendScheduledReminder
};