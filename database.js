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
    const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/workhoursbot';
    mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    }).then(() => {
      console.log('Connected to MongoDB');
    }).catch((err) => {
      console.error('MongoDB connection error:', err.message);
    });
  }

  // Insert a new work entry into the database
  async logWorkEntry(date, hours, tag, rawMessage) {
    const entry = new WorkEntry({ date, hours, tag, raw_message: rawMessage });
    await entry.save();
    return {
      id: entry._id,
      date: entry.date,
      hours: entry.hours,
      tag: entry.tag,
    };
  }

  // Get all work entries for a specific date
  async getTodayEntries(date) {
    return await WorkEntry.find({ date }).sort({ timestamp: -1 }).lean();
  }

  // Get the most recent work entries (for /log command)
  async getLastEntries(limit = 5) {
    return await WorkEntry.find().sort({ timestamp: -1 }).limit(limit).lean();
  }

  // Calculate total hours worked between two dates (for weekly/monthly summaries)
  async getWeeklyTotal(startDate, endDate) {
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
  }

  // Get total hours for a specific category/tag
  async getCategoryTotal(tag) {
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
  }

  // Get all work entries between two dates (inclusive)
  async getEntriesBetween(startDate, endDate) {
    return await WorkEntry.find({ date: { $gte: startDate, $lte: endDate } }).sort({ date: 1 }).lean();
  }

  // Close database connection gracefully
  close() {
    mongoose.connection.close(() => {
      console.log('MongoDB connection closed');
    });
  }
}

module.exports = Database;