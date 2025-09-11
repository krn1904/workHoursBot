# API Documentation - Telegram Work Hours Logger Bot

## 📋 Table of Contents

1. [Overview](#overview)
2. [Webhook API](#webhook-api)
3. [Message Processing API](#message-processing-api)
4. [Database API](#database-api)
5. [Parser API](#parser-api)
6. [Commands API](#commands-api)
7. [Response Formats](#response-formats)
8. [Error Codes](#error-codes)
9. [Rate Limits](#rate-limits)
10. [Examples](#examples)

## 🔍 Overview

The Telegram Work Hours Logger Bot provides several APIs for different purposes:

- **Webhook API**: Receives updates from Telegram (located in `/api/bot.js`)
- **Reminder API**: External endpoint for scheduled reminders (located in `/api/reminder.js`)
- **Internal APIs**: For message processing, database operations, and command handling (located in `/src/bot/`)
- **Response APIs**: For sending formatted responses back to users

All APIs follow RESTful principles and use JSON for data exchange.

### Project Structure Context

```
├── api/                      # Serverless API endpoints
│   ├── bot.js               # Main webhook handler
│   └── reminder.js          # Daily reminder API endpoint
├── src/bot/                 # Core application logic
│   ├── bot.js               # Bot setup and initialization
│   ├── handlers/            # Message and command processing
│   │   ├── commands.js      # Command handlers
│   │   └── messageParser.js # Natural language parser
│   └── services/            # Business logic services
│       ├── database.js      # Database operations
│       └── reminder.js      # Reminder scheduling
```

## 🔗 Webhook API

### POST /api/bot

Main webhook endpoint that receives all Telegram updates.

#### Request Headers
```
Content-Type: application/json
User-Agent: TelegramBot (like TwitterBot)
```

#### Request Body

Standard Telegram webhook update format:

```javascript
{
  "update_id": Number,
  "message": {
    "message_id": Number,
    "from": {
      "id": Number,
      "is_bot": Boolean,
      "first_name": String,
      "last_name": String?, 
      "username": String?
    },
    "chat": {
      "id": Number,
      "type": "private" | "group" | "supergroup" | "channel"
    },
    "date": Number, // Unix timestamp
    "text": String
  }
}
```

#### Response Body

Webhook response format for sending messages:

```javascript
{
  "method": "sendMessage",
  "chat_id": Number,
  "text": String,
  "parse_mode": "Markdown" | "HTML"?
}
```

#### Response Codes

| Code | Description |
|------|-------------|
| 200 | Success - Message processed |
| 405 | Method not allowed (non-POST) |
| 500 | Internal server error |

#### Example Request

```javascript
{
  "update_id": 123456789,
  "message": {
    "message_id": 1234,
    "from": {
      "id": 987654321,
      "is_bot": false,
      "first_name": "John",
      "username": "john_doe"
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

#### Example Response

```javascript
{
  "method": "sendMessage",
  "chat_id": 987654321,
  "text": "✅ Logged 6 hours for today.",
  "parse_mode": "Markdown"
}
```

## 💬 Message Processing API

### processUpdateWithResponse(update)

Processes incoming Telegram updates and returns response data.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| update | Object | Telegram update object |

#### Returns

| Type | Description |
|------|-------------|
| Object\|null | Response object or null if no response needed |

#### Response Object Structure

```javascript
{
  chatId: Number,
  text: String,
  parseMode: String?
}
```

#### Example Usage

```javascript
const response = await processUpdateWithResponse(telegramUpdate);
if (response) {
  // Send response back to Telegram
  return res.status(200).json({
    method: 'sendMessage',
    chat_id: response.chatId,
    text: response.text,
    parse_mode: response.parseMode
  });
}
```

### handleCommand(text, chatId)

Processes bot commands and returns formatted responses.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| text | String | Command text (e.g., "/summary") |
| chatId | Number | Telegram chat ID |

#### Returns

| Type | Description |
|------|-------------|
| Promise\<Object\> | Response object with formatted command result |

#### Supported Commands

| Command | Parameters | Description |
|---------|------------|-------------|
| /summary | None | Weekly and monthly work summaries |
| /today | None | Today's work entries |
| /log | None | Last 5 work entries |
| /category | tag | Hours for specific category |
| /paycycle | None | Current pay cycle summary |
| /help | None | Help message |
| /delete | [n] | Preview last n entries (default 5, max 10) |
| /delete confirm | 1,3,4 | Delete specific items by preview index (1–10) |

### handleWorkLogMessage(text, chatId)

Processes natural language work log messages.

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| text | String | User message text |
| chatId | Number | Telegram chat ID |

#### Returns

| Type | Description |
|------|-------------|
| Promise\<Object\> | Response object with confirmation or error |

#### Processing Flow

1. Parse message for work hours
2. Validate extracted data
3. Save to database
4. Return confirmation

## 🗄️ Database API

### Database Class Methods

#### connectToMongoDB()

Establishes connection to MongoDB database.

```javascript
await database.connectToMongoDB();
```

**Returns**: `Promise<void>`

#### logWorkEntry(date, hours, tag, rawMessage)

Logs a new work entry to the database.

**Parameters**:
- `date` (String): Date in YYYY-MM-DD format
- `hours` (Number): Hours worked (0.1 - 24.0)
- `tag` (String): Optional project/category tag
- `rawMessage` (String): Original user message

**Returns**: `Promise<Object>`

```javascript
{
  id: ObjectId,
  date: String,
  hours: Number,
  tag: String
}
```

**Example**:
```javascript
const entry = await db.logWorkEntry(
  '2024-01-15', 
  8.5, 
  'coding', 
  'Worked 8.5 hours coding today'
);
```

#### getTodayEntries(date)

Retrieves all work entries for a specific date.

**Parameters**:
- `date` (String): Date in YYYY-MM-DD format

**Returns**: `Promise<Array<Object>>`

**Example**:
```javascript
const entries = await db.getTodayEntries('2024-01-15');
// Returns array of work entry objects
```

#### getLastEntries(limit)

Gets the most recent work entries.

**Parameters**:
- `limit` (Number): Maximum entries to return (default: 5)

**Returns**: `Promise<Array<Object>>`

**Example**:
```javascript
const recent = await db.getLastEntries(10);
```

#### getWeeklyTotal(startDate, endDate)

Calculates total hours for a date range.

**Parameters**:
- `startDate` (String): Start date (YYYY-MM-DD)
- `endDate` (String): End date (YYYY-MM-DD)

**Returns**: `Promise<Object>`

```javascript
{
  totalHours: Number,
  entries: Number
}
```

#### getCategoryTotal(tag)

Gets total hours for a specific category/tag.

**Parameters**:
- `tag` (String): Category tag to search for

**Returns**: `Promise<Object>`

```javascript
{
  totalHours: Number,
  entries: Number
}
```

#### getEntriesBetween(startDate, endDate)

Retrieves all entries between two dates.

**Parameters**:
- `startDate` (String): Start date (YYYY-MM-DD)
- `endDate` (String): End date (YYYY-MM-DD)

**Returns**: `Promise<Array<Object>>`

## 🔍 Parser API

### MessageParser Class Methods

#### parseMessage(message)

Main parsing function that extracts structured data from natural language messages.

**Parameters**:
- `message` (String): User message to parse

**Returns**: `Object`

```javascript
{
  hours: Number|null,
  date: String, // YYYY-MM-DD
  tag: String|null,
  isValidWorkLog: Boolean
}
```

**Example**:
```javascript
const parser = new MessageParser();
const result = parser.parseMessage("Worked 6.5 hours on project X yesterday");

// Result:
{
  hours: 6.5,
  date: "2024-01-14",
  tag: "project x",
  isValidWorkLog: true
}
```

#### extractTag(message)

Extracts project/category tags from message text.

**Parameters**:
- `message` (String): Message text to analyze

**Returns**: `String|null`

**Example**:
```javascript
const tag = parser.extractTag("Worked on coding project");
// Returns: "coding"
```

#### formatHours(hours)

Formats hours for display (removes unnecessary decimals).

**Parameters**:
- `hours` (Number): Hours to format

**Returns**: `String`

**Example**:
```javascript
parser.formatHours(6.0);   // "6"
parser.formatHours(6.5);   // "6.5"
parser.formatHours(6.25);  // "6.3"
```

#### isWorkLogMessage(message)

Quick validation to check if message contains work hours.

**Parameters**:
- `message` (String): Message to validate

**Returns**: `Boolean`

**Example**:
```javascript
parser.isWorkLogMessage("Worked 8 hours");  // true
parser.isWorkLogMessage("Hello there");     // false
```

#### extractHours(message)

Extracts just the hours value from a message.

**Parameters**:
- `message` (String): Message to extract hours from

**Returns**: `Number|null`

**Example**:
```javascript
parser.extractHours("Worked 6.5 hours today");  // 6.5
parser.extractHours("Had a great day");          // null
```

## ⚡ Commands API

### Commands Class Methods

#### handleSummary()

Generates weekly and monthly work summaries.

**Returns**: `Promise<String>` - Formatted summary message

**Response Format**:
```
📊 *Work Summary*

📅 *This Week:* X hours (Y entries)
   🏢 Weekdays: Xh
   📆 Saturday: Xh
   ☀️ Sunday: Xh

🗓️ *This Month:* X hours (Y entries)
   🏢 Weekdays: Xh
   📆 Saturday: Xh
   ☀️ Sunday: Xh
```

#### handleToday()

Shows today's work entries and totals.

**Returns**: `Promise<String>` - Formatted today's summary

**Response Format**:
```
📅 *Today's Work Log* (X hours total)
   🏢 Weekdays: Xh
   📆 Saturday: Xh
   ☀️ Sunday: Xh

1. Xh 🏷️ [tag] (🕒 HH:MM)
2. Xh (🕒 HH:MM)
```

#### handleLog()

Returns the last 5 work entries.

**Returns**: `Promise<String>` - Formatted entry list

**Response Format**:
```
📝 *Last 5 Work Entries*

1. Xh 🏷️ [tag] on 📅 MMM DD (🕒 HH:MM)
2. Xh on 📅 MMM DD (🕒 HH:MM)
```

#### handleCategory(tag)

Shows total hours for a specific category.

**Parameters**:
- `tag` (String): Category to search for

**Returns**: `Promise<String>` - Formatted category summary

**Response Format**:
```
🗂️ *Category:* "tag"

⏱️ Total Hours: X
📝 Total Entries: Y
```

#### handlePayCycle()

Shows current pay cycle summary.

**Returns**: `Promise<String>` - Formatted pay cycle data

**Response Format**:
```
🗓️ *Current Pay Cycle* (YYYY-MM-DD to YYYY-MM-DD)

   ⏳ Total: X hours (Y entries)
   🏢 Weekdays: Xh
   📆 Saturday: Xh
   ☀️ Sunday: Xh
```

#### getHelpMessage()

Returns comprehensive help information.

**Returns**: `String` - Formatted help message

### Deletion (Index-Based)

#### handleDelete(args)

Index-based deletion flow.

**Usage:**
- `/delete [n]` – Preview last n entries (default 5, max 10) with indices
- `/delete show 10` – Preview last 10 entries
- `/delete confirm 1,3,4` – Delete specific items by preview index (1–10)

**Returns**: `Promise<String>` – Preview or deletion summary

## 📊 Response Formats

### Success Responses

#### Work Entry Confirmation
```
✅ Logged {hours} hours for {date}{tag}.
```

#### Command Results
All command responses use Markdown formatting with emojis for better readability.

### Error Responses

#### Unauthorized Access
```
🚫 Unauthorized access. This bot is for personal use only.
```

#### Invalid Work Log
```
🤔 I didn't detect work hours in your message.

💡 Try messages like:
• "Worked 6 hours today"
• "5.5 hrs on freelance"
• "Yesterday I did 3 hours"

Or use /help for more information.
```

#### Unknown Command
```
❌ Unknown command: {command}

Use /help to see available commands.
```

#### System Error
```
❌ Error {operation}. Please try again.
```

## 🚨 Error Codes

### Application Error Types

| Code | Type | Description |
|------|------|-------------|
| AUTH_001 | Authentication | Unauthorized user ID |
| PARSE_001 | Parsing | Invalid message format |
| PARSE_002 | Parsing | Hours out of range |
| PARSE_003 | Parsing | Invalid date format |
| DB_001 | Database | Connection failure |
| DB_002 | Database | Query timeout |
| DB_003 | Database | Write operation failed |
| CMD_001 | Command | Unknown command |
| CMD_002 | Command | Missing parameters |

### HTTP Status Codes

| Code | Description | Usage |
|------|-------------|-------|
| 200 | OK | Successful webhook processing |
| 405 | Method Not Allowed | Non-POST requests |
| 500 | Internal Server Error | System failures |

## ⏱️ Rate Limits

### Telegram Limits

- **Bot API**: 30 messages per second
- **Webhook**: No explicit limit, but dependent on server capacity

### Application Limits

- **Single User**: No rate limiting (personal use bot)
- **Database**: Optimized for reasonable personal usage
- **Memory**: Serverless function limits apply

## 📚 Examples

### Complete Message Processing Flow

#### 1. Receive Webhook
```javascript
// POST /api/bot
{
  "update_id": 123456789,
  "message": {
    "message_id": 1234,
    "from": { "id": 987654321, "first_name": "John" },
    "chat": { "id": 987654321, "type": "private" },
    "date": 1640995200,
    "text": "Worked 8.5 hours coding yesterday"
  }
}
```

#### 2. Parse Message
```javascript
const parser = new MessageParser();
const parsed = parser.parseMessage("Worked 8.5 hours coding yesterday");
// Result: { hours: 8.5, date: "2024-01-14", tag: "coding", isValidWorkLog: true }
```

#### 3. Save to Database
```javascript
const entry = await db.logWorkEntry(
  parsed.date,    // "2024-01-14"
  parsed.hours,   // 8.5
  parsed.tag,     // "coding"
  "Worked 8.5 hours coding yesterday"
);
```

#### 4. Send Response
```javascript
{
  "method": "sendMessage",
  "chat_id": 987654321,
  "text": "✅ Logged 8.5 hours for 2024-01-14 under 'coding'."
}
```

### Command Processing Example

#### 1. Receive Command
```javascript
{
  "text": "/summary"
}
```

#### 2. Process Command
```javascript
const commands = new Commands(db, parser);
const response = await commands.handleSummary();
```

#### 3. Return Formatted Response
```javascript
{
  "method": "sendMessage",
  "chat_id": 987654321,
  "text": "📊 *Work Summary*\n\n📅 *This Week:* 40 hours (8 entries)\n...",
  "parse_mode": "Markdown"
}
```

### Error Handling Example

#### 1. Invalid Input
```javascript
{
  "text": "Hello there"
}
```

#### 2. Parse Failure
```javascript
const parsed = parser.parseMessage("Hello there");
// Result: { hours: null, date: "2024-01-15", tag: null, isValidWorkLog: false }
```

#### 3. Error Response
```javascript
{
  "method": "sendMessage",
  "chat_id": 987654321,
  "text": "🤔 I didn't detect work hours in your message.\n\n💡 Try messages like:\n• \"Worked 6 hours today\"\n..."
}
```

---

This API documentation provides comprehensive information about all available APIs, their parameters, return values, and usage examples. It serves as a complete reference for developers working with the Telegram Work Hours Logger Bot.