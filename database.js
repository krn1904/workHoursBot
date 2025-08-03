const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database class for managing SQLite operations
class Database {
  constructor() {
    // Use environment variable or default path for database file
    const dbPath = process.env.DATABASE_PATH || './work_hours.db';
    // Initialize SQLite database connection
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err.message);
      } else {
        console.log('Connected to SQLite database');
        this.initializeDatabase();
      }
    });
  }

  // Create the work_entries table if it doesn't exist
  initializeDatabase() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS work_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        hours REAL NOT NULL,
        tag TEXT,
        raw_message TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Execute table creation SQL
    this.db.run(createTableSQL, (err) => {
      if (err) {
        console.error('Error creating table:', err.message);
      } else {
        console.log('Database initialized successfully');
      }
    });
  }

  // Insert a new work entry into the database
  async logWorkEntry(date, hours, tag, rawMessage) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO work_entries (date, hours, tag, raw_message)
        VALUES (?, ?, ?, ?)
      `;
      
      // Use parameterized query to prevent SQL injection
      this.db.run(sql, [date, hours, tag, rawMessage], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, date, hours, tag });
        }
      });
    });
  }

  // Get all work entries for a specific date
  async getTodayEntries(date) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM work_entries 
        WHERE date = ? 
        ORDER BY timestamp DESC
      `;
      
      // Return all entries for the specified date
      this.db.all(sql, [date], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Get the most recent work entries (for /log command)
  async getLastEntries(limit = 5) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM work_entries 
        ORDER BY timestamp DESC 
        LIMIT ?
      `;
      
      // Return limited number of recent entries
      this.db.all(sql, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // Calculate total hours worked between two dates (for weekly/monthly summaries)
  async getWeeklyTotal(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT SUM(hours) as total_hours, COUNT(*) as entries
        FROM work_entries 
        WHERE date BETWEEN ? AND ?
      `;
      
      // Return aggregated data for date range
      this.db.get(sql, [startDate, endDate], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            totalHours: row.total_hours || 0,
            entries: row.entries || 0
          });
        }
      });
    });
  }

  // Get total hours for a specific category/tag
  async getCategoryTotal(tag) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT SUM(hours) as total_hours, COUNT(*) as entries
        FROM work_entries 
        WHERE tag LIKE ?
      `;
      
      // Use LIKE for partial tag matching
      this.db.get(sql, [`%${tag}%`], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            totalHours: row.total_hours || 0,
            entries: row.entries || 0
          });
        }
      });
    });
  }

  // Get all work entries between two dates (inclusive)
  async getEntriesBetween(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM work_entries
        WHERE date BETWEEN ? AND ?
        ORDER BY date ASC
      `;
      this.db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
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