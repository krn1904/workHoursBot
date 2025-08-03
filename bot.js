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
}

module.exports = setupWorkLoggerBot;