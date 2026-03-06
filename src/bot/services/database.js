/**
 * Database Module for Telegram Work Hours Logger Bot
 * 
 * This module handles all database operations using MongoDB via Mongoose.
 * It provides a robust connection management system optimized for serverless
 * environments where connections may be short-lived and need to be efficiently managed.
 * 
 * Features:
 * - Automatic connection management with reconnection handling
 * - Optimized connection settings for serverless deployment
 * - Work entry CRUD operations
 * - Aggregation queries for summaries and analytics
 * - Error handling and logging
 * 
 * @author Work Hours Bot
 * @version 1.0.0
 */

const mongoose = require('mongoose');

/**
 * MongoDB schema for work entries
 * 
 * Each work entry represents a logged work session with the following structure:
 * - date: YYYY-MM-DD format for the work date
 * - hours: Decimal number representing hours worked (e.g., 5.5)
 * - tag: Optional category/project identifier extracted from user message
 * - raw_message: Original user message for reference
 * - timestamp: When the entry was logged (auto-generated)
 */
const workEntrySchema = new mongoose.Schema({
  date: { 
    type: String, 
    required: true,
    match: /^\d{4}-\d{2}-\d{2}$/ // Validates YYYY-MM-DD format
  },
  hours: { 
    type: Number, 
    required: true,
    min: 0.1, // Minimum 0.1 hours (6 minutes)
    max: 24   // Maximum 24 hours per day
  },
  tag: { 
    type: String,
    trim: true,
    lowercase: true
  },
  raw_message: { 
    type: String, 
    required: true,
    maxlength: 500 // Reasonable limit for Telegram messages
  },
  timestamp: { 
    type: Date, 
    default: Date.now 
  }
});

// Create indexes for better query performance
workEntrySchema.index({ date: 1 });
workEntrySchema.index({ tag: 1 });
workEntrySchema.index({ timestamp: -1 });

const WorkEntry = mongoose.model('WorkEntry', workEntrySchema);

/**
 * Database class for managing MongoDB operations
 * 
 * This class provides a singleton-like pattern for database connections
 * and includes methods for all work entry operations. It's optimized for
 * serverless environments where connection management is critical.
 */
class Database {
  constructor() {
    // MongoDB connection URI with fallback to local development
    this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workhoursbot';
    this.connectionPromise = null;
    this.isConnected = false;
  }

  /**
   * Establishes connection to MongoDB with serverless optimization
   * 
   * This method implements connection pooling and race condition prevention
   * to ensure efficient database connections in serverless environments.
   * 
   * @returns {Promise<void>}
   * @throws {Error} If connection fails after retries
   */
  async connectToMongoDB() {
    try {
      // Return immediately if already connected
      if (this.isConnected && mongoose.connection.readyState === 1) {
        return;
      }

      // Wait for existing connection attempt to prevent race conditions
      if (this.connectionPromise) {
        await this.connectionPromise;
        return;
      }

      // Start new connection process
      this.connectionPromise = this._performConnection();
      await this.connectionPromise;
      this.isConnected = true;
      this.connectionPromise = null;
    } catch (err) {
      this.connectionPromise = null;
      this.isConnected = false;
      console.error('MongoDB connection error:', err.message);
      throw err;
    }
  }

