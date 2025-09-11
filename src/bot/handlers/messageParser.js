/**
 * Message Parser Module for Telegram Work Hours Logger Bot
 * 
 * This module handles natural language processing for work log messages.
 * It extracts structured data (hours, dates, tags) from user messages written
 * in natural language, making the bot user-friendly and conversational.
 * 
 * Features:
 * - Flexible hour format recognition (6h, 5.5 hours, 3 hrs)
 * - Date parsing (today, yesterday, specific dates)
 * - Automatic tag/category extraction from context
 * - Support for multiple date formats (MM/DD, DD/MM, YYYY-MM-DD)
 * - Smart text analysis for project/client identification
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const moment = require('moment');

/**
 * Class for parsing natural language work log messages
 * 
 * This parser uses regular expressions and keyword analysis to extract
 * meaningful information from user messages about their work hours.
 * It's designed to be flexible and forgiving of different writing styles.
 */
class MessageParser {
  constructor() {
    /**
     * Regular expression to match hours in various formats
     * Matches: 6h, 5.5 hours, 3 hrs, 8.25h, etc.
     * Captures the numeric value (including decimals)
     */
    this.hoursRegex = /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?|h\b)/i;
    
    /**
     * Detects "yesterday" keyword in messages (case-insensitive)
     */
    this.yesterdayRegex = /yesterday/i;
    
    /**
     * Matches various date formats:
     * - MM/DD or DD/MM (12/25, 25/12)
     * - MM/DD/YYYY or DD/MM/YYYY (12/25/2023, 25/12/2023)
     * - ISO format (2023-12-25)
     * - MM-DD or DD-MM with dashes
     */
    this.dateRegex = /(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?|\d{4}-\d{2}-\d{2})/;
    
    /**
     * Keywords that commonly indicate project tags or work categories
     * These help identify context for automatic tag extraction
     */
    this.tagKeywords = [
      'on', 'for', 'project', 'client', 'freelance', 'work', 'task',
      'meeting', 'coding', 'development', 'design', 'research', 'admin',
      'documentation', 'testing', 'debugging', 'planning', 'review'
    ];

    /**
     * Common words to filter out when extracting meaningful tags
     * These are too generic to be useful as project identifiers
     */
    this.stopWords = [
      'the', 'and', 'for', 'was', 'did', 'today', 'yesterday', 'hours', 
      'hrs', 'worked', 'working', 'doing', 'some', 'more', 'time'
    ];

