const moment = require('moment');

// Class for parsing natural language work log messages
class MessageParser {
  constructor() {
    // Regular expression to match hours in various formats (6h, 5.5 hours, 3 hrs)
    this.hoursRegex = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i;
    // Detect "yesterday" in messages
    this.yesterdayRegex = /yesterday/i;
    // Match date formats like 12/25 or 12/25/2023
    this.dateRegex = /(\d{1,2}\/\d{1,2}(?:\/\d{4})?)/;
    
    // Keywords that might indicate project tags or categories
    this.tagKeywords = [
      'on', 'for', 'project', 'client', 'freelance', 'work', 'task',
      'meeting', 'coding', 'development', 'design', 'research'
    ];
  }

  // Main parsing function - extracts hours, date, and tags from message
  parseMessage(message) {
    // Initialize result object with defaults
    const result = {
      hours: null,
      date: moment().format('YYYY-MM-DD'), // Default to today
      tag: null,
      isValidWorkLog: false
    };

    // Try to extract hours from the message
    const hoursMatch = message.match(this.hoursRegex);
    if (hoursMatch) {
      result.hours = parseFloat(hoursMatch[1]);
      result.isValidWorkLog = true;
    } else {
      // No hours found, not a valid work log
      return result;
    }

    // Parse date information
    if (this.yesterdayRegex.test(message)) {
      // Handle "yesterday" keyword
      result.date = moment().subtract(1, 'day').format('YYYY-MM-DD');
    } else {
      // Look for specific date formats
      const dateMatch = message.match(this.dateRegex);
      if (dateMatch) {
        const parsedDate = moment(dateMatch[1], ['M/D/YYYY', 'M/D']);
        if (parsedDate.isValid()) {
          // If no year provided, assume current year
          if (!dateMatch[1].includes('/')) {
            parsedDate.year(moment().year());
          }
          result.date = parsedDate.format('YYYY-MM-DD');
        }
      }
    }

    // Extract project/category tags from message
    result.tag = this.extractTag(message);

    return result;
  }

  // Extract meaningful tags/categories from work log messages
  extractTag(message) {
    // Remove hours part to focus on context
    const cleanMessage = message.replace(this.hoursRegex, '').trim();
    
    // Common patterns for project/client references
    const patterns = [
      /(?:on|for|working on|project)\s+([a-zA-Z0-9\s\-_]+?)(?:\s|$|\.)/i,
      /([a-zA-Z0-9\-_]+)\s*(?:work|project|task|client)/i,
      /(freelance|meeting|coding|development|design|research)/i
    ];

    // Try each pattern to find a tag
    for (const pattern of patterns) {
      const match = cleanMessage.match(pattern);
      if (match && match[1]) {
        return match[1].trim().toLowerCase();
      }
    }

    // Fallback: look for any meaningful words as potential tags
    const words = cleanMessage.toLowerCase().split(/\s+/);
    const meaningfulWords = words.filter(word => 
      word.length > 2 && 
      !['the', 'and', 'for', 'was', 'did', 'today', 'yesterday', 'hours', 'hrs'].includes(word)
    );

    // Return first meaningful word if found
    if (meaningfulWords.length > 0) {
      return meaningfulWords[0];
    }

    return null;
  }

  // Format hours for display (remove unnecessary decimals)
  formatHours(hours) {
    return hours % 1 === 0 ? hours.toString() : hours.toFixed(1);
  }
}

module.exports = MessageParser;