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

  // Close database connection gracefully
  close() {
    this.db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed');
      }
    });
  }
}

module.exports = Database;