    /**
     * Date format preference
     * DMY = prefer DD/MM and DD-MM (Australian/most of world)
     * MDY = prefer MM/DD and MM-DD (US)
     */
    this.dateFormatPreference = (process.env.DATE_FORMAT_PREFERENCE || 'DMY').toUpperCase();
  }

  /**
   * Main parsing function - extracts hours, date, and tags from message
   * 
   * This is the primary entry point for message parsing. It attempts to
   * extract all relevant information from a natural language message.
   * 
   * @param {string} message - The user's message to parse
   * @returns {Object} Parsed result with hours, date, tag, and validity flag
   */
  parseMessage(message) {
    // Initialize result object with defaults
    const result = {
      hours: null,
      date: moment().format('YYYY-MM-DD'), // Default to today
      tag: null,
      isValidWorkLog: false
    };

    // Input validation
    if (!message || typeof message !== 'string') {
      return result;
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return result;
    }

    // Try to extract hours from the message
    const hoursMatch = trimmedMessage.match(this.hoursRegex);
    if (hoursMatch) {
      const extractedHours = parseFloat(hoursMatch[1]);
      
      // Validate reasonable hour ranges (0.1 to 24 hours)
      if (extractedHours >= 0.1 && extractedHours <= 24) {
        result.hours = extractedHours;
        result.isValidWorkLog = true;
      } else {
        // Hours are outside reasonable range
        return result;
      }
    } else {
      // No valid hours found, not a work log
      return result;
    }

    // Parse date information
    let messageWithoutDate = trimmedMessage;
    
    if (this.yesterdayRegex.test(trimmedMessage)) {
      // Handle "yesterday" keyword
      result.date = moment().subtract(1, 'day').format('YYYY-MM-DD');
      messageWithoutDate = trimmedMessage.replace(this.yesterdayRegex, '').trim();
    } else {
      // Look for specific date formats
      const dateMatch = trimmedMessage.match(this.dateRegex);
      if (dateMatch) {
        const parsedDate = this._parseSpecificDate(dateMatch[1]);
        if (parsedDate) {
          result.date = parsedDate;
          // Remove the date string from the message for tag extraction
          messageWithoutDate = trimmedMessage.replace(dateMatch[1], '').trim();
        }
      }
    }

    // Extract project/category tags from message (after removing date)
    result.tag = this.extractTag(messageWithoutDate);

    return result;
  }

  /**
   * Parses specific date formats and returns standardized YYYY-MM-DD string
   * 
   * @private
   * @param {string} dateStr - Date string to parse
   * @returns {string|null} Formatted date string or null if invalid
   */
  _parseSpecificDate(dateStr) {
    let parsedDate = null;
    
    try {
      // Try YYYY-MM-DD format first (ISO standard)
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        parsedDate = moment(dateStr, 'YYYY-MM-DD', true);
      } 
      // Try formats with year (MM/DD/YYYY, DD/MM/YYYY, etc.)
      else if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
        // Prefer formats based on configured preference and detected separator
        const sep = dateStr.includes('-') ? '-' : '/';
        const dmy = sep === '-' ? 'DD-MM-YYYY' : 'DD/MM/YYYY';
        const mdy = sep === '-' ? 'MM-DD-YYYY' : 'MM/DD/YYYY';
        const orderedFormats = this.dateFormatPreference === 'MDY' ? [mdy, dmy] : [dmy, mdy];
        for (const format of orderedFormats) {
          parsedDate = moment(dateStr, format, true);
          if (parsedDate.isValid()) break;
        }
      } 
      // Try formats without year (MM/DD, DD/MM - assume current year)
      else if (/^\d{1,2}[\/\-]\d{1,2}$/.test(dateStr)) {
        const currentYear = moment().year();
        const sep = dateStr.includes('-') ? '-' : '/';
        const dateWithYear = `${dateStr}${sep}${currentYear}`;
        const dmy = sep === '-' ? 'DD-MM-YYYY' : 'DD/MM/YYYY';
        const mdy = sep === '-' ? 'MM-DD-YYYY' : 'MM/DD/YYYY';
        const orderedFormats = this.dateFormatPreference === 'MDY' ? [mdy, dmy] : [dmy, mdy];
        for (const format of orderedFormats) {
          parsedDate = moment(dateWithYear, format, true);
          if (parsedDate.isValid()) break;
        }
      }

      // Validate the parsed date is reasonable (not too far in future/past)
      if (parsedDate && parsedDate.isValid()) {
        const now = moment();
        const daysDiff = Math.abs(parsedDate.diff(now, 'days'));
        
        // Allow dates within 1 year in the past or 1 week in the future
        if (daysDiff <= 365 && parsedDate.isSameOrBefore(now.add(7, 'days'))) {
          return parsedDate.format('YYYY-MM-DD');
        }
      }
    } catch (error) {
      console.warn('Date parsing error:', error.message);
    }
    
    return null;
  }

  /**
   * Extracts meaningful tags/categories from work log messages
   * 
   * This method uses multiple strategies to identify project names,
   * client names, or work categories from the natural language text.
   * 
   * @param {string} message - Message text to analyze for tags
   * @returns {string|null} Extracted tag or null if none found
   */
  extractTag(message) {
    if (!message || typeof message !== 'string') {
      return null;
    }

    // Remove hours part to focus on context
    const cleanMessage = message.replace(this.hoursRegex, '').trim();
    
    if (cleanMessage.length === 0) {
      return null;
    }

    // Strategy 1: Common patterns for project/client references
    const patterns = [
      // "on project X", "for client Y", "working on Z"
      /(?:on|for|working\s+on|project)\s+([a-zA-Z0-9\s\-_]+?)(?:\s|$|\.|\,)/i,
      // "X project", "Y work", "Z task", "A client"
      /([a-zA-Z0-9\-_]+)\s*(?:work|project|task|client)/i,
      // Single word categories
      /(freelance|meeting|coding|development|design|research|admin|documentation|testing|debugging|planning|review)/i
    ];

    // Try each pattern to find a tag
    for (const pattern of patterns) {
      const match = cleanMessage.match(pattern);
      if (match && match[1]) {
        const tag = match[1].trim().toLowerCase();
        // Ensure tag is meaningful (more than 1 character, not a stop word)
        if (tag.length > 1 && !this.stopWords.includes(tag)) {
          return tag;
        }
      }
    }

    // Strategy 2: Fallback to meaningful words
    const words = cleanMessage.toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Remove punctuation
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.includes(word));

    // Return the first meaningful word if found
    if (words.length > 0) {
      return words[0];
    }

    return null;
  }

  /**
   * Formats hours for display, removing unnecessary decimal places
   * 
   * @param {number} hours - Number of hours to format
   * @returns {string} Formatted hours string
   */
  formatHours(hours) {
    if (typeof hours !== 'number' || isNaN(hours)) {
      return '0';
    }

    // If it's a whole number, display without decimals
    if (hours % 1 === 0) {
      return hours.toString();
    }
    
    // Otherwise, show one decimal place
    return hours.toFixed(1);
  }

  /**
   * Validates if a message appears to be a work log entry
   * 
   * This is a helper method for quick validation without full parsing
   * 
   * @param {string} message - Message to validate
   * @returns {boolean} True if message contains hour information
   */
  isWorkLogMessage(message) {
    if (!message || typeof message !== 'string') {
      return false;
    }
    
    return this.hoursRegex.test(message.trim());
  }

  /**
   * Extracts just the hours from a message without full parsing
   * 
   * @param {string} message - Message to extract hours from
   * @returns {number|null} Extracted hours or null if none found
   */
  extractHours(message) {
    if (!message || typeof message !== 'string') {
      return null;
    }

    const match = message.trim().match(this.hoursRegex);
    if (match) {
      const hours = parseFloat(match[1]);
      return (hours >= 0.1 && hours <= 24) ? hours : null;
    }
    
    return null;
  }
}

module.exports = MessageParser;