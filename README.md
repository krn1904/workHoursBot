# Telegram Work Hours Logger Bot

A Node.js Telegram bot that allows you to log your daily work hours through natural language messages and provides summaries and analytics.

## Features

- 📝 **Natural Language Logging**: Log hours with messages like "Worked 6 hours today" or "5.5 hrs on freelance"
- 🗓️ **Date Recognition**: Supports "today", "yesterday", and specific dates
- 🏷️ **Automatic Tagging**: Detects project names and categories from your messages
- 📊 **Analytics**: Get weekly/monthly summaries and category breakdowns
- 🔒 **Single User Security**: Only accepts messages from your authorized user ID
- 💾 **SQLite Storage**: Lightweight local database storage
- ⚡ **Real-time Responses**: Instant confirmation when logging work hours
- 🔍 **Smart Parsing**: Understands various time formats (6h, 5.5 hours, 3 hrs)
- 📈 **Progress Tracking**: Monitor your work patterns over time
- 🏃 **Quick Commands**: Fast access to summaries and recent entries
- 🌐 **Cloud Ready**: Easy deployment to Railway, Render, or Fly.io
- 📱 **Mobile Friendly**: Works seamlessly on Telegram mobile app
- 🔄 **Automatic Timestamps**: Every entry includes when it was logged
- 📋 **Entry History**: View your last 5 work entries with `/log`
- 🎯 **Category Filtering**: Track hours by specific projects or clients
- 📅 **Flexible Dating**: Log work for any day, not just today
- 💬 **Conversational Interface**: No complex forms, just natural messages
- 🛡️ **Error Handling**: Graceful error messages and recovery
- 🚀 **Zero Configuration**: Works out of the box after environment setup
- 📊 **Multiple Time Periods**: Weekly and monthly summaries available
- 🔐 **Privacy First**: All data stored locally or on your chosen hosting platform

## Commands

### Basic Commands
- `/summary` - Weekly and monthly totals with day breakdown
- `/today` - Today's logged hours and individual entries
- `/log` - Last 5 work entries with timestamps
- `/category <tag>` - Hours for specific category/project
- `/paycycle` - Hours for current pay cycle (bi-weekly)
- `/help` - Complete help message and usage guide

### Admin Commands
- `/stats` - Database statistics and overview
- `/validate` - Check database integrity and health
- `/reset confirm` - Reset database (⚠️ DESTRUCTIVE - requires confirmation)
- `/backup` - Create backup of all data

### 🔄 Database Reset Feature

The bot includes a secure database reset functionality for starting fresh:

#### How to Reset
1. **Check current data**: Use `/stats` to see what will be deleted
2. **Initiate reset**: Send `/reset` (without confirm) to see warning
3. **Confirm reset**: Send `/reset confirm` to proceed

#### Safety Features
- ⚠️ **Confirmation required**: Must type `/reset confirm` exactly
- 💾 **Automatic backup**: Creates backup before deletion
- 📊 **Data preview**: Shows what will be deleted
- 🚫 **No accidental resets**: Won't work without explicit confirmation

#### Use Cases
- 🆕 **Fresh start**: Beginning new job or project
- 🧪 **Testing**: Clearing test data
- 🧹 **Data cleanup**: Removing old or incorrect entries
- 🔄 **Migration**: Preparing for data import

**Example Reset Flow:**
```
You: /reset
Bot: Shows warning with current data stats

You: /reset confirm  
Bot: ✅ Database reset complete! Deleted X entries, backup created.
```

📖 **For detailed reset instructions, see [RESET_GUIDE.md](RESET_GUIDE.md)**

## Example Messages

- "Worked 6 hours today"
- "5.5 hrs on freelance"
- "Yesterday I did 3 hours on project X"
- "8 hours coding today"
- "2.5 hours meeting with client"

## Setup Instructions

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the instructions
3. Save the bot token you receive

### 2. Get Your User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Note down your user ID number

### 3. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   AUTHORIZED_USER_ID=your_telegram_user_id_here
   PORT=3000
   NODE_ENV=production
   DATABASE_PATH=./work_hours.db
   ```

### 4. Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the bot:
   ```bash
   npm start
   ```

3. Message your bot on Telegram to test

## Deployment

### Deploy to Railway

1. Fork/clone this repository
2. Connect your GitHub repo to [Railway](https://railway.app)
3. Add environment variables in Railway dashboard
4. Deploy automatically

### Deploy to Render

1. Fork/clone this repository
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repo
4. Add environment variables
5. Deploy

### Deploy to Fly.io

1. Install [Fly CLI](https://fly.io/docs/getting-started/installing-flyctl/)
2. Run `fly launch` in project directory
3. Set environment variables: `fly secrets set TELEGRAM_BOT_TOKEN=your_token`
4. Deploy: `fly deploy`

## Database Schema

The bot uses SQLite with a simple schema:

```sql
CREATE TABLE work_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,           -- YYYY-MM-DD format
  hours REAL NOT NULL,          -- Decimal hours (e.g., 5.5)
  tag TEXT,                     -- Optional category/project tag
  raw_message TEXT NOT NULL,    -- Original message from user
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Project Structure

```
├── api/
│   └── bot.js            # Vercel webhook handler for serverless deployment
├── bot.js                # Core bot setup and configuration
├── database.js           # MongoDB operations and connection management
├── messageParser.js      # Natural language parsing logic
├── commands.js           # Bot command handlers and responses
├── index.js              # Local development entry point
├── package.json          # Dependencies and scripts
├── vercel.json           # Vercel deployment configuration
├── .env.example          # Environment variables template
├── README.md             # Main documentation
└── RESET_GUIDE.md        # Database reset functionality guide
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - feel free to modify and use for your own projects.

## Troubleshooting

### Bot not responding
- Check that `TELEGRAM_BOT_TOKEN` is correct
- Verify your `AUTHORIZED_USER_ID` matches your Telegram user ID
- Check server logs for error messages

### Database issues
- Ensure the bot has write permissions in the directory
- Check that `DATABASE_PATH` is accessible
- Database is created automatically on first run

### Deployment issues
- Make sure all environment variables are set on your hosting platform
- Check that the `PORT` environment variable is used by your hosting provider
- Verify the health check endpoint is accessible at `/health`

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server logs for error messages
3. Ensure all environment variables are properly set
4. Test locally before deploying

## TODO

### Problem
- Free hosting platforms (Render, Railway, Heroku, etc.) put your bot to sleep after inactivity. This causes polling bots to miss messages and, if using SQLite, lose all data on restart.

### Potential Solutions
- Use a paid hosting plan (Render, Railway, Heroku, VPS, etc.) to keep your bot always running.
- Use a cloud database (e.g., PostgreSQL, MongoDB Atlas) for persistent data storage.
- Run your bot on your own always-on server (home server, Raspberry Pi, etc.).