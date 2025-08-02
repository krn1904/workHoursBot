const mongoose = require('mongoose');

// Define the schema for work entries
const workEntrySchema = new mongoose.Schema({
  date: { type: String, required: true }, // YYYY-MM-DD
  hours: { type: Number, required: true },
  tag: { type: String },
  raw_message: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

const WorkEntry = mongoose.model('WorkEntry', workEntrySchema);

class Database {
  constructor() {
    this.uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workhoursbot';
    this.connectionPromise = null;
    this.isConnected = false;
  }

  async connectToMongoDB() {
    try {
      // If already connected, return immediately
      if (this.isConnected && mongoose.connection.readyState === 1) {
        return;
      }

      // If connection is in progress, wait for it
      if (this.connectionPromise) {
        await this.connectionPromise;
        return;
      }

      // Start new connection
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

  async _performConnection() {
    // Configure connection options for serverless
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      bufferCommands: false, // Disable mongoose buffering
      maxPoolSize: 1, // Maintain up to 1 socket connection
      minPoolSize: 0, // Maintain minimum 0 socket connections
      maxIdleTimeMS: 30000, // Close connections after 30s of inactivity
      connectTimeoutMS: 10000, // Give up initial connection after 10s
    };

    await mongoose.connect(this.uri, options);
    
    // Set up connection event listeners
    mongoose.connection.on('disconnected', () => {
      this.isConnected = false;
    });
    
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      this.isConnected = false;
    });
  }

  // Insert a new work entry into the database
  async logWorkEntry(date, hours, tag, rawMessage) {
    try {
      // Ensure connection before operation
      await this.connectToMongoDB();
      
      const entry = new WorkEntry({ date, hours, tag, raw_message: rawMessage });
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

  // Get all work entries for a specific date
  async getTodayEntries(date) {
    try {
      await this.connectToMongoDB();
      return await WorkEntry.find({ date }).sort({ timestamp: -1 }).lean();
    } catch (error) {
      console.error('Error getting today entries:', error);
      throw error;
    }
  }

  // Get the most recent work entries (for /log command)
  async getLastEntries(limit = 5) {
    try {
      await this.connectToMongoDB();
      return await WorkEntry.find().sort({ timestamp: -1 }).limit(limit).lean();
    } catch (error) {
      console.error('Error getting last entries:', error);
      throw error;
    }
  }

  // Calculate total hours worked between two dates (for weekly/monthly summaries)
  async getWeeklyTotal(startDate, endDate) {
    try {
      await this.connectToMongoDB();
      const result = await WorkEntry.aggregate([
        { $match: { date: { $gte: startDate, $lte: endDate } } },
        { $group: {
          _id: null,
          total_hours: { $sum: '$hours' },
          entries: { $sum: 1 }
        }}
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

  // Get total hours for a specific category/tag
  async getCategoryTotal(tag) {
    try {
      await this.connectToMongoDB();
      const result = await WorkEntry.aggregate([
        { $match: { tag: { $regex: tag, $options: 'i' } } },
        { $group: {
          _id: null,
          total_hours: { $sum: '$hours' },
          entries: { $sum: 1 }
        }}
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

  // Get all work entries between two dates (inclusive)
  async getEntriesBetween(startDate, endDate) {
    try {
      await this.connectToMongoDB();
      return await WorkEntry.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 }).lean();
    } catch (error) {
      console.error('Error getting entries between dates:', error);
      throw error;
    }
  }

  // Close database connection gracefully
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
}

module.exports = Database;