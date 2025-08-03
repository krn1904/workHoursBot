/**
 * Commands Module for Telegram Work Hours Logger Bot
 * 
 * This module handles all bot commands and provides structured responses
 * for user queries about their work hours. It implements pay cycle tracking,
 * summary generation, and various analytics features.
 * 
 * Features:
 * - Weekly and monthly work summaries
 * - Pay cycle tracking (bi-weekly periods)
 * - Category-based hour filtering
 * - Recent entry history
 * - Today's work log display
 * - Help and usage information
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const moment = require('moment');

/**
 * Pay cycle configuration
 * This defines the start date for pay cycles (must be a Monday)
 * All bi-weekly pay periods are calculated from this reference date
 */
const PAY_CYCLE_START = '2024-07-21'; // YYYY-MM-DD format

/**
 * Calculates the current pay cycle dates based on the configured start date
 * 
 * Pay cycles are 14-day periods starting from PAY_CYCLE_START.
 * This function determines which cycle the current date falls into.
 * 
 * @param {moment.Moment} today - Current date (defaults to today)
 * @returns {Object} Object with cycleStart and cycleEnd in YYYY-MM-DD format
 */
function getCurrentPayCycle(today = moment()) {
  const start = moment(PAY_CYCLE_START);
  const daysSinceStart = today.diff(start, 'days');
  const cyclesSinceStart = Math.floor(daysSinceStart / 14);
  const cycleStart = start.clone().add(cyclesSinceStart * 14, 'days');
  const cycleEnd = cycleStart.clone().add(13, 'days'); // 14 days inclusive (0-13)
  
  return { 
    cycleStart: cycleStart.format('YYYY-MM-DD'), 
    cycleEnd: cycleEnd.format('YYYY-MM-DD') 
  };
}

/**
 * Class for handling bot commands like /summary, /today, /log, etc.
 * 
 * This class processes user commands and generates appropriate responses
 * by querying the database and formatting the results for display.
 */
class Commands {
  /**
   * Creates a new Commands instance
   * 
   * @param {Database} database - Database instance for data operations
   * @param {MessageParser} messageParser - Parser instance for formatting utilities
   */
  constructor(database, messageParser) {
    // Store references to database and parser instances
    this.db = database;
    this.parser = messageParser;
  }

  /**
   * Provides access to the current pay cycle calculation
   * 
   * @returns {Object} Current pay cycle start and end dates
   */
  getCurrentPayCycle() {
    return getCurrentPayCycle();
  }

