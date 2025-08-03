# Telegram Work Hours Logger Bot

A sophisticated Node.js Telegram bot that allows you to log your daily work hours through natural language messages and provides comprehensive analytics and summaries. Designed for serverless deployment with MongoDB storage.

## ✨ Features

### 📝 **Natural Language Logging**
- Log hours with messages like "Worked 6 hours today" or "5.5 hrs on freelance"
- Smart parsing understands various time formats (6h, 5.5 hours, 3 hrs, 8.25h)
- No complex forms or rigid syntax required

### 🗓️ **Flexible Date Recognition**
- Supports "today", "yesterday", and specific dates (12/25, 2023-12-25)
- Multiple date formats accepted (MM/DD, DD/MM, YYYY-MM-DD)
- Automatic date validation and reasonable range checking

### 🏷️ **Intelligent Tagging**
- Automatic detection of project names and categories from your messages
- Extract tags from context: "coding", "client work", "project X"
- Manual tag filtering with `/category` command

### 📊 **Comprehensive Analytics**
- Weekly and monthly summaries with day-type breakdown
- Pay cycle tracking (bi-weekly periods)
- Category-based hour filtering and totals
- Entry history with timestamps

### 🔒 **Security & Privacy**
- Single user authorization (only accepts messages from your user ID)
- All data stored in your private MongoDB database
- No third-party data sharing

### ⚡ **Serverless Optimized**
- Webhook-based deployment for reliability
- MongoDB cloud storage for persistence
- Optimized for Vercel, Railway, and similar platforms
- No polling required - event-driven responses

### 💬 **User Experience**
- Real-time confirmation messages
- Emoji-rich, readable responses
- Error handling with helpful guidance
- Mobile-friendly Telegram interface

## 🤖 Commands

| Command | Description | Example Usage |
|---------|-------------|---------------|
| `/summary` | Weekly and monthly totals with day breakdown | Shows current week/month hours |
| `/today` | Today's logged hours and individual entries | All work logged for today |
| `/log` | Last 5 work entries with timestamps | Recent work history |
| `/category <tag>` | Total hours for specific category/project | `/category coding` |
| `/paycycle` | Hours for current pay cycle (bi-weekly) | Current 14-day period totals |
| `/help` | Complete help message and usage guide | Available commands and tips |

## 💬 Example Messages

The bot understands natural language and extracts meaningful information:

```
✅ "Worked 6 hours today"
✅ "5.5 hrs on freelance project"
✅ "Yesterday I did 3 hours on project X"
✅ "8.25 hours coding on 12/15"
✅ "2.5 hours meeting with client ABC"
✅ "4h documentation work yesterday"
```

## 🚀 Quick Setup

### 1. Create a Telegram Bot

