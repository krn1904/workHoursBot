/**
 * Reminder API Endpoint for GitHub Actions Integration
 * 
 * This endpoint allows external services (like GitHub Actions) to trigger
 * daily reminders for the work hours bot. It provides secure access via
 * bearer token authentication and integrates with the existing reminder system.
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const { sendScheduledReminder } = require('../reminder');
const TelegramBot = require('node-telegram-bot-api');

/**
 * API endpoint for triggering daily reminders from external services
 * 
 * This function handles POST requests from GitHub Actions or other cron services
 * to send daily work hour reminders. It includes authentication and validation.
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Promise<void>}
 */
module.exports = async (req, res) => {
  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return res.status(405).json({ 
        error: 'Method not allowed',
        message: 'Only POST requests are supported'
      });
    }

    // Validate required environment variables
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
    const reminderSecret = process.env.REMINDER_SECRET;

    if (!token || !authorizedUserId) {
      console.error('Missing required environment variables');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check authentication if reminder secret is configured
    if (reminderSecret) {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Bearer token required'
        });
      }

      const providedToken = authHeader.substring(7); // Remove 'Bearer ' prefix
      if (providedToken !== reminderSecret) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'Invalid token'
        });
      }
    }

    // Parse request body
    const { action, user_id, source } = req.body;

    // Validate request payload
    if (action !== 'send_daily') {
      return res.status(400).json({
        error: 'Invalid action',
        message: 'Only "send_daily" action is supported'
      });
    }

    // Verify user ID matches authorized user
    if (user_id && parseInt(user_id) !== authorizedUserId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'User not authorized'
      });
    }

    // Initialize bot instance
    const bot = new TelegramBot(token);

    // Initialize database for checking if already logged
    const Database = require('../database');
    const db = new Database();

    // Send the scheduled reminder
    await sendScheduledReminder(bot, authorizedUserId, db);

    console.log(`✅ Daily reminder triggered successfully from ${source || 'external'}`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Reminder sent successfully',
      timestamp: new Date().toISOString(),
      source: source || 'external'
    });

  } catch (error) {
    console.error('❌ Error in reminder API:', error);
    
    // Return error response but don't expose internal details
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send reminder',
      timestamp: new Date().toISOString()
    });
  }
};