  /**
   * Handles /summary command - shows weekly and monthly work totals
   * 
   * Generates a comprehensive summary including:
   * - Current week totals (Monday to Sunday)
   * - Current month totals
   * - Breakdown by day type (weekdays, Saturday, Sunday)
   * 
   * @returns {Promise<string>} Formatted summary message
   */
  async handleSummary() {
    try {
      // Calculate date ranges for this week (Monday to Sunday)
      // Get the current date and find the most recent Monday
      const today = moment();
      const startOfWeek = today.clone().startOf('isoWeek').format('YYYY-MM-DD'); // Monday
      const endOfWeek = today.clone().endOf('isoWeek').format('YYYY-MM-DD'); // Sunday
      
      // Calculate date ranges for this month
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

      // Fetch all entries for week and month in parallel for efficiency
      const [weekEntries, monthEntries] = await Promise.all([
        this.db.getEntriesBetween(startOfWeek, endOfWeek),
        this.db.getEntriesBetween(startOfMonth, endOfMonth)
      ]);

      /**
       * Helper function to calculate hours breakdown by day type
       * 
       * @param {Array} entries - Array of work entries
       * @returns {Object} Hours breakdown with totals
       */
      function calculateHours(entries) {
        let weekdayHours = 0;
        let saturdayHours = 0;
        let sundayHours = 0;
        
        entries.forEach(entry => {
          const dayOfWeek = moment(entry.date).day(); // 0 = Sunday, 6 = Saturday
          if (dayOfWeek === 0) {
            sundayHours += entry.hours;
          } else if (dayOfWeek === 6) {
            saturdayHours += entry.hours;
          } else {
            weekdayHours += entry.hours; // Monday through Friday
          }
        });
        
        return {
          weekdayHours,
          saturdayHours,
          sundayHours,
          total: weekdayHours + saturdayHours + sundayHours
        };
      }

      const week = calculateHours(weekEntries);
      const month = calculateHours(monthEntries);

      // Format hours for display using parser utility
      const weekHours = this.parser.formatHours(week.total);
      const monthHours = this.parser.formatHours(month.total);

      // Build formatted response message with emojis for better UX
      return `📊 *Work Summary*\n\n` +
             `📅 *This Week:* ${weekHours} hours (${weekEntries.length} entries)\n` +
             `   🏢 Weekdays: ${this.parser.formatHours(week.weekdayHours)}h\n` +
             `   📆 Saturday: ${this.parser.formatHours(week.saturdayHours)}h\n` +
             `   ☀️ Sunday: ${this.parser.formatHours(week.sundayHours)}h\n\n` +
             `🗓️ *This Month:* ${monthHours} hours (${monthEntries.length} entries)\n` +
             `   🏢 Weekdays: ${this.parser.formatHours(month.weekdayHours)}h\n` +
             `   📆 Saturday: ${this.parser.formatHours(month.saturdayHours)}h\n` +
             `   ☀️ Sunday: ${this.parser.formatHours(month.sundayHours)}h`;
    } catch (error) {
      console.error('Error in handleSummary:', error);
      return '❌ Error generating summary. Please try again.';
    }
  }