1. Message [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow the instructions
3. Save the bot token you receive

### 2. Get Your User ID

1. Message [@userinfobot](https://t.me/userinfobot) on Telegram
2. Note down your user ID number

### 3. Set Up MongoDB Database

Choose one of these options:

#### Option A: MongoDB Atlas (Recommended - Free Tier Available)
1. Create account at [MongoDB Atlas](https://cloud.mongodb.com)
2. Create a new cluster (free tier is sufficient)
3. Create database user with read/write permissions
4. Get connection string (looks like `mongodb+srv://...`)

#### Option B: Local MongoDB (Development Only)
1. Install MongoDB locally
2. Use connection string: `mongodb://localhost:27017/workhoursbot`

### 4. Environment Configuration

Set these environment variables in your deployment platform:

```env
TELEGRAM_BOT_TOKEN=your_bot_token_here
AUTHORIZED_USER_ID=your_telegram_user_id_here
MONGODB_URI=your_mongodb_connection_string
```

## 🌐 Deployment Options

### Deploy to Vercel (Recommended)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/telegram-work-logger)

1. Fork this repository
2. Connect to [Vercel](https://vercel.com)
3. Add environment variables in Vercel dashboard
4. Deploy automatically
5. Set webhook URL in BotFather: `https://your-app.vercel.app/api/bot`

### Deploy to Railway

1. Fork this repository
2. Connect your GitHub repo to [Railway](https://railway.app)
3. Add environment variables in Railway dashboard
4. Deploy automatically
5. Set webhook URL in BotFather

### Deploy to Render

1. Fork this repository
2. Create a new Web Service on [Render](https://render.com)
3. Connect your GitHub repo
4. Add environment variables
5. Deploy
6. Set webhook URL in BotFather

### Deploy to Fly.io

1. Install [Fly CLI](https://fly.io/docs/getting-started/installing-flyctl/)
2. Run `fly launch` in project directory
3. Set environment variables: `fly secrets set TELEGRAM_BOT_TOKEN=your_token`
4. Deploy: `fly deploy`
5. Set webhook URL in BotFather

## 🗄️ Database Schema

The bot uses MongoDB with the following document structure:

```javascript
{
  _id: ObjectId("..."),           // MongoDB document ID
  date: "2024-01-15",            // Work date (YYYY-MM-DD)
  hours: 6.5,                    // Hours worked (decimal)
  tag: "coding",                 // Project/category tag (optional)
  raw_message: "Worked 6.5 hours coding today", // Original message
  timestamp: ISODate("2024-01-15T14:30:00Z")    // When logged
}
```

### Indexes
- `date`: For efficient date-range queries
- `tag`: For category filtering
- `timestamp`: For recent entries sorting

## 📁 Project Structure

```
├── api/
│   ├── bot.js              # Vercel webhook handler
│   ├── test.js             # Test endpoint
│   └── test-post.js        # POST test endpoint
├── bot.js                  # Core bot setup and configuration
├── database.js             # MongoDB operations and connection management
├── messageParser.js        # Natural language parsing logic
├── commands.js             # Bot command handlers and responses
├── index.js                # Local development entry point
├── package.json            # Dependencies and scripts
├── vercel.json             # Vercel deployment configuration
└── README.md               # This file
```

## 🔧 Local Development

### Prerequisites
- Node.js 16+ 
- MongoDB (local or cloud)
- Telegram Bot Token
- Your Telegram User ID

### Setup Steps

1. **Clone and Install**
   ```bash
   git clone <repository-url>
   cd telegram-work-logger
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Environment Variables**
   ```env
   TELEGRAM_BOT_TOKEN=your_bot_token_here
   AUTHORIZED_USER_ID=your_telegram_user_id_here
   MONGODB_URI=mongodb://localhost:27017/workhoursbot
   # or MongoDB Atlas connection string
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Test the Bot**
   - Message your bot on Telegram
   - Send "hi" to test basic functionality
   - Try logging hours: "Worked 5 hours today"

## 🚨 Troubleshooting

### Bot Not Responding
- ✅ Verify `TELEGRAM_BOT_TOKEN` is correct
- ✅ Check `AUTHORIZED_USER_ID` matches your Telegram user ID
- ✅ Ensure webhook URL is set correctly in BotFather
- ✅ Check server logs for error messages

### Database Connection Issues
- ✅ Verify `MONGODB_URI` connection string is correct
- ✅ Check database user has read/write permissions
- ✅ Ensure network access is allowed (Atlas IP whitelist)
- ✅ Test connection from your deployment platform

### Deployment Issues
- ✅ All environment variables set on hosting platform
- ✅ Webhook URL accessible and returning 200 status
- ✅ Check platform logs for detailed error messages
- ✅ Verify serverless function timeout settings

### Data Not Persisting
- ✅ Using MongoDB (not SQLite) for persistent storage
- ✅ Database connection string includes authentication
- ✅ Write permissions configured correctly
- ✅ Check for connection timeout issues

## 🔒 Security Considerations

- **Single User Access**: Only your Telegram user ID can interact with the bot
- **Environment Variables**: Store sensitive data in platform environment variables
- **Database Security**: Use strong passwords and restricted network access
- **HTTPS**: All webhook communication uses HTTPS encryption
- **No Data Sharing**: All work data stays in your private database

## 🛠️ Advanced Configuration

### Pay Cycle Customization

To change the pay cycle start date, edit `commands.js`:

```javascript
const PAY_CYCLE_START = '2024-07-21'; // Must be a Monday
```

### Date Format Preferences

The parser supports multiple formats. To prioritize specific formats, modify the patterns in `messageParser.js`.

### Custom Categories

The bot automatically extracts tags, but you can enhance detection by adding keywords to `messageParser.js`:

```javascript
this.tagKeywords = [
  'on', 'for', 'project', 'client', 'freelance', 'work', 'task',
  'meeting', 'coding', 'development', 'design', 'research',
  // Add your custom keywords here
];
```

## 📈 Analytics Features

### Weekly Summaries
- Monday-Sunday hour totals
- Breakdown by weekdays, Saturday, Sunday
- Entry count for the period

### Monthly Summaries  
- Full calendar month totals
- Day-type breakdown
- Historical comparison capability

### Pay Cycle Tracking
- Bi-weekly period calculations
- Configurable start date
- Perfect for freelancers and contractors

### Category Analysis
- Total hours per project/tag
- Cross-project time comparison
- Client billing summaries

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes with tests
4. Commit changes: `git commit -am 'Add feature'`
5. Push to branch: `git push origin feature-name`
6. Submit a pull request

### Development Guidelines
- Follow existing code style and commenting patterns
- Add JSDoc comments for new functions
- Test changes thoroughly with real Telegram messages
- Update documentation for new features

## 📄 License

MIT License - feel free to modify and use for your own projects.

## 🆘 Support

If you encounter issues:

1. **Check the troubleshooting section** above
2. **Review server/platform logs** for detailed error messages
3. **Verify environment variables** are set correctly
4. **Test with simple messages** first ("Worked 5 hours today")
5. **Check MongoDB connection** from your deployment platform

For additional help:
- Review the [Telegram Bot API documentation](https://core.telegram.org/bots/api)
- Check [MongoDB Atlas documentation](https://docs.atlas.mongodb.com/)
- Consult your hosting platform's serverless function documentation

## 🚀 What's Next?

Current features provide comprehensive work tracking. Future enhancements might include:

- 📊 Data export functionality (CSV, JSON)
- 📈 Advanced analytics and charts
- 🔔 Smart reminder system
- 📱 Web dashboard interface
- 🔌 Integration with time tracking apps
- 📧 Email summaries and reports
- 🎯 Goal tracking and productivity metrics

---

**Happy time tracking! 🎯**