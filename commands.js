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
      // This week (Monday to Sunday)
      const startOfWeek = moment().startOf('week').format('YYYY-MM-DD');
      const endOfWeek = moment().endOf('week').format('YYYY-MM-DD');
      
      // Calculate date ranges for this month
      // This month
      const startOfMonth = moment().startOf('month').format('YYYY-MM-DD');
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD');

      // Get totals for both time periods in parallel
      const [weeklyData, monthlyData] = await Promise.all([
        this.db.getWeeklyTotal(startOfWeek, endOfWeek),
        this.db.getWeeklyTotal(startOfMonth, endOfMonth)
      ]);

      // Format hours for display
      const weekHours = this.parser.formatHours(weeklyData.totalHours);
      const monthHours = this.parser.formatHours(monthlyData.totalHours);

      // Build formatted response message
      return `📊 **Work Summary**\n\n` +
             `📅 **This Week:** ${weekHours} hours (${weeklyData.entries} entries)\n` +
             `📅 **This Month:** ${monthHours} hours (${monthlyData.entries} entries)`;
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

      // Handle case where no work was logged today
      if (entries.length === 0) {
        return '📅 No work logged for today yet.';
      }

      // Calculate total hours for today
      const totalHours = entries.reduce((sum, entry) => sum + entry.hours, 0);
      const formattedTotal = this.parser.formatHours(totalHours);

      // Build response with individual entries
      let response = `📅 **Today's Work Log** (${formattedTotal} hours total)\n\n`;
      
      // List each entry with hours, tag, and time logged
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