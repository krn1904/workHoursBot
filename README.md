# Telegram Work Hours Logger Bot

A Node.js Telegram bot that allows you to log your daily work hours through natural language messages and provides summaries and analytics. Built for serverless deployment with MongoDB integration and webhook-based message handling.

## Features

- 📝 **Natural Language Logging**: Log hours with messages like "Worked 6 hours today" or "5.5 hrs on freelance"
- 🗓️ **Date Recognition**: Supports "today", "yesterday", and specific dates
- 🏷️ **Automatic Tagging**: Detects project names and categories from your messages
- 📊 **Analytics**: Get weekly/monthly summaries and category breakdowns
- 🔒 **Single User Security**: Only accepts messages from your authorized user ID
- 💾 **MongoDB Storage**: Cloud-ready database with automatic connection management
- ⚡ **Webhook Integration**: Serverless-optimized message handling for Vercel deployment
- 🔍 **Smart Parsing**: Understands various time formats (6h, 5.5 hours, 3 hrs)
- 📈 **Progress Tracking**: Monitor your work patterns over time with 14-day pay cycles
- 🏃 **Quick Commands**: Fast access to summaries and recent entries
- 🌐 **Cloud Ready**: Optimized for Vercel, Railway, Render deployment
- 📱 **Mobile Friendly**: Works seamlessly on Telegram mobile app
- 🔄 **Automatic Timestamps**: Every entry includes when it was logged
- 📋 **Entry History**: View your last 5 work entries with `/log`
- 🎯 **Category Filtering**: Track hours by specific projects or clients
- 📅 **Flexible Dating**: Log work for any day, not just today
- 💬 **Conversational Interface**: No complex forms, just natural messages
- 🛡️ **Error Handling**: Graceful error messages and recovery
- 🚀 **Zero Configuration**: Works out of the box after environment setup
- 📊 **Multiple Time Periods**: Weekly and monthly summaries available
- 🔐 **Privacy First**: Secure cloud database with connection pooling

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

### 3. MongoDB Setup

1. Create a free MongoDB Atlas account at [mongodb.com](https://www.mongodb.com/atlas)
2. Create a new cluster and database
3. Get your MongoDB connection string
4. Add your IP address to the whitelist (or use 0.0.0.0/0 for all IPs)

### 4. Environment Configuration

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your values:
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   AUTHORIZED_USER_ID=your_telegram_user_id_here
   MONGODB_URI=your_mongodb_connection_string
   DATABASE_NAME=workhoursbot
   PORT=3000
   NODE_ENV=production
   ```

### 5. Local Development

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

### Deploy to Vercel (Recommended)

1. Fork/clone this repository
2. Connect your GitHub repo to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy automatically
5. Set your bot webhook URL to: `https://your-vercel-domain.vercel.app/api/bot`

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

## Database Schema

The bot uses MongoDB with the following collection structure:

```javascript
// work_entries collection
{
  _id: ObjectId,
  date: "YYYY-MM-DD",           // Date string
  hours: 5.5,                   // Decimal hours
  tag: "project-name",          // Optional category/project tag
  raw_message: "5.5 hrs on freelance", // Original message
  timestamp: ISODate,           // When entry was created
  user_id: "123456789"          // Telegram user ID
}
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

## Key Features Explained

### Natural Language Processing
The bot intelligently parses messages to extract:
- **Time amounts**: "6 hours", "5.5 hrs", "3h"
- **Dates**: "today", "yesterday", "Monday", "2025-01-15"
- **Project tags**: Automatically detects project names and categories

### Pay Cycle Tracking
- **14-day cycles**: Automatically tracks bi-weekly periods
- **Current cycle**: Starts with your first logged entry
- **Flexible updates**: Easy to adjust cycle dates when needed

### MongoDB Integration
- **Connection pooling**: Efficient database connections for serverless
- **Automatic reconnection**: Handles connection drops gracefully
- **Cloud-ready**: Optimized for MongoDB Atlas and serverless deployment

### Webhook Architecture
- **Serverless optimized**: Perfect for Vercel, Netlify, and similar platforms
- **No polling**: Uses Telegram webhooks for instant message processing
- **Stateless**: Each request is independent, ideal for serverless functions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly with MongoDB connection
5. Submit a pull request

## License

MIT License - feel free to modify and use for your own projects.

## Troubleshooting

### Bot not responding
- Check that `TELEGRAM_BOT_TOKEN` is correct
- Verify your `AUTHORIZED_USER_ID` matches your Telegram user ID
- Ensure webhook URL is properly set in Telegram
- Check server logs for error messages

### Database issues
- Verify `MONGODB_URI` connection string is correct
- Check MongoDB Atlas network access settings
- Ensure database user has read/write permissions
- Test MongoDB connection independently

### Deployment issues
- Make sure all environment variables are set on your hosting platform
- Check that the webhook endpoint `/api/bot` is accessible
- Verify MongoDB connection from your hosting environment
- Test webhook URL responds to POST requests

### Webhook Setup
For Vercel deployment, set your webhook URL in Telegram:
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-vercel-domain.vercel.app/api/bot"}'
```

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review server/function logs for error messages
3. Test MongoDB connection independently
4. Ensure webhook URL is properly configured
5. Verify all environment variables are set correctly