  /**
   * Handles /today command - shows all work entries for today
   * 
   * Displays today's logged hours with:
   * - Total hours for the day
   * - Breakdown by day type
   * - Individual entry details with timestamps
   * 
   * @returns {Promise<string>} Formatted today's work log
   */
  async handleToday() {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = moment().format('YYYY-MM-DD');
      const entries = await this.db.getTodayEntries(today);

      if (entries.length === 0) {
        return '📅 No work logged for today yet.';
      }

      // Calculate hours for today by day type
      let weekdayHours = 0;
      let saturdayHours = 0;
      let sundayHours = 0;
      
      entries.forEach(entry => {
        const dayOfWeek = moment(entry.date).day();
        if (dayOfWeek === 0) {
          sundayHours += entry.hours;
        } else if (dayOfWeek === 6) {
          saturdayHours += entry.hours;
        } else {
          weekdayHours += entry.hours;
        }
      });
      
      const total = weekdayHours + saturdayHours + sundayHours;
      const formattedTotal = this.parser.formatHours(total);

      // Build response with individual entries
      let response = `📅 *Today's Work Log* (${formattedTotal} hours total)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h\n\n`;
      
      // Add individual entry details
      entries.forEach((entry, index) => {
        const hours = this.parser.formatHours(entry.hours);
        const tag = entry.tag ? ` 🏷️ [${entry.tag}]` : '';
        const time = moment(entry.timestamp).format('HH:mm');
        response += `${index + 1}. ${hours}h${tag} (🕒 ${time})\n`;
      });

      return response;
    } catch (error) {
      console.error('Error in handleToday:', error);
      return '❌ Error retrieving today\'s entries. Please try again.';
    }
  }

  /**
   * Handles /log command - shows the last 5 work entries
   * 
   * Displays recent work history with:
   * - Entry hours and tags
   * - Date and time logged
   * - Chronological order (newest first)
   * 
   * @returns {Promise<string>} Formatted work log history
   */
  async handleLog() {
    try {
      // Get recent entries from database
      const entries = await this.db.getLastEntries(5);

      // Handle case where no entries exist
      if (entries.length === 0) {
        return '📝 No work entries found.';
      }

      // Build response with entry details
      let response = '📝 *Last 5 Work Entries*\n\n';
      
      // Format each entry with date and time information
      entries.forEach((entry, index) => {
        const hours = this.parser.formatHours(entry.hours);
        const tag = entry.tag ? ` 🏷️ [${entry.tag}]` : '';
        const date = moment(entry.date).format('MMM DD'); // e.g., "Jan 15"
        const time = moment(entry.timestamp).format('HH:mm'); // e.g., "14:30"
        response += `${index + 1}. ${hours}h${tag} on 📅 ${date} (🕒 ${time})\n`;
      });

      return response;
    } catch (error) {
      console.error('Error in handleLog:', error);
      return '❌ Error retrieving work log. Please try again.';
    }
  }

  /**
   * Handles /category command - shows total hours for a specific tag/category
   * 
   * Searches for all entries matching the specified tag (case-insensitive)
   * and provides aggregated statistics.
   * 
   * @param {string} tag - Category/tag to search for
   * @returns {Promise<string>} Formatted category summary
   */
  async handleCategory(tag) {
    // Validate that a tag was provided
    if (!tag || typeof tag !== 'string') {
      return '❌ Please specify a category/tag. Usage: /category <tag>';
    }

    const trimmedTag = tag.trim();
    if (trimmedTag.length === 0) {
      return '❌ Please specify a category/tag. Usage: /category <tag>';
    }

    try {
      // Get aggregated data for the specified tag
      const data = await this.db.getCategoryTotal(trimmedTag);
      
      // Handle case where no work was logged under this category
      if (data.totalHours === 0) {
        return `📊 No work logged under category "${trimmedTag}".`;
      }

      // Format and return category summary
      const hours = this.parser.formatHours(data.totalHours);
      return `🗂️ *Category:* "${trimmedTag}"\n\n` +
             `⏱️ Total Hours: ${hours}\n` +
             `📝 Total Entries: ${data.entries}`;
    } catch (error) {
      console.error('Error in handleCategory:', error);
      return '❌ Error retrieving category data. Please try again.';
    }
  }

  /**
   * Handles /paycycle command - shows hours for current pay cycle
   * 
   * Displays work hours for the current bi-weekly pay period with:
   * - Pay cycle date range
   * - Total hours and breakdown by day type
   * - Entry count
   * 
   * @returns {Promise<string>} Formatted pay cycle summary
   */
  async handlePayCycle() {
    try {
      const { cycleStart, cycleEnd } = getCurrentPayCycle();
      const entries = await this.db.getEntriesBetween(cycleStart, cycleEnd);
      
      // Calculate hours for pay cycle by day type
      let weekdayHours = 0;
      let saturdayHours = 0;
      let sundayHours = 0;
      
      entries.forEach(entry => {
        const dayOfWeek = moment(entry.date).day();
        if (dayOfWeek === 0) {
          sundayHours += entry.hours;
        } else if (dayOfWeek === 6) {
          saturdayHours += entry.hours;
        } else {
          weekdayHours += entry.hours;
        }
      });
      
      const total = weekdayHours + saturdayHours + sundayHours;
      const formattedTotal = this.parser.formatHours(total);
      
      // Format pay cycle summary
      const response = `🗓️ *Current Pay Cycle* (${cycleStart} to ${cycleEnd})\n\n` +
        `   ⏳ Total: ${formattedTotal} hours (${entries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h`;
      
      return response;
    } catch (error) {
      console.error('Error in handlePayCycle:', error);
      return '❌ Error generating pay cycle summary. Please try again.';
    }
  }

  /**
   * Returns comprehensive help message with usage instructions and available commands
   * 
   * Provides:
   * - Welcome message and quick start guide
   * - Current pay cycle information
   * - Example usage messages
   * - Complete command list with descriptions
   * 
   * @returns {string} Formatted help message
   */
  getHelpMessage() {
    const { cycleStart, cycleEnd } = this.getCurrentPayCycle();
    
    return `🤖 *Work Hours Bot Help*\n\n` +
           `👋 *Welcome!* Your work hours tracking bot is ready.\n\n` +
           `📅 *Current Pay Cycle:* ${cycleStart} to ${cycleEnd}\n\n` +
           `💡 *Quick Start:*\n` +
           `• Send a message like "Worked 6 hours today"\n` +
           `• Use /help to see all commands\n` +
           `• Use /paycycle to check current cycle hours\n\n` +
           `📝 *Log work by sending messages like:*\n` +
           `• "Worked 6 hours today"\n` +
           `• "5.5 hrs on freelance"\n` +
           `• "Yesterday I did 3 hours on project X"\n` +
           `• "8.25 hours coding on 12/15"\n\n` +
           `⚡ *Available Commands:*\n` +
           `• /summary - Weekly and monthly totals with day breakdown\n` +
           `• /today - Today's logged hours and entries\n` +
           `• /log - Last 5 work entries with timestamps\n` +
           `• /category <tag> - Hours for specific category/project\n` +
           `• /paycycle - Hours for current pay cycle (bi-weekly)\n` +
           `• /help - Show this help message\n\n` +
           `🔧 *Admin Commands:*\n` +
           `• /stats - Database statistics and overview\n` +
           `• /reset confirm - Reset database (⚠️ DESTRUCTIVE)\n` +
           `• /validate - Check database integrity\n\n` +
           `🏷️ *Tips:*\n` +
           `• Tags are automatically extracted (e.g., "coding", "client work")\n` +
           `• Supports various time formats (6h, 5.5 hours, 3 hrs)\n` +
           `• Recognizes "today", "yesterday", and specific dates\n` +
           `• All data is stored securely in your database`;
  }

  /**
   * Handles /stats command - shows database statistics and overview
   * 
   * Displays comprehensive information about:
   * - Total entries and hours
   * - Date range coverage
   * - Available tags/categories
   * - Database health metrics
   * 
   * @returns {Promise<string>} Formatted statistics message
   */
  async handleStats() {
    try {
      const stats = await this.db.getDatabaseStats();
      
      const formattedTotalHours = this.parser.formatHours(stats.totalHours);
      const dateRangeText = stats.dateRange.earliest && stats.dateRange.latest
        ? `${stats.dateRange.earliest} to ${stats.dateRange.latest}`
        : 'No entries yet';
      
      let tagsText = 'None';
      if (stats.tags && stats.tags.length > 0) {
        const displayTags = stats.tags.slice(0, 10); // Show first 10 tags
        tagsText = displayTags.join(', ');
        if (stats.tags.length > 10) {
          tagsText += ` (+${stats.tags.length - 10} more)`;
        }
      }

      return `📊 *Database Statistics*\n\n` +
             `📈 *Overview:*\n` +
             `   📝 Total Entries: ${stats.totalEntries}\n` +
             `   ⏱️ Total Hours: ${formattedTotalHours}\n` +
             `   📅 Date Range: ${dateRangeText}\n` +
             `   🏷️ Categories: ${stats.uniqueTags}\n\n` +
             `🏷️ *Available Tags:*\n` +
             `   ${tagsText}\n\n` +
             `ℹ️ Use /validate to check database integrity`;
    } catch (error) {
      console.error('Error in handleStats:', error);
      return '❌ Error retrieving database statistics. Please try again.';
    }
  }

  /**
   * Handles /validate command - checks database integrity
   * 
   * Validates:
   * - Data format consistency
   * - Required field presence
   * - Value range validation
   * - Schema compliance
   * 
   * @returns {Promise<string>} Formatted validation results
   */
  async handleValidate() {
    try {
      const validation = await this.db.validateAndRepairDatabase();
      
      if (validation.issuesFound === 0) {
        return `✅ *Database Validation Complete*\n\n` +
               `🎉 No issues found! Your database is healthy.\n\n` +
               `📊 Validation completed at: ${new Date(validation.validationTimestamp).toLocaleString()}`;
      } else {
        let response = `⚠️ *Database Validation Complete*\n\n` +
                      `🔍 Found ${validation.issuesFound} issue(s):\n\n`;
        
        validation.issues.forEach((issue, index) => {
          response += `${index + 1}. ${issue}\n`;
        });
        
        if (validation.fixesApplied > 0) {
          response += `\n✅ Applied ${validation.fixesApplied} automatic fix(es):\n\n`;
          validation.fixes.forEach((fix, index) => {
            response += `${index + 1}. ${fix}\n`;
          });
        }
        
        response += `\n📊 Validation completed at: ${new Date(validation.validationTimestamp).toLocaleString()}`;
        
        return response;
      }
    } catch (error) {
      console.error('Error in handleValidate:', error);
      return '❌ Error validating database. Please try again.';
    }
  }

  /**
   * Handles /reset command - database reset with confirmation
   * 
   * This is a destructive operation that requires explicit confirmation.
   * It provides comprehensive warnings and creates backups before reset.
   * 
   * @param {string} confirmationArg - Must be "confirm" to proceed
   * @returns {Promise<string>} Formatted reset results or confirmation prompt
   */
  async handleReset(confirmationArg) {
    try {
      // Check if confirmation was provided
      if (!confirmationArg || confirmationArg.toLowerCase() !== 'confirm') {
        // Show stats and ask for confirmation
        const stats = await this.db.getDatabaseStats();
        
        if (stats.totalEntries === 0) {
          return `📊 *Database Reset*\n\n` +
                 `ℹ️ Database is already empty (0 entries).\n` +
                 `No reset needed.`;
        }
        
        const formattedTotalHours = this.parser.formatHours(stats.totalHours);
        const dateRangeText = stats.dateRange.earliest && stats.dateRange.latest
          ? `${stats.dateRange.earliest} to ${stats.dateRange.latest}`
          : 'No entries';
        
        return `⚠️ *DATABASE RESET WARNING*\n\n` +
               `🚨 This will permanently delete ALL work entries!\n\n` +
               `📊 *Current Database:*\n` +
               `   📝 Entries: ${stats.totalEntries}\n` +
               `   ⏱️ Hours: ${formattedTotalHours}\n` +
               `   📅 Range: ${dateRangeText}\n` +
               `   🏷️ Categories: ${stats.uniqueTags}\n\n` +
               `💾 A backup will be created before deletion.\n\n` +
               `⚠️ **TO CONFIRM RESET, SEND:**\n` +
               `\`/reset confirm\`\n\n` +
               `❌ **This action cannot be undone!**`;
      }

      // Proceed with reset
      const resetResult = await this.db.resetDatabase(true);
      
      if (resetResult.success) {
        return `✅ *Database Reset Complete*\n\n` +
               `🗑️ Deleted ${resetResult.deletedEntries} entries\n` +
               `💾 Backup created: ${resetResult.backupCreated} entries\n` +
               `🕒 Reset at: ${new Date(resetResult.resetTimestamp).toLocaleString()}\n\n` +
               `🎉 You now have a fresh database!\n` +
               `📝 Start logging: "Worked 6 hours today"`;
      } else {
        return `❌ Database reset failed. Please check logs and try again.`;
      }
      
    } catch (error) {
      console.error('Error in handleReset:', error);
      return `❌ Error during database reset: ${error.message}\n\nPlease check your database connection and try again.`;
    }
  }

  /**
   * Handles /backup command - creates a backup of all data
   * 
   * @returns {Promise<string>} Formatted backup status
   */
  async handleBackup() {
    try {
      const backupData = await this.db.createBackup();
      
      if (backupData.length === 0) {
        return `📊 *Backup Status*\n\n` +
               `ℹ️ Database is empty (0 entries).\n` +
               `No backup needed.`;
      }
      
      // In a real implementation, you might want to save this to a file or cloud storage
      return `✅ *Backup Created*\n\n` +
             `💾 Backed up ${backupData.length} entries\n` +
             `🕒 Backup created at: ${new Date().toLocaleString()}\n\n` +
             `ℹ️ Backup is stored in memory during this session.\n` +
             `For permanent backups, consider exporting your data.`;
      
    } catch (error) {
      console.error('Error in handleBackup:', error);
      return '❌ Error creating backup. Please try again.';
    }
  }
}

module.exports = Commands;