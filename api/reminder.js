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

const { sendScheduledReminder } = require('../src/bot/services/reminder');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

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

    // Require REMINDER_SECRET to be configured for security
    if (!reminderSecret) {
      console.error('REMINDER_SECRET is not configured — rejecting request');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // Check authentication
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Bearer token required'
      });
    }

    const providedToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Use timing-safe comparison to prevent timing attacks.
    // Hash both values first so buffers are always the same length,
    // avoiding leaking the secret's length via a short-circuit check.
    const secretHash = crypto.createHash('sha256').update(reminderSecret).digest();
    const providedHash = crypto.createHash('sha256').update(providedToken).digest();
    if (!crypto.timingSafeEqual(secretHash, providedHash)) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid token'
      });
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
    const bot = new TelegramBot(token, { polling: false });

    // Initialize database for checking if already logged (optional)
    let db = null;
    if (process.env.MONGODB_URI) {
      try {
        const Database = require('../src/bot/services/database');
        db = new Database();
        // Connect to database immediately to ensure it's available for the check
        await db.connectToMongoDB();
        console.log('✅ Database connected for reminder check');
      } catch (e) {
        console.error('❌ Failed to connect to database for reminder check:', e.message);
        console.warn('⚠️ Reminder will be sent without DB check (cannot verify if hours already logged)');
        // Set db to null so reminder knows DB is unavailable
        db = null;
      }
    } else {
      console.log('ℹ️ MONGODB_URI not set; reminder will be sent without DB check');
    }

    // For testing from GitHub Actions, force the reminder
    const isTestMode = source === 'github_actions_test' || source === 'manual_test';
    const isProduction = source === 'github_actions_production';
    
    // Send the scheduled reminder
    // Force reminder for tests, use normal time checks for production
    await sendScheduledReminder(bot, authorizedUserId, db, isTestMode);

    console.log(`✅ Daily reminder triggered successfully from ${source || 'external'} ${isTestMode ? '(TEST MODE)' : isProduction ? '(PRODUCTION)' : ''}`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Reminder sent successfully',
      timestamp: new Date().toISOString(),
      source: source || 'external',
      testMode: isTestMode,
      productionMode: isProduction
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