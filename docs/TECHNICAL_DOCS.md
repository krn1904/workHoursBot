# Technical Documentation - Telegram Work Hours Logger Bot

## 📋 Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Core Components](#core-components)
3. [Database Design](#database-design)
4. [API Reference](#api-reference)
5. [Message Processing Pipeline](#message-processing-pipeline)
6. [Deployment Architecture](#deployment-architecture)
7. [Security Implementation](#security-implementation)
8. [Performance Optimizations](#performance-optimizations)
9. [Error Handling](#error-handling)
10. [Testing Strategy](#testing-strategy)
11. [Monitoring and Logging](#monitoring-and-logging)

## 🏗️ Architecture Overview

### System Design

The Telegram Work Hours Logger Bot follows a serverless-first architecture optimized for cloud deployment platforms like Vercel, Railway, and Render. The system uses webhook-based communication with Telegram for real-time message processing.

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Telegram      │────│  Webhook        │────│   Application   │
│   Platform      │    │  Handler        │    │   Logic         │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   MongoDB       │
                       │   Database      │
                       └─────────────────┘
```

### Key Architectural Principles

1. **Serverless-First**: Designed for stateless function execution
2. **Event-Driven**: Responds to webhook events from Telegram
3. **Single Responsibility**: Each module has a clear, focused purpose
4. **Cloud-Native**: Optimized for modern hosting platforms
5. **Security-First**: Authorization and validation at every layer

## 🧩 Core Components

### Project Structure

```
├── api/                      # Serverless API endpoints
│   ├── bot.js               # Webhook handler for Telegram
│   └── reminder.js          # Daily reminder API endpoint
├── src/                     # Core application source code
│   └── bot/
│       ├── bot.js           # Main bot setup and configuration
│       ├── handlers/        # Command and message processing
│       │   ├── commands.js  # Bot command handlers and responses
│       │   └── messageParser.js # Natural language parsing logic
│       └── services/        # Business logic services
│           ├── database.js  # MongoDB operations and connection management
│           └── reminder.js  # Daily reminder system and scheduling
├── config/                  # Configuration files
├── docs/                    # Documentation files
└── package.json            # Dependencies and scripts
```

### 1. Webhook Handler (`api/bot.js`)

**Purpose**: Entry point for all Telegram webhook requests in serverless environment.

**Key Features**:
- Singleton bot instance management
- Direct webhook response (no outbound HTTP calls)
- Environment validation
- Request routing

**Import Dependencies**:
```javascript
const TelegramBot = require('node-telegram-bot-api');
const setupWorkLoggerBot = require('../src/bot/bot');
```

### 2. Bot Setup Module (`src/bot/bot.js`)

**Purpose**: Core bot configuration and initialization.

**Responsibilities**:
- Database connection establishment
- Component initialization
- Reminder scheduling (development mode)

**Import Dependencies**:
```javascript
const Database = require('./services/database');
const MessageParser = require('./handlers/messageParser');
const Commands = require('./handlers/commands');
const { createDailyReminder } = require('./services/reminder');
```

### 3. Database Module (`src/bot/services/database.js`)

**Purpose**: MongoDB connection management and data operations.

**Features**:
- Connection pooling for serverless
- Automatic reconnection handling
- Optimized query operations
- Schema validation

**Key Methods**:
```javascript
class Database {
  async connectToMongoDB()
  async logWorkEntry(date, hours, tag, rawMessage)
  async getTodayEntries(date)
  async getLastEntries(limit)
  async getWeeklyTotal(startDate, endDate)
  async getCategoryTotal(tag)
  async getEntriesBetween(startDate, endDate)
  async getDatabaseStats()
  async resetDatabase(createBackupFirst)
  async validateAndRepairDatabase()
}
```

### 4. Message Parser (`src/bot/handlers/messageParser.js`)

**Purpose**: Natural language processing for work log messages.

**Parsing Capabilities**:
- Hour extraction (multiple formats)
- Date recognition (relative and absolute)
- Tag/category extraction
- Input validation

**API**:
```javascript
class MessageParser {
  parseMessage(message)        // Main parsing function
  extractTag(message)          // Tag extraction
  formatHours(hours)          // Display formatting
  isWorkLogMessage(message)   // Quick validation
  extractHours(message)       // Hours-only extraction
}
```

### 5. Commands Module (`src/bot/handlers/commands.js`)

**Purpose**: Bot command processing and response generation.

**Supported Commands**:
- `/summary` - Weekly/monthly analytics
- `/today` - Current day summary
- `/log` - Recent entries
- `/category` - Tag-based filtering
- `/paycycle` - Bi-weekly summary with detailed entry list
- `/help` - Usage instructions
- `/stats` - Database statistics
- `/validate` - Database integrity check
- `/reset` - Database reset (with confirmation)
- `/backup` - Create data backup

**API**:
```javascript
class Commands {
  async handleSummary()
  async handleToday()
  async handleLog()
  async handleCategory(tag)
  async handlePayCycle()
  async handleStats()
  async handleValidate()
  async handleReset(confirmationArg)
  async handleBackup()
  getHelpMessage()
}
```

### 6. Reminder System (`src/bot/services/reminder.js`)

**Purpose**: Daily reminder scheduling and management.

**Features**:
- Configurable reminder times (3PM-11PM)
- Smart scheduling across all days of the week
- Skip if already logged
- Multiple reminder messages
- Serverless-aware implementation
- Default timezone set to `Australia/Melbourne` for consistent cron alignment

**API**:
```javascript
class DailyReminder {
  start()                           // Start reminder scheduling
  stop()                            // Stop reminders
  async sendReminder()              // Send immediate reminder
  async triggerManualReminder()     // Test reminder
  getStatus()                       // Get system status
  updateConfig(newConfig)           // Update settings
}

// Serverless helper functions
function createDailyReminder(bot, userId, database)
async function sendScheduledReminder(bot, userId, database, forceReminder)
```

### 7. Daily Reminder API (`api/reminder.js`)

**Purpose**: External API endpoint for triggering reminders via GitHub Actions or cron services.

**Features**:
- Bearer token authentication
- GitHub Actions integration
- Test mode support
- User authorization validation

**API Endpoint**:
```javascript
POST /api/reminder
Authorization: Bearer <REMINDER_SECRET>
Content-Type: application/json

{
  "action": "send_daily",
  "user_id": "123456789",
  "source": "github_actions_production"
}
```

## 🗄️ Database Design

### Document Schema

```javascript
{
  _id: ObjectId,              // MongoDB primary key
  date: String,               // YYYY-MM-DD format
  hours: Number,              // Decimal hours (0.1 - 24.0)
  tag: String,                // Project/category (lowercase, trimmed)
  raw_message: String,        // Original user message (max 500 chars)
  timestamp: Date             // Auto-generated timestamp
}
```

### Indexes

```javascript
// Performance optimization indexes
db.workentries.createIndex({ "date": 1 })
db.workentries.createIndex({ "tag": 1 })
db.workentries.createIndex({ "timestamp": -1 })

// Compound indexes for complex queries
db.workentries.createIndex({ "date": 1, "tag": 1 })
```

### Data Validation

**Schema Constraints**:
- `date`: Must match YYYY-MM-DD pattern
- `hours`: Range 0.1 to 24.0
- `tag`: Trimmed and lowercased
- `raw_message`: Maximum 500 characters

**Application-Level Validation**:
- Date range validation (±1 year from current)
- Hour format validation
- Tag meaningfulness checks

## 🔌 API Reference

### Webhook Endpoint

**URL**: `POST /api/bot`
**Purpose**: Receive Telegram webhook updates

**Request Format**:
```javascript
{
  "update_id": 123456789,
  "message": {
    "message_id": 123,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "User"
    },
    "chat": {
      "id": 987654321,
      "type": "private"
    },
    "date": 1640995200,
    "text": "Worked 6 hours today"
  }
}
```

**Response Format**:
```javascript
{
  "method": "sendMessage",
  "chat_id": 987654321,
  "text": "✅ Logged 6 hours for today.",
  "parse_mode": "Markdown"
}
```

### Internal API Methods

#### Message Parsing

```javascript
// Parse natural language message
const result = parser.parseMessage("Worked 6.5 hours on project X yesterday");
// Returns:
{
  hours: 6.5,
  date: "2024-01-14",
  tag: "project x",
  isValidWorkLog: true
}
```

#### Database Operations

```javascript
// Log work entry
const entry = await db.logWorkEntry("2024-01-15", 8.0, "coding", "Worked 8 hours coding today");

// Get summaries
const weeklyData = await db.getWeeklyTotal("2024-01-08", "2024-01-14");
const categoryData = await db.getCategoryTotal("coding");
```

## 🔄 Message Processing Pipeline

### 1. Request Reception
```
Telegram → Webhook URL → Vercel Function → Request Handler
```

### 2. Authentication
```javascript
if (userId !== authorizedUserId) {
  return unauthorizedResponse;
}
```

### 3. Message Classification
```javascript
if (text.startsWith('/')) {
  return handleCommand(text, chatId);
} else {
  return handleWorkLogMessage(text, chatId);
}
```

### 4. Work Log Processing
```
Raw Message → Parser → Validation → Database → Confirmation
```

### 5. Command Processing
```
Command → Router → Handler → Database Query → Response Formatter
```

### 6. Response Delivery
```
Response Object → Webhook Response → Telegram → User
```

## 🚀 Deployment Architecture

### Serverless Function Model

**Platform Support**:
- ✅ Vercel (Primary)
- ✅ Railway
- ✅ Render
- ✅ Fly.io

**Function Configuration**:
```json
{
  "functions": {
    "api/bot.js": {
      "maxDuration": 30
    }
  }
}
```

### Environment Variables

**Required Configuration**:
```bash
TELEGRAM_BOT_TOKEN=<bot_token>      # Telegram bot authentication
AUTHORIZED_USER_ID=<user_id>        # Single user authorization
MONGODB_URI=<connection_string>     # Database connection
```

**Optional Configuration**:
```bash
NODE_ENV=production                 # Environment mode
LOG_LEVEL=info                      # Logging verbosity
```

### Database Deployment

**MongoDB Atlas (Recommended)**:
- Free tier sufficient for personal use
- Automatic backups and scaling
- Global distribution
- Advanced security features

**Connection String Format**:
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

## 🔒 Security Implementation

### Authentication Layer

```javascript
// Single user authorization
const authorizedUserId = parseInt(process.env.AUTHORIZED_USER_ID);
if (userId !== authorizedUserId) {
  return unauthorizedResponse;
}
```

### Input Validation

```javascript
// Message validation
if (!message || typeof message !== 'string') {
  return invalidInputResponse;
}

// Hour range validation
if (hours < 0.1 || hours > 24) {
  return invalidHoursResponse;
}
```

### Database Security

**Connection Security**:
- TLS encryption for all connections
- Authentication required
- Network access restrictions

**Data Protection**:
- No sensitive data stored
- User data isolation
- Audit logging

### Environment Security

**Best Practices**:
- Environment variables for secrets
- No hardcoded credentials
- Platform-specific security features
- HTTPS-only communication

## ⚡ Performance Optimizations

### Database Optimizations

**Connection Management**:
```javascript
// Singleton connection pattern
if (this.isConnected && mongoose.connection.readyState === 1) {
  return; // Reuse existing connection
}
```

**Query Optimization**:
```javascript
// Lean queries for better performance
return await WorkEntry.find({ date })
  .sort({ timestamp: -1 })
  .lean(); // No Mongoose document overhead
```

**Indexing Strategy**:
- Primary queries indexed
- Compound indexes for complex operations
- Background index creation

### Serverless Optimizations

**Cold Start Reduction**:
- Minimal dependencies
- Efficient initialization
- Connection reuse

**Memory Management**:
- Lean database queries
- Efficient object creation
- Garbage collection optimization

### Response Time Optimization

**Parallel Operations**:
```javascript
// Parallel database queries
const [weekEntries, monthEntries] = await Promise.all([
  this.db.getEntriesBetween(startOfWeek, endOfWeek),
  this.db.getEntriesBetween(startOfMonth, endOfMonth)
]);
```

**Efficient Formatting**:
- Pre-computed values
- Minimal string operations
- Cached responses where appropriate

## 🚨 Error Handling

### Error Categories

**1. Input Errors**:
- Invalid message format
- Out-of-range values
- Missing required parameters

**2. System Errors**:
- Database connection failures
- Authentication errors
- Network timeouts

**3. Business Logic Errors**:
- Invalid date ranges
- Duplicate entries
- Permission violations

### Error Response Strategy

```javascript
try {
  // Operation
} catch (error) {
  console.error('Detailed error for logs:', error);
  return {
    chatId,
    text: '❌ User-friendly error message'
  };
}
```

### Graceful Degradation

**Database Unavailable**:
- Return cached responses when possible
- Provide meaningful error messages
- Suggest retry actions

**Partial Failures**:
- Return partial results with warnings
- Identify failed operations
- Provide recovery instructions

## 🧪 Testing Strategy

### Unit Testing

**Test Coverage Areas**:
- Message parsing logic
- Database operations
- Command handlers
- Utility functions

**Example Test**:
```javascript
describe('MessageParser', () => {
  test('should parse hours correctly', () => {
    const parser = new MessageParser();
    const result = parser.parseMessage('Worked 6.5 hours today');
    expect(result.hours).toBe(6.5);
    expect(result.isValidWorkLog).toBe(true);
  });
});
```

### Integration Testing

**Webhook Testing**:
```javascript
// Test webhook endpoint
const response = await request(app)
  .post('/api/bot')
  .send(mockTelegramUpdate)
  .expect(200);
```

**Database Testing**:
```javascript
// Test database operations
const entry = await db.logWorkEntry('2024-01-15', 8, 'test', 'Test message');
expect(entry.hours).toBe(8);
```

### Manual Testing

**Telegram Integration**:
- Real bot testing with actual messages
- Command validation
- Error scenario testing
- Performance testing

## 📊 Monitoring and Logging

### Application Logging

**Log Levels**:
- `ERROR`: System errors and failures
- `WARN`: Recoverable issues
- `INFO`: General operation info
- `DEBUG`: Detailed execution traces

**Log Format**:
```javascript
console.log(`[${timestamp}] ${level}: ${message}`, {
  userId,
  messageId,
  operation,
  duration
});
```

### Performance Monitoring

**Key Metrics**:
- Response time
- Database query performance
- Error rates
- Memory usage

**Health Checks**:
```javascript
// Basic health endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});
```

### Production Monitoring

**Platform Tools**:
- Vercel Analytics
- MongoDB Atlas Monitoring
- Platform-specific logging

**Custom Metrics**:
- Message processing rate
- User engagement
- Command usage statistics
- Error patterns

---

## 🔧 Development Workflow

### Local Development Setup

1. **Environment Setup**:
   ```bash
   npm install
   cp .env.example .env
   # Configure environment variables
   ```

2. **Database Setup**:
   ```bash
   # Local MongoDB
   mongod --dbpath ./data
   
   # Or use MongoDB Atlas
   ```

3. **Development Server**:
   ```bash
   npm run dev
   ```

### Code Style Guidelines

**ESLint Configuration**:
```json
{
  "extends": ["eslint:recommended"],
  "rules": {
    "no-console": "warn",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

**Naming Conventions**:
- Classes: PascalCase
- Functions: camelCase
- Constants: UPPER_SNAKE_CASE
- Files: camelCase

### Deployment Process

1. **Code Review**: All changes reviewed
2. **Testing**: Comprehensive test suite
3. **Staging**: Deploy to staging environment
4. **Production**: Deploy to production platform
5. **Monitoring**: Verify deployment health

---

This technical documentation provides a comprehensive overview of the Telegram Work Hours Logger Bot architecture, implementation details, and operational considerations. It serves as a reference for developers working on the project and for understanding the system's design decisions.