  /**
   * Internal method to perform the actual MongoDB connection
   * 
   * Configures connection options optimized for serverless environments
   * with appropriate timeouts and pool sizes.
   * 
   * @private
   * @returns {Promise<void>}
   */
  async _performConnection() {
    // Connection options optimized for serverless environments
    const options = {
      serverSelectionTimeoutMS: 5000,  // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
      bufferCommands: false,           // Disable mongoose buffering for immediate operations
      maxPoolSize: 1,                  // Maintain up to 1 socket connection
      minPoolSize: 0,                  // Maintain minimum 0 socket connections
      maxIdleTimeMS: 30000,           // Close connections after 30s of inactivity
      connectTimeoutMS: 10000,        // Give up initial connection after 10s
    };

    await mongoose.connect(this.uri, options);
    
    // Set up connection event listeners to track state
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      this.isConnected = false;
    });
    
    console.log('Connected to MongoDB');
  }

  /**
   * Logs a new work entry to the database
   * 
   * @param {string} date - Work date in YYYY-MM-DD format
   * @param {number} hours - Hours worked (decimal number)
   * @param {string} tag - Optional project/category tag
   * @param {string} rawMessage - Original user message
   * @returns {Promise<Object>} Created entry with id, date, hours, and tag
   * @throws {Error} If database operation fails
   */
  async logWorkEntry(date, hours, tag, rawMessage) {
    try {
      // Ensure connection before operation
      await this.connectToMongoDB();
      
      const entry = new WorkEntry({ 
        date, 
        hours, 
        tag, 
        raw_message: rawMessage 
      });
      
      await entry.save();
      
      return {
        id: entry._id,
        date: entry.date,
        hours: entry.hours,
        tag: entry.tag,
      };
    } catch (error) {
      console.error('Error saving work entry:', error);
      throw error;
    }
  }

  /**
   * Retrieves all work entries for a specific date
   * 
   * @param {string} date - Date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of work entries sorted by timestamp (newest first)
   * @throws {Error} If database query fails
   */
  async getTodayEntries(date) {
    try {
      await this.connectToMongoDB();
      return await WorkEntry.find({ date })
        .sort({ timestamp: -1 })
        .lean(); // Use lean() for better performance when we don't need Mongoose documents
    } catch (error) {
      console.error('Error getting today entries:', error);
      throw error;
    }
  }

  /**
   * Retrieves the most recent work entries across all dates
   * 
   * @param {number} limit - Maximum number of entries to return (default: 5)
   * @returns {Promise<Array>} Array of recent work entries
   * @throws {Error} If database query fails
   */
  async getLastEntries(limit = 5) {
    try {
      await this.connectToMongoDB();
      return await WorkEntry.find()
        .sort({ timestamp: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      console.error('Error getting last entries:', error);
      throw error;
    }
  }

  /**
   * Deletes the most recent work entries
   *
   * Finds the latest N entries by timestamp and deletes them.
   * Returns a summary including the deleted entry details.
   *
   * @param {number} limit - Number of recent entries to delete (default: 5)
   * @returns {Promise<Object>} { deleted, entries: [{id,date,hours,tag,timestamp}] }
   */
  async deleteLastEntries(limit = 5) {
    try {
      await this.connectToMongoDB();

      const n = Math.max(1, Math.min(Number(limit) || 5, 10));
      const entries = await WorkEntry.find()
        .sort({ timestamp: -1 })
        .limit(n)
        .lean();

      if (entries.length === 0) {
        return { deleted: 0, entries: [] };
      }

      const ids = entries.map(e => e._id);
      const deleteResult = await WorkEntry.deleteMany({ _id: { $in: ids } });

      return {
        deleted: deleteResult.deletedCount || 0,
        entries: entries.map(e => ({
          id: e._id,
          date: e.date,
          hours: e.hours,
          tag: e.tag || null,
          timestamp: e.timestamp
        }))
      };
    } catch (error) {
      console.error('Error deleting last entries:', error);
      throw error;
    }
  }

  /**
   * Deletes specific entries by their MongoDB ObjectIDs
   *
   * This is used by the selective delete flow where the user picks
   * specific items from the preview list (positions 1..10 mapped to IDs).
   *
   * @param {Array<string>} ids - Array of entry IDs to delete
   * @returns {Promise<Object>} { deleted, entries: [{id,date,hours,tag,timestamp}] }
   */
  async deleteEntriesByIds(ids) {
    try {
      await this.connectToMongoDB();

      if (!Array.isArray(ids) || ids.length === 0) {
        return { deleted: 0, entries: [] };
      }

      // Fetch entries first for reporting
      const entries = await mongoose.model('WorkEntry').find({ _id: { $in: ids } }).lean();
      if (entries.length === 0) {
        return { deleted: 0, entries: [] };
      }

      const deleteResult = await mongoose.model('WorkEntry').deleteMany({ _id: { $in: ids } });

      return {
        deleted: deleteResult.deletedCount || 0,
        entries: entries.map(e => ({
          id: e._id,
          date: e.date,
          hours: e.hours,
          tag: e.tag || null,
          timestamp: e.timestamp
        }))
      };
    } catch (error) {
      console.error('Error deleting entries by ids:', error);
      throw error;
    }
  }

  /**
   * Calculates total hours worked between two dates (inclusive)
   * 
   * Uses MongoDB aggregation pipeline for efficient calculation
   * of total hours and entry count within the specified date range.
   * 
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Object>} Object with totalHours and entries count
   * @throws {Error} If aggregation query fails
   */
  async getWeeklyTotal(startDate, endDate) {
    try {
      await this.connectToMongoDB();
      const result = await WorkEntry.aggregate([
        { 
          $match: { 
            date: { $gte: startDate, $lte: endDate } 
          } 
        },
        { 
          $group: {
            _id: null,
            total_hours: { $sum: '$hours' },
            entries: { $sum: 1 }
          }
        }
      ]);
      
      return {
        totalHours: result[0]?.total_hours || 0,
        entries: result[0]?.entries || 0
      };
    } catch (error) {
      console.error('Error getting weekly total:', error);
      throw error;
    }
  }

  /**
   * Calculates total hours for a specific category/tag
   * 
   * Uses case-insensitive regex matching to find all entries
   * containing the specified tag.
   * 
   * @param {string} tag - Category/tag to search for
   * @returns {Promise<Object>} Object with totalHours and entries count
   * @throws {Error} If aggregation query fails
   */
  async getCategoryTotal(tag) {
    try {
      await this.connectToMongoDB();
      // Escape special regex characters to prevent ReDoS or unintended pattern matching
      const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const result = await WorkEntry.aggregate([
        { 
          $match: { 
            tag: { $regex: escapedTag, $options: 'i' } 
          } 
        },
        { 
          $group: {
            _id: null,
            total_hours: { $sum: '$hours' },
            entries: { $sum: 1 }
          }
        }
      ]);
      
      return {
        totalHours: result[0]?.total_hours || 0,
        entries: result[0]?.entries || 0
      };
    } catch (error) {
      console.error('Error getting category total:', error);
      throw error;
    }
  }

  /**
   * Retrieves all work entries between two dates (inclusive)
   * 
   * @param {string} startDate - Start date in YYYY-MM-DD format
   * @param {string} endDate - End date in YYYY-MM-DD format
   * @returns {Promise<Array>} Array of work entries sorted by date
   * @throws {Error} If database query fails
   */
  async getEntriesBetween(startDate, endDate) {
    try {
      await this.connectToMongoDB();
      return await WorkEntry.find({ 
        date: { $gte: startDate, $lte: endDate } 
      })
      .sort({ date: 1 })
      .lean();
    } catch (error) {
      console.error('Error getting entries between dates:', error);
      throw error;
    }
  }

  /**
   * Gracefully closes the database connection
   * 
   * This method should be called when shutting down the application
   * to ensure all connections are properly closed.
   */
  close() {
    try {
      this.isConnected = false;
      this.connectionPromise = null;
      mongoose.connection.close(() => {
        console.log('MongoDB connection closed');
      });
    } catch (error) {
      console.error('Error closing connection:', error);
    }
  }

  /**
   * Creates a backup of all work entries before reset
   * 
   * @returns {Promise<Array>} Array of all work entries for backup
   * @throws {Error} If backup creation fails
   */
  async createBackup() {
    try {
      await this.connectToMongoDB();
      const allEntries = await WorkEntry.find().sort({ timestamp: 1 }).lean();
      
      console.log(`Created backup of ${allEntries.length} work entries`);
      return allEntries;
    } catch (error) {
      console.error('Error creating backup:', error);
      throw new Error('Failed to create backup before reset');
    }
  }

  /**
   * Gets database statistics for confirmation before reset
   * 
   * @returns {Promise<Object>} Database statistics
   */
  async getDatabaseStats() {
    try {
      await this.connectToMongoDB();
      
      const totalEntries = await WorkEntry.countDocuments();
      const totalHours = await WorkEntry.aggregate([
        { $group: { _id: null, total: { $sum: '$hours' } } }
      ]);
      
      const dateRange = await WorkEntry.aggregate([
        {
          $group: {
            _id: null,
            earliest: { $min: '$date' },
            latest: { $max: '$date' }
          }
        }
      ]);

      const uniqueTags = await WorkEntry.distinct('tag', { tag: { $ne: null } });

      return {
        totalEntries,
        totalHours: totalHours[0]?.total || 0,
        dateRange: dateRange[0] || { earliest: null, latest: null },
        uniqueTags: uniqueTags.length,
        tags: uniqueTags
      };
    } catch (error) {
      console.error('Error getting database stats:', error);
      throw error;
    }
  }

  /**
   * Resets the database by removing all work entries
   * 
   * This is a destructive operation that should be used with caution.
   * It creates a backup before deletion and provides comprehensive logging.
   * 
   * @param {boolean} createBackupFirst - Whether to create backup before reset
   * @returns {Promise<Object>} Reset operation results
   * @throws {Error} If reset operation fails
   */
  async resetDatabase(createBackupFirst = true) {
    try {
      await this.connectToMongoDB();
      
      // Get stats before reset
      const statsBeforeReset = await this.getDatabaseStats();
      
      let backupData = null;
      if (createBackupFirst && statsBeforeReset.totalEntries > 0) {
        backupData = await this.createBackup();
      }

      // Perform the reset
      const deleteResult = await WorkEntry.deleteMany({});
      
      console.log(`Database reset completed. Deleted ${deleteResult.deletedCount} entries.`);
      
      return {
        success: true,
        deletedEntries: deleteResult.deletedCount,
        statsBeforeReset,
        backupCreated: backupData ? backupData.length : 0,
        resetTimestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error resetting database:', error);
      throw new Error(`Database reset failed: ${error.message}`);
    }
  }

  /**
   * Restores database from backup data
   * 
   * @param {Array} backupData - Array of work entry objects to restore
   * @returns {Promise<Object>} Restore operation results
   * @throws {Error} If restore operation fails
   */
  async restoreFromBackup(backupData) {
    try {
      await this.connectToMongoDB();
      
      if (!Array.isArray(backupData) || backupData.length === 0) {
        throw new Error('Invalid backup data provided');
      }

      // Remove _id fields to avoid conflicts
      const cleanBackupData = backupData.map(entry => {
        const { _id, ...cleanEntry } = entry;
        return cleanEntry;
      });

      const insertResult = await WorkEntry.insertMany(cleanBackupData);
      
      console.log(`Restored ${insertResult.length} entries from backup`);
      
      return {
        success: true,
        restoredEntries: insertResult.length,
        restoreTimestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error restoring from backup:', error);
      throw new Error(`Database restore failed: ${error.message}`);
    }
  }

  /**
   * Validates database integrity and fixes common issues
   * 
   * @returns {Promise<Object>} Validation and repair results
   */
  async validateAndRepairDatabase() {
    try {
      await this.connectToMongoDB();
      
      const issues = [];
      const fixes = [];

      // Check for invalid dates
      const invalidDates = await WorkEntry.find({
        date: { $not: /^\d{4}-\d{2}-\d{2}$/ }
      });
      
      if (invalidDates.length > 0) {
        issues.push(`Found ${invalidDates.length} entries with invalid date format`);
      }

      // Check for invalid hours
      const invalidHours = await WorkEntry.find({
        $or: [
          { hours: { $lt: 0.1 } },
          { hours: { $gt: 24 } },
          { hours: { $type: 'string' } }
        ]
      });
      
      if (invalidHours.length > 0) {
        issues.push(`Found ${invalidHours.length} entries with invalid hours`);
      }

      // Check for missing required fields
      const missingFields = await WorkEntry.find({
        $or: [
          { date: { $exists: false } },
          { hours: { $exists: false } },
          { raw_message: { $exists: false } }
        ]
      });
      
      if (missingFields.length > 0) {
        issues.push(`Found ${missingFields.length} entries with missing required fields`);
      }

      return {
        success: true,
        issuesFound: issues.length,
        issues,
        fixesApplied: fixes.length,
        fixes,
        validationTimestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error('Error validating database:', error);
      throw error;
    }
  }
}

module.exports = Database;
