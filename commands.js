const moment = require('moment');

// Class for handling bot commands like /summary, /today, /log, etc.
class Commands {
  constructor(database, messageParser) {
    // Store references to database and parser instances
    this.db = database;
    this.parser = messageParser;
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
      return `📊 **Work Summary**\n\n` +
             `📅 **This Week:** ${weekHours} hours (${weekEntries.length} entries)\n` +
             `   - Weekdays: ${this.parser.formatHours(week.weekdayHours)}h\n` +
             `   - Saturday: ${this.parser.formatHours(week.saturdayHours)}h\n` +
             `   - Sunday: ${this.parser.formatHours(week.sundayHours)}h\n` +
             `📅 **This Month:** ${monthHours} hours (${monthEntries.length} entries)\n` +
             `   - Weekdays: ${this.parser.formatHours(month.weekdayHours)}h\n` +
             `   - Saturday: ${this.parser.formatHours(month.saturdayHours)}h\n` +
             `   - Sunday: ${this.parser.formatHours(month.sundayHours)}h`;
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
      let response = `📅 **Today's Work Log** (${formattedTotal} hours total)\n` +
        `   - Weekdays: ${this.parser.formatHours(weekdayHours)}h\n` +
        `   - Saturday: ${this.parser.formatHours(saturdayHours)}h\n` +
        `   - Sunday: ${this.parser.formatHours(sundayHours)}h\n\n`;
      entries.forEach((entry, index) => {
        const hours = this.parser.formatHours(entry.hours);
        const tag = entry.tag ? ` [${entry.tag}]` : '';
        const time = moment(entry.timestamp).format('HH:mm');
        response += `${index + 1}. ${hours}h${tag} (logged at ${time})\n`;
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
      let response = '📝 **Last 5 Work Entries**\n\n';
      
      // Format each entry with date and time information
      entries.forEach((entry, index) => {
        const hours = this.parser.formatHours(entry.hours);
        const tag = entry.tag ? ` [${entry.tag}]` : '';
        const date = moment(entry.date).format('MMM DD');
        const time = moment(entry.timestamp).format('HH:mm');
        response += `${index + 1}. ${hours}h${tag} on ${date} (${time})\n`;
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
      return `📊 **Category: "${tag}"**\n\n` +
             `⏱️ Total Hours: ${hours}\n` +
             `📝 Total Entries: ${data.entries}`;
    } catch (error) {
      console.error('Error in handleCategory:', error);
      return '❌ Error retrieving category data. Please try again.';
    }
  }

  // Return help message with usage instructions and available commands
  getHelpMessage() {
    return `🤖 **Work Hours Logger Bot**\n\n` +
           `**Log work by sending messages like:**\n` +
           `• "Worked 6 hours today"\n` +
           `• "5.5 hrs on freelance"\n` +
           `• "Yesterday I did 3 hours on project X"\n\n` +
           `**Commands:**\n` +
           `• /summary - Weekly and monthly totals\n` +
           `• /today - Today's logged hours\n` +
           `• /log - Last 5 entries\n` +
           `• /category <tag> - Hours for specific category\n` +
           `• /help - Show this message`;
  }
}

module.exports = Commands;