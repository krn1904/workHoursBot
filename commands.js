const moment = require('moment');

// Pay cycle start date (must be a Monday)
const PAY_CYCLE_START = '2024-07-21'; // YYYY-MM-DD

function getCurrentPayCycle(today = moment()) {
  const start = moment(PAY_CYCLE_START);
  const daysSinceStart = today.diff(start, 'days');
  const cyclesSinceStart = Math.floor(daysSinceStart / 14);
  const cycleStart = start.clone().add(cyclesSinceStart * 14, 'days');
  const cycleEnd = cycleStart.clone().add(13, 'days'); // 14 days inclusive
  return { cycleStart: cycleStart.format('YYYY-MM-DD'), cycleEnd: cycleEnd.format('YYYY-MM-DD') };
}

// Class for handling bot commands like /summary, /today, /log, etc.
class Commands {
  constructor(database, messageParser) {
    // Store references to database and parser instances
    this.db = database;
    this.parser = messageParser;
  }

  // Make getCurrentPayCycle accessible
  getCurrentPayCycle() {
    return getCurrentPayCycle();
  }

  // Handle /summary command - shows weekly and monthly work totals
  async handleSummary() {
    try {
      // Calculate date ranges for this week (Monday to Sunday)
      const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
      const endOfWeek = moment().endOf('week').format('YYYY-MM-DD');
      // Calculate date ranges for this month
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

      // Get all entries for week and month
      const [weekEntries, monthEntries] = await Promise.all([
        this.db.getEntriesBetween(startOfWeek, endOfWeek),
        this.db.getEntriesBetween(startOfMonth, endOfMonth)
      ]);

      // Helper to calculate hours breakdown
      function calculateHours(entries) {
        let weekdayHours = 0, saturdayHours = 0, sundayHours = 0;
        entries.forEach(entry => {
          const day = moment(entry.date).day();
          if (day === 0) {
            sundayHours += entry.hours;
          } else if (day === 6) {
            saturdayHours += entry.hours;
          } else {
            weekdayHours += entry.hours;
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

      // Format hours for display
      const weekHours = this.parser.formatHours(week.total);
      const monthHours = this.parser.formatHours(month.total);

      // Build formatted response message
      return `📊 *Work Summary*\n\n` +
             `📅 *This Week:* ${weekHours} hours (${weekEntries.length} entries)\n` +
             `   🏢 Weekdays: ${this.parser.formatHours(week.weekdayHours)}h\n` +
             `   📆 Saturday: ${this.parser.formatHours(week.saturdayHours)}h\n` +
             `   ☀️ Sunday: ${this.parser.formatHours(week.sundayHours)}h\n` +
             `🗓️ *This Month:* ${monthHours} hours (${monthEntries.length} entries)\n` +
             `   🏢 Weekdays: ${this.parser.formatHours(month.weekdayHours)}h\n` +
             `   📆 Saturday: ${this.parser.formatHours(month.saturdayHours)}h\n` +
             `   ☀️ Sunday: ${this.parser.formatHours(month.sundayHours)}h`;
    } catch (error) {
      console.error('Error in handleSummary:', error);
      return '❌ Error generating summary. Please try again.';
    }
  }

  // Handle /today command - shows all work entries for today
  async handleToday() {
    try {
      // Get today's date in YYYY-MM-DD format
      const today = moment().format('YYYY-MM-DD');
      const entries = await this.db.getTodayEntries(today);

      if (entries.length === 0) {
        return '📅 No work logged for today yet.';
      }

      // Calculate hours for today by type
      let weekdayHours = 0, saturdayHours = 0, sundayHours = 0;
      entries.forEach(entry => {
        const day = moment(entry.date).day();
        if (day === 0) {
          sundayHours += entry.hours;
        } else if (day === 6) {
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

  // Handle /log command - shows the last 5 work entries
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
        const date = moment(entry.date).format('MMM DD');
        const time = moment(entry.timestamp).format('HH:mm');
        response += `${index + 1}. ${hours}h${tag} on 📅 ${date} (🕒 ${time})\n`;
      });

      return response;
    } catch (error) {
      console.error('Error in handleLog:', error);
      return '❌ Error retrieving work log. Please try again.';
    }
  }

  // Handle /category command - shows total hours for a specific tag/category
  async handleCategory(tag) {
    // Validate that a tag was provided
    if (!tag) {
      return '❌ Please specify a category/tag. Usage: /category <tag>';
    }

    try {
      // Get aggregated data for the specified tag
      const data = await this.db.getCategoryTotal(tag);
      
      // Handle case where no work was logged under this category
      if (data.totalHours === 0) {
        return `📊 No work logged under category "${tag}".`;
      }

      // Format and return category summary
      const hours = this.parser.formatHours(data.totalHours);
      return `🗂️ *Category:* "${tag}"\n\n` +
             `⏱️ Total Hours: ${hours}\n` +
             `📝 Total Entries: ${data.entries}`;
    } catch (error) {
      console.error('Error in handleCategory:', error);
      return '❌ Error retrieving category data. Please try again.';
    }
  }

  // Handle /paycycle command - shows hours for current pay cycle
  async handlePayCycle() {
    try {
      const { cycleStart, cycleEnd } = getCurrentPayCycle();
      const entries = await this.db.getEntriesBetween(cycleStart, cycleEnd);
      // Calculate hours for pay cycle by type
      let weekdayHours = 0, saturdayHours = 0, sundayHours = 0;
      entries.forEach(entry => {
        const day = moment(entry.date).day();
        if (day === 0) {
          sundayHours += entry.hours;
        } else if (day === 6) {
          saturdayHours += entry.hours;
        } else {
          weekdayHours += entry.hours;
        }
      });
      const total = weekdayHours + saturdayHours + sundayHours;
      const formattedTotal = this.parser.formatHours(total);
      let response = `🗓️ *Current Pay Cycle* (${cycleStart} to ${cycleEnd})\n` +
        `   ⏳ Total: ${formattedTotal} hours\n` +
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