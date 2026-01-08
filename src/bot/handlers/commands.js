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
 * Calculates the last N pay cycles (including current cycle)
 * 
 * Pay cycles are 14-day periods starting from PAY_CYCLE_START.
 * This function returns an array of pay cycle objects, starting from the current cycle
 * and going back N-1 cycles.
 * 
 * @param {number} count - Number of pay cycles to return (default: 5, max: 10)
 * @param {moment.Moment} today - Current date (defaults to today)
 * @returns {Array<Object>} Array of pay cycle objects with cycleStart and cycleEnd
 */
function getPayCycles(count = 5, today = moment()) {
  const maxCycles = 10;
  const numCycles = Math.min(Math.max(1, Math.floor(count)), maxCycles);
  
  const start = moment(PAY_CYCLE_START).startOf('day');
  const currentDate = moment(today).startOf('day');
  
  // Calculate days difference from the start date
  const daysSinceStart = currentDate.diff(start, 'days');
  
  // Calculate which cycle we're currently in (0-based)
  let currentCycleIndex = 0;
  if (daysSinceStart >= 0) {
    currentCycleIndex = Math.floor(daysSinceStart / 14);
  }
  
  const cycles = [];
  
  // Generate cycles going backwards from current cycle
  for (let i = 0; i < numCycles; i++) {
    const cycleIndex = currentCycleIndex - i;
    
    // Don't go before the first cycle
    if (cycleIndex < 0) {
      break;
    }
    
    const cycleStart = start.clone().add(cycleIndex * 14, 'days');
    const cycleEnd = cycleStart.clone().add(13, 'days'); // 14 days total (0-13)
    
    cycles.push({
      cycleStart: cycleStart.format('YYYY-MM-DD'),
      cycleEnd: cycleEnd.format('YYYY-MM-DD'),
      cycleNumber: cycleIndex + 1, // 1-based cycle number
      isCurrent: i === 0 // First cycle in array is the current one
    });
  }
  
  return cycles;
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
  sunday: parseRate(process.env.PAY_RATE_SUNDAY) ?? WEEKEND_RATE ?? FALLBACK_RATE ?? 0,
  holiday: parseRate(process.env.PAY_RATE_HOLIDAY) ?? FALLBACK_RATE ?? 0
};

const PAY_RATE_LOCALE = process.env.PAY_RATE_LOCALE || 'en-AU';
const PAY_RATE_CURRENCY = process.env.PAY_RATE_CURRENCY || 'AUD';
const PAY_RATE_SYMBOL = process.env.PAY_RATE_SYMBOL || '$';

const HOLIDAY_TAGS = (process.env.PAY_RATE_HOLIDAY_TAGS || 'holiday,public_holiday,public holiday')
  .split(',')
  .map(tag => tag.trim().toLowerCase())
  .filter(Boolean);

const HOLIDAY_LABEL = (process.env.PAY_RATE_HOLIDAY_MESSAGE || 'Holiday').trim() || 'Holiday';
const HOLIDAY_ICON = '🎉';
const HOLIDAY_DISPLAY = `${HOLIDAY_ICON} ${HOLIDAY_LABEL}`;

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

function isHolidayEntry(entry) {
  if (!entry || !entry.tag) {
    return false;
  }
  return HOLIDAY_TAGS.includes(String(entry.tag).trim().toLowerCase());
}

function calculateHoursByType(entries = []) {
  const result = {
    weekdayHours: 0,
    saturdayHours: 0,
    sundayHours: 0,
    total: 0,
    holiday: {
      total: 0,
      weekday: 0,
      saturday: 0,
      sunday: 0
    }
  };

  if (!Array.isArray(entries)) {
    return result;
  }

  entries.forEach(entry => {
    const hours = Number(entry?.hours) || 0;
    if (hours <= 0) {
      return;
    }

    const dayOfWeek = moment(entry.date).day();
    const holiday = isHolidayEntry(entry);

    if (dayOfWeek === 0) {
      result.sundayHours += hours;
      if (holiday) {
        result.holiday.sunday += hours;
      }
    } else if (dayOfWeek === 6) {
      result.saturdayHours += hours;
      if (holiday) {
        result.holiday.saturday += hours;
      }
    } else {
      result.weekdayHours += hours;
      if (holiday) {
        result.holiday.weekday += hours;
      }
    }

    if (holiday) {
      result.holiday.total += hours;
    }

    result.total += hours;
  });

  return result;
}

