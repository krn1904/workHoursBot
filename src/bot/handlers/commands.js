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
const PAY_CYCLE_START = '2025-08-04'; // YYYY-MM-DD format - Updated to match actual pay cycle

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
  // Ensure we're working with date-only (no time component) for accurate calculations
  const start = moment(PAY_CYCLE_START).startOf('day');
  const currentDate = moment(today).startOf('day');
  
  // Calculate days difference from the start date
  const daysSinceStart = currentDate.diff(start, 'days');
  
  // Handle case where current date is before the pay cycle start
  if (daysSinceStart < 0) {
    // If we're before the first pay cycle, return the first cycle
    const cycleStart = start.clone();
    const cycleEnd = cycleStart.clone().add(13, 'days');
    return { 
      cycleStart: cycleStart.format('YYYY-MM-DD'), 
      cycleEnd: cycleEnd.format('YYYY-MM-DD') 
    };
  }
  
  // Calculate which cycle we're in (0-based)
  const cyclesSinceStart = Math.floor(daysSinceStart / 14);
  
  // Calculate the start of the current cycle
  const cycleStart = start.clone().add(cyclesSinceStart * 14, 'days');
  const cycleEnd = cycleStart.clone().add(13, 'days'); // 14 days total (0-13)
  
  return { 
    cycleStart: cycleStart.format('YYYY-MM-DD'), 
    cycleEnd: cycleEnd.format('YYYY-MM-DD') 
  };
}

/**
 * Parse numeric environment variables safely
 *
 * @param {string|undefined|null} value - Raw value from environment
 * @returns {number|null} Parsed non-negative number or null if invalid
 */
function parseRate(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0) {
    return null;
  }

  return rate;
}

const FALLBACK_RATE = parseRate(process.env.PAY_RATE);
const WEEKEND_RATE = parseRate(process.env.PAY_RATE_WEEKEND);
const PAY_RATES = {
  weekday: parseRate(process.env.PAY_RATE_WEEKDAY) ?? FALLBACK_RATE ?? 0,
  saturday: parseRate(process.env.PAY_RATE_SATURDAY) ?? WEEKEND_RATE ?? FALLBACK_RATE ?? 0,
  sunday: parseRate(process.env.PAY_RATE_SUNDAY) ?? WEEKEND_RATE ?? FALLBACK_RATE ?? 0
};

const PAY_RATE_LOCALE = process.env.PAY_RATE_LOCALE || 'en-AU';
const PAY_RATE_CURRENCY = process.env.PAY_RATE_CURRENCY || 'AUD';
const PAY_RATE_SYMBOL = process.env.PAY_RATE_SYMBOL || '$';

const PAY_RATES_ENABLED = Object.values(PAY_RATES).some(rate => rate > 0);

let currencyFormatter = null;
if (PAY_RATES_ENABLED) {
  try {
    currencyFormatter = new Intl.NumberFormat(PAY_RATE_LOCALE, {
      style: 'currency',
      currency: PAY_RATE_CURRENCY
    });
  } catch (error) {
    currencyFormatter = null;
  }
}

function formatCurrency(amount) {
  const numericAmount = Number(amount) || 0;
  if (!PAY_RATES_ENABLED) {
    return numericAmount.toFixed(2);
  }

  if (currencyFormatter) {
    try {
      return currencyFormatter.format(numericAmount);
    } catch (error) {
      // fall through to symbol-based format
    }
  }
  return `${PAY_RATE_SYMBOL}${numericAmount.toFixed(2)}`;
}