function calculatePayTotals({
  weekdayHours = 0,
  saturdayHours = 0,
  sundayHours = 0,
  holidayHours = {}
} = {}) {
  const holidayWeekday = Math.min(holidayHours.weekday || 0, weekdayHours);
  const holidaySaturday = Math.min(holidayHours.saturday || 0, saturdayHours);
  const holidaySunday = Math.min(holidayHours.sunday || 0, sundayHours);

  const effectiveWeekday = Math.max(weekdayHours - holidayWeekday, 0);
  const effectiveSaturday = Math.max(saturdayHours - holidaySaturday, 0);
  const effectiveSunday = Math.max(sundayHours - holidaySunday, 0);

  return {
    weekday: effectiveWeekday * PAY_RATES.weekday,
    saturday: effectiveSaturday * PAY_RATES.saturday,
    sunday: effectiveSunday * PAY_RATES.sunday,
    holiday: (holidayHours.total || 0) * PAY_RATES.holiday
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
        return '❌ <b>Database not available.</b> Cannot delete entries.';
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

        let preview = `🗑️ <b>Delete Preview</b> — Last ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}\n\n`;
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
        return '❌ <b>Please provide indices to delete.</b> Example: `/delete confirm 1,3,4`';
      }

      if (/^\d+(?:,\d+)*$/.test(confirmArg)) {
        // Selective indices provided
        const indices = confirmArg.split(',').map(s => parseInt(s, 10)).filter(n => n >= 1 && n <= 10);
        if (indices.length === 0) {
          return '❌ <b>No valid indices provided.</b> Use numbers 1-10 separated by commas.';
        }

        // Build a mapping from preview to IDs by fetching last 10
        const previewEntries = await this.db.getLastEntries(10);
        const idsToDelete = indices
          .map(idx => previewEntries[idx - 1])
          .filter(Boolean)
          .map(e => e._id || e.id);

        if (idsToDelete.length === 0) {
          return 'ℹ️ <b>Nothing matched those indices.</b>';
        }

        const result = await this.db.deleteEntriesByIds(idsToDelete);
        if (!result.deleted) {
          return 'ℹ️ <b>Nothing deleted.</b>';
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
      return '❌ <b>Invalid confirmation format.</b> Use indices only, e.g., `/delete confirm 1,2,5`';
    } catch (error) {
      console.error('Error in handleDelete:', error);
      return '❌ <b>Error deleting entries.</b> Please try again.';
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

      const week = calculateHoursByType(weekEntries);
      const month = calculateHoursByType(monthEntries);

      // Format hours for display using parser utility
      const weekHours = this.parser.formatHours(week.total);
      const monthHours = this.parser.formatHours(month.total);

      // Build formatted response message with emojis for better UX
      let response = `📊 <b>Work Summary</b>\n\n` +
        `📅 <b>This Week:</b> ${weekHours} hours (${weekEntries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(week.weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(week.saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(week.sundayHours)}h\n\n` +
        `🗓️ <b>This Month:</b> ${monthHours} hours (${monthEntries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(month.weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(month.saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(month.sundayHours)}h`;

      if (week.holiday.total > 0) {
        response += `\n   ${HOLIDAY_DISPLAY}: ${this.parser.formatHours(week.holiday.total)}h`;
      }

      if (month.holiday.total > 0) {
        response += `\n   ${HOLIDAY_DISPLAY}: ${this.parser.formatHours(month.holiday.total)}h`;
      }

      if (PAY_RATES_ENABLED) {
        const weekPay = calculatePayTotals({
          weekdayHours: week.weekdayHours,
          saturdayHours: week.saturdayHours,
          sundayHours: week.sundayHours,
          holidayHours: week.holiday
        });
        const monthPay = calculatePayTotals({
          weekdayHours: month.weekdayHours,
          saturdayHours: month.saturdayHours,
          sundayHours: month.sundayHours,
          holidayHours: month.holiday
        });
        const weekPayTotal = weekPay.weekday + weekPay.saturday + weekPay.sunday + weekPay.holiday;
        const monthPayTotal = monthPay.weekday + monthPay.saturday + monthPay.sunday + monthPay.holiday;

        const weekLines = [
          `   📅 <b>This Week:</b> ${formatCurrency(weekPayTotal)}`,
          `      • Weekdays: ${formatCurrency(weekPay.weekday)}`,
          `      • Saturday: ${formatCurrency(weekPay.saturday)}`,
          `      • Sunday: ${formatCurrency(weekPay.sunday)}`
        ];
        if (PAY_RATES.holiday > 0 || week.holiday.total > 0 || weekPay.holiday > 0) {
          weekLines.push(`      • ${HOLIDAY_DISPLAY}: ${formatCurrency(weekPay.holiday)}`);
        }

        const monthLines = [
          `   🗓️ <b>This Month:</b> ${formatCurrency(monthPayTotal)}`,
          `      • Weekdays: ${formatCurrency(monthPay.weekday)}`,
          `      • Saturday: ${formatCurrency(monthPay.saturday)}`,
          `      • Sunday: ${formatCurrency(monthPay.sunday)}`
        ];
        if (PAY_RATES.holiday > 0 || month.holiday.total > 0 || monthPay.holiday > 0) {
          monthLines.push(`      • ${HOLIDAY_DISPLAY}: ${formatCurrency(monthPay.holiday)}`);
        }

        response += `\n\n💰 <b>Estimated Earnings</b>\n` + weekLines.join('\n') + '\n' + monthLines.join('\n');
      }

      return response;
    } catch (error) {
      console.error('Error in handleSummary:', error);
      return '❌ <b>Error generating summary.</b> Please try again.';
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

      const totals = calculateHoursByType(entries);
      const { weekdayHours, saturdayHours, sundayHours, holiday } = totals;

      const total = totals.total;
      const formattedTotal = this.parser.formatHours(total);

      // Build response with individual entries
      let response = `📅 <b>Today's Work Log</b> (${formattedTotal} hours total)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h`;

      if (holiday.total > 0) {
        response += `\n   ${HOLIDAY_DISPLAY}: ${this.parser.formatHours(holiday.total)}h`;
      }

      response += `\n\n`;

      if (PAY_RATES_ENABLED) {
        const todayPay = calculatePayTotals({
          weekdayHours,
          saturdayHours,
          sundayHours,
          holidayHours: holiday
        });
        const todayPayTotal = todayPay.weekday + todayPay.saturday + todayPay.sunday + todayPay.holiday;

        const payLines = [
          `💰 <b>Estimated Earnings</b>: ${formatCurrency(todayPayTotal)}`,
          `   🏢 Weekdays: ${formatCurrency(todayPay.weekday)}`,
          `   📆 Saturday: ${formatCurrency(todayPay.saturday)}`,
          `   ☀️ Sunday: ${formatCurrency(todayPay.sunday)}`
        ];
        if (PAY_RATES.holiday > 0 || holiday.total > 0 || todayPay.holiday > 0) {
          payLines.push(`   ${HOLIDAY_DISPLAY}: ${formatCurrency(todayPay.holiday)}`);
        }

        response += payLines.join('\n') + '\n';
      }
      
      // Add individual entry details
      entries.forEach((entry, index) => {
        const hours = this.parser.formatHours(entry.hours);
        const tag = entry.tag ? ` 🏷️ [${entry.tag}]` : '';
        const time = moment(entry.timestamp).format('HH:mm');
        const holidaySuffix = isHolidayEntry(entry) ? ` ${HOLIDAY_DISPLAY}` : '';
        response += `${index + 1}. ${hours}h${tag}${holidaySuffix} (🕒 ${time})\n`;
      });

      return response;
    } catch (error) {
      console.error('Error in handleToday:', error);
      return '❌ <b>Error retrieving today\'s entries.</b> Please try again.';
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
      let response = '📝 <b>Last 5 Work Entries</b>\n\n';
      
      // Format each entry with date and time information
      entries.forEach((entry, index) => {
        const hours = this.parser.formatHours(entry.hours);
        const tag = entry.tag ? ` 🏷️ [${entry.tag}]` : '';
        const date = moment(entry.date).format('MMM DD'); // e.g., "Jan 15"
        const time = moment(entry.timestamp).format('HH:mm'); // e.g., "14:30"
        const holidaySuffix = isHolidayEntry(entry) ? ` ${HOLIDAY_DISPLAY}` : '';
        response += `${index + 1}. ${hours}h${tag}${holidaySuffix} on 📅 ${date} (🕒 ${time})\n`;
      });

      return response;
    } catch (error) {
      console.error('Error in handleLog:', error);
      return '❌ <b>Error retrieving work log.</b> Please try again.';
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
    if (!tag || typeof tag !== 'string' || tag.trim().length === 0) {
      if (!this.db) {
        return '🏷️ Unable to list categories right now. Please try again shortly.';
      }

      try {
        const stats = await this.db.getDatabaseStats();
        const tags = (stats?.tags || [])
          .map(t => String(t || '').trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));

        if (tags.length === 0) {
          return '🏷️ No categories available yet. Add one by including a keyword in your log, e.g. "Worked 4 hours on projectX".';
        }

        const limit = 50;
        const displayed = tags.slice(0, limit);
        let response = '🏷️ <b>Available Tags</b>\n\n' + displayed.map(t => `• ${t}`).join('\n');

        if (tags.length > limit) {
          response += `\n… +${tags.length - limit} more`;
        }

        response += '\n\nUse `/category <tag>` to view totals for a specific category.';
        return response;
      } catch (error) {
        console.error('Error retrieving category list:', error);
        return '❌ <b>Unable to retrieve category list.</b> Please try again.';
      }
    }

    const trimmedTag = tag.trim();

    try {
      // Get aggregated data for the specified tag
      const data = await this.db.getCategoryTotal(trimmedTag);
      
      // Handle case where no work was logged under this category
      if (data.totalHours === 0) {
        return `📊 No work logged under category "${trimmedTag}".`;
      }

      // Format and return category summary
      const hours = this.parser.formatHours(data.totalHours);
      return `🗂️ <b>Category:</b> "${trimmedTag}"\n\n` +
             `⏱️ Total Hours: ${hours}\n` +
             `📝 Total Entries: ${data.entries}`;
    } catch (error) {
      console.error('Error in handleCategory:', error);
      return '❌ <b>Error retrieving category data.</b> Please try again.';
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

      const totals = calculateHoursByType(entries);
      const { weekdayHours, saturdayHours, sundayHours, holiday } = totals;

      const total = totals.total;
      const formattedTotal = this.parser.formatHours(total);

      let response = `🗓️ <b>Current Pay Cycle</b> (${cycleStart} to ${cycleEnd})\n\n` +
        `   ⏳ Total: ${formattedTotal} hours (${entries.length} entries)\n` +
        `   🏢 Weekdays: ${this.parser.formatHours(weekdayHours)}h\n` +
        `   📆 Saturday: ${this.parser.formatHours(saturdayHours)}h\n` +
        `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h`;

      if (holiday.total > 0) {
        response += `\n   ${HOLIDAY_DISPLAY}: ${this.parser.formatHours(holiday.total)}h`;
      }

      if (PAY_RATES_ENABLED) {
        const cyclePay = calculatePayTotals({
          weekdayHours,
          saturdayHours,
          sundayHours,
          holidayHours: holiday
        });
        const cyclePayTotal = cyclePay.weekday + cyclePay.saturday + cyclePay.sunday + cyclePay.holiday;

        const payLines = [
          `\n\n💰 <b>Estimated Earnings</b>: ${formatCurrency(cyclePayTotal)}`,
          `   🏢 Weekdays: ${formatCurrency(cyclePay.weekday)}`,
          `   📆 Saturday: ${formatCurrency(cyclePay.saturday)}`,
          `   ☀️ Sunday: ${formatCurrency(cyclePay.sunday)}`
        ];
        if (PAY_RATES.holiday > 0 || holiday.total > 0 || cyclePay.holiday > 0) {
          payLines.push(`   ${HOLIDAY_DISPLAY}: ${formatCurrency(cyclePay.holiday)}`);
        }

        response += payLines.join('\n');
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
      response += `\n\n📄 <b>Entries (newest first)</b> — Showing ${displayedCount}${truncated ? ` of ${totalCount}` : ''} entr${displayedCount === 1 ? 'y' : 'ies'}\n\n`;

      entries.forEach((e, i) => {
        const date = moment(e.date).format('YYYY-MM-DD');
        const time = e.timestamp ? moment(e.timestamp).format('HH:mm') : '--:--';
        const hours = this.parser.formatHours(e.hours);
        const tag = e.tag ? ` 🏷️ [${e.tag}]` : '';
        const holidaySuffix = isHolidayEntry(e) ? ` ${HOLIDAY_DISPLAY}` : '';
        response += `${i + 1}. ${date} ${time} — ${hours}h${tag}${holidaySuffix}\n`;
      });

      if (truncated) {
        response += `\nℹ️ List truncated to ${cap} most recent entries.`;
      }

      return response;
    } catch (error) {
      console.error('Error in handlePayCycle:', error);
      return '❌ <b>Error generating pay cycle summary.</b> Please try again.';
    }
  }

  /**
   * Handles /paycycles command - shows hours for the last 5 pay cycles
   * 
   * Displays work hours summary for the last 5 pay cycles (including current) with:
   * - Pay cycle date ranges
   * - Total hours and breakdown by day type for each cycle
   * - Entry counts
   * - Pay estimates if configured
   * 
   * @returns {Promise<string>} Formatted pay cycles summary
   */
  async handlePayCycles() {
    try {
      if (!this.db) {
        return '❌ <b>Database not available.</b> Cannot retrieve pay cycles.';
      }

      const cycles = getPayCycles(5);
      
      if (cycles.length === 0) {
        return '📅 No pay cycles found.';
      }

      let response = `📊 Last ${cycles.length} Pay Cycles\n\n`;

      // Process each cycle
      const cycleSummaries = [];
      for (const cycle of cycles) {
        const entries = await this.db.getEntriesBetween(cycle.cycleStart, cycle.cycleEnd);
        const totals = calculateHoursByType(entries);
        const { weekdayHours, saturdayHours, sundayHours, holiday } = totals;
        const total = totals.total;
        
        let cyclePay = null;
        if (PAY_RATES_ENABLED) {
          cyclePay = calculatePayTotals({
            weekdayHours,
            saturdayHours,
            sundayHours,
            holidayHours: holiday
          });
        }

        cycleSummaries.push({
          ...cycle,
          entries: Array.isArray(entries) ? entries : [],
          totals,
          pay: cyclePay
        });
      }

      // Build response for each cycle
      cycleSummaries.forEach((summary, index) => {
        const { cycleStart, cycleEnd, isCurrent, entries, totals, pay } = summary;
        const { weekdayHours, saturdayHours, sundayHours, holiday } = totals;
        const formattedTotal = this.parser.formatHours(totals.total);
        const currentLabel = isCurrent ? ' (Current)' : '';
        
        response += `🗓️ <b>Cycle ${cycleSummaries.length - index}${currentLabel}: ${cycleStart} to ${cycleEnd}\n`;
        response += `   ⏳ Total: ${formattedTotal} hours (${entries.length} entries)\n`;
        response += `   🏢 Weekdays: ${this.parser.formatHours(weekdayHours)}h\n`;
        response += `   📆 Saturday: ${this.parser.formatHours(saturdayHours)}h\n`;
        response += `   ☀️ Sunday: ${this.parser.formatHours(sundayHours)}h`;
        
        if (holiday.total > 0) {
          response += `\n   ${HOLIDAY_DISPLAY}: ${this.parser.formatHours(holiday.total)}h`;
        }

        if (PAY_RATES_ENABLED && pay) {
          const cyclePayTotal = pay.weekday + pay.saturday + pay.sunday + pay.holiday;
          response += `\n   💰 Earnings: ${formatCurrency(cyclePayTotal)}`;
        }

        response += '\n\n';
      });

      // Add summary totals
      const grandTotals = {
        totalHours: 0,
        totalEntries: 0,
        weekdayHours: 0,
        saturdayHours: 0,
        sundayHours: 0,
        holidayTotal: 0,
        totalPay: 0
      };

      cycleSummaries.forEach(summary => {
        grandTotals.totalHours += summary.totals.total;
        grandTotals.totalEntries += summary.entries.length;
        grandTotals.weekdayHours += summary.totals.weekdayHours;
        grandTotals.saturdayHours += summary.totals.saturdayHours;
        grandTotals.sundayHours += summary.totals.sundayHours;
        grandTotals.holidayTotal += summary.totals.holiday.total;
        if (summary.pay) {
          grandTotals.totalPay += summary.pay.weekday + summary.pay.saturday + summary.pay.sunday + summary.pay.holiday;
        }
      });

      response += `📈 <b>Summary (${cycles.length} cycles):\n`;
      response += `   ⏳ Total Hours: ${this.parser.formatHours(grandTotals.totalHours)}h\n`;
      response += `   📝 Total Entries: ${grandTotals.totalEntries}\n`;
      response += `   🏢 Weekdays: ${this.parser.formatHours(grandTotals.weekdayHours)}h\n`;
      response += `   📆 Saturday: ${this.parser.formatHours(grandTotals.saturdayHours)}h\n`;
      response += `   ☀️ Sunday: ${this.parser.formatHours(grandTotals.sundayHours)}h`;
      
      if (grandTotals.holidayTotal > 0) {
        response += `\n   ${HOLIDAY_DISPLAY}: ${this.parser.formatHours(grandTotals.holidayTotal)}h`;
      }

      if (PAY_RATES_ENABLED && grandTotals.totalPay > 0) {
        response += `\n   💰 Total Earnings: ${formatCurrency(grandTotals.totalPay)}`;
      }

      return response;
    } catch (error) {
      console.error('Error in handlePayCycles:', error);
      return '❌ <b>Error generating pay cycles summary.</b> Please try again.';
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
    
    let payRateSection = '';
    if (PAY_RATES_ENABLED) {
      const rateLines = [];
      if (PAY_RATES.weekday > 0) {
        rateLines.push(`   🏢 Weekdays: ${formatCurrency(PAY_RATES.weekday)} per hour`);
      }
      if (PAY_RATES.saturday > 0) {
        rateLines.push(`   📆 Saturday: ${formatCurrency(PAY_RATES.saturday)} per hour`);
      }
      if (PAY_RATES.sunday > 0) {
        rateLines.push(`   ☀️ Sunday: ${formatCurrency(PAY_RATES.sunday)} per hour`);
      }
      if (PAY_RATES.holiday > 0) {
        rateLines.push(`   ${HOLIDAY_DISPLAY}: ${formatCurrency(PAY_RATES.holiday)} per hour`);
      }
      if (rateLines.length > 0) {
        payRateSection = `\n\n💰 <b>Configured Pay Rates:</b>\n` + rateLines.join('\n');
      }
    }

    return `🤖 <b>Work Hours Bot Help</b>\n\n` +
           `👋 <b>Welcome!</b> Your work hours tracking bot is ready.\n\n` +
           `📅 <b>Current Pay Cycle</b>: ${cycleStart} to ${cycleEnd}\n\n` +
           `💡 <b>Quick Start:</b>\n` +
           `• Send a message like "Worked 6 hours today"\n` +
           `• Use /summary to see weekly and monthly totals\n` +
           `• Use /paycycle to check current cycle hours\n` +
           `• Use /paycycles to view last 5 pay cycles for payslip verification\n\n` +
           `📝 <b>Log work by sending messages like:</b>\n` +
           `• "Worked 6 hours today"\n` +
           `• "5.5 hrs on freelance"\n` +
           `• "Yesterday I did 3 hours on project X"\n` +
           `• "8.25 hours coding on 12/15"\n` +
           `• "Worked 8 hours on holiday" (uses holiday pay rate)\n` +
           `• "7.5 hours on public holiday" (uses holiday pay rate)\n\n` +
           `⚡ <b>Available <b>Commands:</b></b>\n` +
           `• /summary - Weekly and monthly totals with day breakdown\n` +
           `• /today - Today's logged hours and entries\n` +
           `• /log - Last 5 work entries with timestamps\n` +
           `• /category [tag] - Hours for specific category/project\n` +
           `• /paycycle - Current pay cycle summary with detailed entry list\n` +
           `• /paycycles - Last 5 pay cycles summary with totals and pay estimates\n` +
           `• /delete [n] - Preview last n entries (default 5, max 10)\n` +
           `• /delete confirm 1,3,4 - Delete specific items by preview index (1-10)\n` +
           `• /help - Show this help message\n\n` +
           `🔧 <b>Admin <b>Commands:</b></b>\n` +
           `• /stats - Database statistics and overview\n` +
           `• /reset confirm - Reset database (⚠️ DESTRUCTIVE)\n` +
           `• /validate - Check database integrity\n\n` +
           `🏷️ <b>Tips:</b>\n` +
           `• Tags are automatically extracted (e.g., "coding", "client work")\n` +
           `• Supports various time formats (6h, 5.5 hours, 3 hrs)\n` +
           `• Recognizes "today", "yesterday", and specific dates\n` +
           `• Use tags like "holiday", "public_holiday", or "public holiday" for holiday pay rates\n` +
           `• All data is stored securely in your database` +
           payRateSection;
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

      return `📊 <b>Database Statistics</b>\n\n` +
             `📈 <b>Overview:</b>\n` +
             `   📝 Total Entries: ${stats.totalEntries}\n` +
             `   ⏱️ Total Hours: ${formattedTotalHours}\n` +
             `   📅 Date Range: ${dateRangeText}\n` +
             `   🏷️ Categories: ${stats.uniqueTags}\n\n` +
             `🏷️ <b>Available Tags:</b>\n` +
             `   ${tagsText}\n\n` +
             `ℹ️ Use /validate to check database integrity`;
    } catch (error) {
      console.error('Error in handleStats:', error);
      return '❌ <b>Error retrieving database statistics.</b> Please try again.';
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
        return `✅ <b>Database Validation Complete</b>\n\n` +
               `🎉 No issues found! Your database is healthy.\n\n` +
               `📊 Validation completed at: ${new Date(validation.validationTimestamp).toLocaleString()}`;
      } else {
        let response = `⚠️ <b>Database Validation Complete</b>\n\n` +
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
      return '❌ <b>Error validating database.</b> Please try again.';
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
          return `📊 <b>Database Reset</b>\n\n` +
                 `ℹ️ Database is already empty (0 entries).\n` +
                 `No reset needed.`;
        }
        
        const formattedTotalHours = this.parser.formatHours(stats.totalHours);
        const dateRangeText = stats.dateRange.earliest && stats.dateRange.latest
          ? `${stats.dateRange.earliest} to ${stats.dateRange.latest}`
          : 'No entries';
        
        return `⚠️ <b>DATABASE RESET WARNING</b>\n\n` +
               `🚨 This will permanently delete ALL work entries!\n\n` +
               `📊 <b>Current Database:</b>\n` +
               `   📝 Entries: ${stats.totalEntries}\n` +
               `   ⏱️ Hours: ${formattedTotalHours}\n` +
               `   📅 Range: ${dateRangeText}\n` +
               `   🏷️ Categories: ${stats.uniqueTags}\n\n` +
               `💾 A backup will be created before deletion.\n\n` +
               `⚠️ <b>TO CONFIRM RESET, SEND:</b>\n` +
               `\`/reset confirm\`\n\n` +
               `❌ <b>This action cannot be undone!</b>`;
      }

      // Proceed with reset
      const resetResult = await this.db.resetDatabase(true);
      
      if (resetResult.success) {
        return `✅ <b>Database Reset</b> Complete\n\n` +
               `🗑️ Deleted ${resetResult.deletedEntries} entries\n` +
               `💾 Backup created: ${resetResult.backupCreated} entries\n` +
               `🕒 Reset at: ${new Date(resetResult.resetTimestamp).toLocaleString()}\n\n` +
               `🎉 You now have a fresh database!\n` +
               `📝 Start logging: "Worked 6 hours today"`;
      } else {
        return `❌ <b>Database reset failed.</b> Please check logs and try again.`;
      }
      
    } catch (error) {
      console.error('Error in handleReset:', error);
      return `❌ <b>Error during database reset:</b> ${error.message}\n\nPlease check your database connection and try again.`;
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
        return `📊 <b>Backup Status</b>\n\n` +
               `ℹ️ Database is empty (0 entries).\n` +
               `No backup needed.`;
      }
      
      // In a real implementation, you might want to save this to a file or cloud storage
      return `✅ <b>Backup Created</b>\n\n` +
             `💾 Backed up ${backupData.length} entries\n` +
             `🕒 Backup created at: ${new Date().toLocaleString()}\n\n` +
             `ℹ️ Backup is stored in memory during this session.\n` +
             `For permanent backups, consider exporting your data.`;
      
    } catch (error) {
      console.error('Error in handleBackup:', error);
      return '❌ <b>Error creating backup.</b> Please try again.';
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
          return `🔔 <b>Daily Reminder Status</b>\n\n` +
                 `⏰ <b>Schedule:</b> Random time between 3:00 PM - 11:00 PM\n` +
                 `📅 <b>Active Days:</b> Every day (Monday - Sunday)\n` +
                 `🎯 <b>Purpose:</b> Reminds you to log your daily work hours\n` +
                 `🤖 <b>Smart Skip:</b> Won't remind if you've already logged hours today\n\n` +
                 `💡 <b>Note:</b> Reminders work best in always-on deployments.\n` +
                 `For serverless platforms, consider external cron services.\n\n` +
                 `⚡ <b>Commands:</b>\n` +
                 `• \`/reminder status\` - Show this status\n` +
                 `• \`/reminder test\` - Send test reminder now\n` +
                 `• \`/reminder info\` - Detailed information`;
        
        case 'test':
          // This would trigger a manual reminder
          return `🧪 <b>Test Reminder</b>\n\n` +
                 `⏰ Time to log your work hours! How many hours did you work today?\n\n` +
                 `💡 <b>This is what your daily reminders look like!</b>\n` +
                 `Actual reminders will be sent randomly between 3:00 PM - 11:00 PM each day.\n\n` +
                 `📝 Just reply with something like: "Worked 8 hours today"`;
        
        case 'info':
          return `📋 <b>Daily Reminder Information</b>\n\n` +
                 `🎯 <b>Purpose:</b> Encourage consistent work hour logging\n\n` +
                 `⏰ <b>Timing:</b>\n` +
                 `   • Random time between 3:00 PM - 11:00 PM\n` +
                 `   • Every day of the week (Monday - Sunday)\n` +
                 `   • Different time each day to stay engaging\n\n` +
                 `🧠 <b>Smart Features:</b>\n` +
                 `   • Skips reminder if you've already logged hours\n` +
                 `   • Contextual messages based on time of day\n` +
                 `   • 20+ different reminder messages to avoid repetition\n\n` +
                 `💬 <b>Message Examples:</b>\n` +
                 `   • "⏰ Time to log your work hours!"\n` +
                 `   • "📊 Daily check-in: How many hours today?"\n` +
                 `   • "🌟 Time to record today's work hours!"\n\n` +
                 `🔧 <b>For Developers:</b>\n` +
                 `   • Works in always-on server environments\n` +
                 `   • Limited functionality in serverless deployments\n` +
                 `   • Can integrate with external cron services`;
        
        default:
          return `❌ <b>Unknown reminder action:</b> "${action}"\n\n` +
                 `Available actions:\n` +
                 `• \`/reminder status\` - Show reminder status\n` +
                 `• \`/reminder test\` - Send test reminder\n` +
                 `• \`/reminder info\` - Detailed information`;
      }
      
    } catch (error) {
      console.error('Error in handleReminder:', error);
      return '❌ <b>Error managing reminder settings.</b> Please try again.';
    }
  }
}

module.exports = Commands;