function calculatePayTotals({
  weekdayHours = 0,
  saturdayHours = 0,
  sundayHours = 0
} = {}) {
  return {
    weekday: weekdayHours * PAY_RATES.weekday,
    saturday: saturdayHours * PAY_RATES.saturday,
    sunday: sundayHours * PAY_RATES.sunday
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
   * Handles /delete command - preview and confirm deletion of recent entries
   *
   * Usage:
   *  - /delete [n]           -> Preview delete of last n (default 5, max 10)
   *  - /delete confirm [n]   -> Confirm and delete
   *
   * @param {string} args - Arguments after the command
   * @returns {Promise<string>} Formatted response
   */
  async handleDelete(args = '') {
    try {
      if (!this.db) {
        return '❌ Database not available. Cannot delete entries.';
      }

      const parts = (args || '').trim().split(/\s+/).filter(Boolean);
      const isConfirm = parts[0] && parts[0].toLowerCase() === 'confirm';

      // Index-only flow:
      // - /delete [n] or /delete show [n] -> preview last n (default 5, max 10)
      // - /delete confirm 1,3,4 -> delete specific items by indices (mapped to last 10 entries)

      if (!isConfirm) {
        // /delete, /delete 7, or /delete show 7
        const showMode = parts[0] && parts[0].toLowerCase() === 'show';
        const numStr = showMode ? parts[1] : parts[0];
        let n = parseInt(numStr, 10);
        if (isNaN(n) || n <= 0) n = 5;
        n = Math.min(Math.max(n, 1), 10);

        const entries = await this.db.getLastEntries(n);
        if (entries.length === 0) {
          return '🗑️ No entries found to delete.';
        }

        let preview = `🗑️ *Delete Preview* — Last ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}\n\n`;
        entries.forEach((e, i) => {
          const hours = this.parser.formatHours(e.hours);
          const tag = e.tag ? ` 🏷️ [${e.tag}]` : '';
          const date = moment(e.date).format('YYYY-MM-DD');
          const time = moment(e.timestamp).format('HH:mm');
          preview += `${i + 1}. ${hours}h${tag} — ${date} (🕒 ${time})\n`;
        });

        preview += `\nTo delete, reply with indices: \`/delete confirm 1,3,4\`\n` +
                   `Tip: Use \`/delete show 10\` to preview the 10 most recent entries before selecting indices.`;
        return preview;
      }

      // Confirm path
      const confirmArg = parts[1];
      if (!confirmArg) {
        return '❌ Please provide indices to delete. Example: `/delete confirm 1,3,4`';
      }

      if (/^\d+(?:,\d+)*$/.test(confirmArg)) {
        // Selective indices provided
        const indices = confirmArg.split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 10);
        if (indices.length === 0) {
          return '❌ No valid indices provided. Use numbers 1-10 separated by commas.';
        }

        // Build a mapping from preview to IDs by fetching last 10
        const previewEntries = await this.db.getLastEntries(10);
        const idsToDelete = indices
          .map(idx => previewEntries[idx - 1])
          .filter(Boolean)
          .map(e => e._id || e.id);

        if (idsToDelete.length === 0) {
          return 'ℹ️ Nothing matched those indices.';
        }

        const result = await this.db.deleteEntriesByIds(idsToDelete);
        if (!result.deleted) {
          return 'ℹ️ Nothing deleted.';
        }

        let resp = `✅ Deleted ${result.deleted} entr${result.deleted === 1 ? 'y' : 'ies'}:\n\n`;
        result.entries.forEach((e, i) => {
          const hours = this.parser.formatHours(e.hours);
          const tag = e.tag ? ` 🏷️ [${e.tag}]` : '';
          const date = moment(e.date).format('YYYY-MM-DD');
          const time = moment(e.timestamp).format('HH:mm');
          resp += `${i + 1}. ${hours}h${tag} — ${date} (🕒 ${time})\n`;
        });
        return resp;
      }

      // If confirmArg is not a comma-separated list of indices, reject
      return '❌ Invalid confirmation format. Use indices only, e.g., `/delete confirm 1,2,5`';
    } catch (error) {
      console.error('Error in handleDelete:', error);
      return '❌ Error deleting entries. Please try again.';
    }
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
      let response = `📊 *Work Summary*\n\n` +
        `📅 *This Week:* ${weekHours} hours (${weekEntries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(week.weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(week.saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(week.sundayHours)}h\n\n` +
        `🗓️ *This Month:* ${monthHours} hours (${monthEntries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(month.weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(month.saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(month.sundayHours)}h`;

      if (PAY_RATES_ENABLED) {
        const weekPay = calculatePayTotals(week);
        const monthPay = calculatePayTotals(month);
        const weekPayTotal = weekPay.weekday + weekPay.saturday + weekPay.sunday;
        const monthPayTotal = monthPay.weekday + monthPay.saturday + monthPay.sunday;

        response += `\n\n💰 *Estimated Earnings*\n` +
          `   📅 This Week: ${formatCurrency(weekPayTotal)}\n` +
          `      • Weekdays: ${formatCurrency(weekPay.weekday)}\n` +
          `      • Saturday: ${formatCurrency(weekPay.saturday)}\n` +
          `      • Sunday: ${formatCurrency(weekPay.sunday)}\n` +
          `   🗓️ This Month: ${formatCurrency(monthPayTotal)}\n` +
          `      • Weekdays: ${formatCurrency(monthPay.weekday)}\n` +
          `      • Saturday: ${formatCurrency(monthPay.saturday)}\n` +
          `      • Sunday: ${formatCurrency(monthPay.sunday)}`;
      }

      return response;
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
        `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h\n`;

      if (PAY_RATES_ENABLED) {
        const todayPay = calculatePayTotals({
          weekdayHours,
          saturdayHours,
          sundayHours
        });
        const todayPayTotal = todayPay.weekday + todayPay.saturday + todayPay.sunday;

        response += `\n💰 Estimated Earnings: ${formatCurrency(todayPayTotal)}\n` +
          `   🏢 Weekdays: ${formatCurrency(todayPay.weekday)}\n` +
          `   📆 Saturday: ${formatCurrency(todayPay.saturday)}\n` +
          `   ☀️ Sunday: ${formatCurrency(todayPay.sunday)}\n`;
      }

      response += `\n`;
      
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
      let entries = await this.db.getEntriesBetween(cycleStart, cycleEnd);
      entries = Array.isArray(entries) ? entries : [];

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

      let response = `🗓️ *Current Pay Cycle* (${cycleStart} to ${cycleEnd})\n\n` +
        `   ⏳ Total: ${formattedTotal} hours (${entries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h`;

      if (PAY_RATES_ENABLED) {
        const cyclePay = calculatePayTotals({
          weekdayHours,
          saturdayHours,
          sundayHours
        });
        const cyclePayTotal = cyclePay.weekday + cyclePay.saturday + cyclePay.sunday;

        response += `\n\n💰 Estimated Earnings: ${formatCurrency(cyclePayTotal)}\n` +
          `   🏢 Weekdays: ${formatCurrency(cyclePay.weekday)}\n` +
          `   📆 Saturday: ${formatCurrency(cyclePay.saturday)}\n` +
          `   ☀️ Sunday: ${formatCurrency(cyclePay.sunday)}`;
      }

      if (!entries || entries.length === 0) {
        return response + '\n\n📄 No entries found in this cycle.';
      }

      // Newest first by timestamp
      entries.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      const totalCount = entries.length;
      const cap = 50;
      const truncated = totalCount > cap;
      if (truncated) {
        entries = entries.slice(0, cap);
      }

      const displayedCount = entries.length;
      response += `\n\n📄 *Entries (newest first)* — Showing ${displayedCount}${truncated ? ` of ${totalCount}` : ''} entr${displayedCount === 1 ? 'y' : 'ies'}\n\n`;

      entries.forEach((e, i) => {
        const date = moment(e.date).format('YYYY-MM-DD');
        const time = e.timestamp ? moment(e.timestamp).format('HH:mm') : '--:--';
        const hours = this.parser.formatHours(e.hours);
        const tag = e.tag ? ` 🏷️ [${e.tag}]` : '';
        response += `${i + 1}. ${date} ${time} — ${hours}h${tag}\n`;
      });

      if (truncated) {
        response += `\nℹ️ List truncated to ${cap} most recent entries.`;
      }

      return response;
    } catch (error) {
      console.error('Error in handlePayCycle:', error);
      return '❌ Error generating pay cycle summary. Please try again.';
    }
  }

  /**
   * Legacy handler to support /paycyclelog and /paycycle detail aliases.
   *
   * @returns {Promise<string>} Consolidated pay cycle summary and entry list
   */
  async handlePayCycleLog() {
    try {
      // Reuse consolidated pay cycle handler so aliases return identical output
      return await this.handlePayCycle();
    } catch (error) {
      console.error('Error in handlePayCycleLog:', error);
      return '❌ Error generating pay cycle log. Please try again.';
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
          `• /paycycle - Current pay cycle summary with detailed entry list\n` +
           `• /delete [n] - Preview last n entries (default 5, max 10)\n` +
           `• /delete confirm 1,3,4 - Delete specific items by preview index (1-10)\n` +
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

  /**
   * Handles /reminder command - manages daily reminder settings
   * 
   * @param {string} action - Action to perform (status, start, stop, test, config)
   * @returns {Promise<string>} Formatted reminder management response
   */
  async handleReminder(action = 'status') {
    try {
      // This would need access to the reminder instance
      // For now, provide static information about reminder functionality
      
      const actionLower = action.toLowerCase();
      
      switch (actionLower) {
        case 'status':
          return `🔔 *Daily Reminder Status*\n\n` +
                 `⏰ *Schedule:* Random time between 3:00 PM - 11:00 PM\n` +
                 `📅 *Active Days:* Monday - Friday\n` +
                 `🎯 *Purpose:* Reminds you to log your daily work hours\n` +
                 `🤖 *Smart Skip:* Won't remind if you've already logged hours today\n\n` +
                 `💡 *Note:* Reminders work best in always-on deployments.\n` +
                 `For serverless platforms, consider external cron services.\n\n` +
                 `⚡ *Commands:*\n` +
                 `• \`/reminder status\` - Show this status\n` +
                 `• \`/reminder test\` - Send test reminder now\n` +
                 `• \`/reminder info\` - Detailed information`;
        
        case 'test':
          // This would trigger a manual reminder
          return `🧪 *Test Reminder*\n\n` +
                 `⏰ Time to log your work hours! How many hours did you work today?\n\n` +
                 `💡 *This is what your daily reminders look like!*\n` +
                 `Actual reminders will be sent randomly between 3:00 PM - 11:00 PM on weekdays.\n\n` +
                 `📝 Just reply with something like: "Worked 8 hours today"`;
        
        case 'info':
          return `📋 *Daily Reminder Information*\n\n` +
                 `🎯 **Purpose:** Encourage consistent work hour logging\n\n` +
                 `⏰ **Timing:**\n` +
                 `   • Random time between 3:00 PM - 11:00 PM\n` +
                 `   • Only on weekdays (Monday - Friday)\n` +
                 `   • Different time each day to stay engaging\n\n` +
                 `🧠 **Smart Features:**\n` +
                 `   • Skips reminder if you've already logged hours\n` +
                 `   • Contextual messages based on time of day\n` +
                 `   • 20+ different reminder messages to avoid repetition\n\n` +
                 `💬 **Message Examples:**\n` +
                 `   • "⏰ Time to log your work hours!"\n` +
                 `   • "📊 Daily check-in: How many hours today?"\n` +
                 `   • "🌟 Time to record today's work hours!"\n\n` +
                 `🔧 **For Developers:**\n` +
                 `   • Works in always-on server environments\n` +
                 `   • Limited functionality in serverless deployments\n` +
                 `   • Can integrate with external cron services`;
        
        default:
          return `❌ Unknown reminder action: "${action}"\n\n` +
                 `Available actions:\n` +
                 `• \`/reminder status\` - Show reminder status\n` +
                 `• \`/reminder test\` - Send test reminder\n` +
                 `• \`/reminder info\` - Detailed information`;
      }
      
    } catch (error) {
      console.error('Error in handleReminder:', error);
      return '❌ Error managing reminder settings. Please try again.';
    }
  }
}

module.exports = Commands;
