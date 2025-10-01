# Deployment Guide - Telegram Work Hours Logger Bot

## 📋 Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Database Setup](#database-setup)
3. [Platform Deployment](#platform-deployment)
4. [Webhook Configuration](#webhook-configuration)
5. [Testing & Verification](#testing--verification)
6. [Troubleshooting](#troubleshooting)
7. [Post-Deployment](#post-deployment)

## ✅ Pre-Deployment Checklist

Before deploying your bot, ensure you have:

### Required Items
- [ ] **Telegram Bot Token** (from @BotFather)
- [ ] **Your Telegram User ID** (from @userinfobot)  
- [ ] **MongoDB Database** (Atlas account or local instance)
- [ ] **GitHub Repository** (forked/cloned)
- [ ] **Hosting Platform Account** (Vercel, Railway, Render, or Fly.io)

### Optional Items
- [ ] Custom domain (for professional webhook URLs)
- [ ] Monitoring tools setup
- [ ] Backup strategy planned

## 🗄️ Database Setup

### Option A: MongoDB Atlas (Recommended)

MongoDB Atlas provides a free tier perfect for personal use:

#### 1. Create Atlas Account
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Sign up for a free account
3. Complete email verification

#### 2. Create Cluster
1. Click **"Build a Database"**
2. Choose **"Shared"** (free tier)
3. Select your preferred cloud provider and region
4. Name your cluster (e.g., "WorkHoursBot")
5. Click **"Create Cluster"**

#### 3. Configure Database Access
1. Go to **"Database Access"** in the left sidebar
2. Click **"Add New Database User"**
3. Choose **"Password"** authentication
4. Create username and strong password
5. Set privileges to **"Read and write to any database"**
6. Click **"Add User"**

#### 4. Configure Network Access
1. Go to **"Network Access"** in the left sidebar
2. Click **"Add IP Address"**
3. Choose **"Allow Access from Anywhere"** (0.0.0.0/0)
4. Or add specific IPs of your hosting platform
5. Click **"Confirm"**

#### 5. Get Connection String
1. Go to **"Database"** in the left sidebar
2. Click **"Connect"** on your cluster
3. Choose **"Connect your application"**
4. Copy the connection string
5. Replace `<password>` with your database user password
6. Replace `<dbname>` with your preferred database name

**Example Connection String:**
```
mongodb+srv://workbot:mypassword@cluster0.abc123.mongodb.net/workhoursbot?retryWrites=true&w=majority
```

### Option B: Local MongoDB (Development Only)

For local development:

#### 1. Install MongoDB
- **macOS**: `brew install mongodb-community`
- **Ubuntu**: Follow [MongoDB Ubuntu guide](https://docs.mongodb.com/manual/tutorial/install-mongodb-on-ubuntu/)
- **Windows**: Download from [MongoDB Download Center](https://www.mongodb.com/try/download/community)

#### 2. Start MongoDB
```bash
# macOS/Linux
sudo mongod --dbpath /opt/homebrew/var/mongodb

# Windows  
net start MongoDB
```

#### 3. Connection String
```
mongodb://localhost:27017/workhoursbot
```

## 🚀 Platform Deployment

### Vercel (Recommended)

Vercel offers excellent serverless function support with generous free tier:

#### 1. Prepare Repository
```bash
git clone your-repository
cd workhoursbot
```

#### 2. Deploy to Vercel
- Connect GitHub repository to [Vercel](https://vercel.com)
- Import your project
- Vercel will automatically detect Next.js/Node.js configuration

#### 3. Configure Environment Variables
Add these in Vercel dashboard → Project → Settings → Environment Variables:
```
TELEGRAM_BOT_TOKEN=your_bot_token
AUTHORIZED_USER_ID=your_telegram_user_id
MONGODB_URI=your_mongodb_connection_string
REMINDER_SECRET=your_random_secret_key
PAY_RATE=45.0
# Optional overrides:
# PAY_RATE_WEEKDAY=45.0
# PAY_RATE_WEEKEND=60.0
# PAY_RATE_SATURDAY=55.0
# PAY_RATE_SUNDAY=65.0
# PAY_RATE_CURRENCY=AUD
# PAY_RATE_LOCALE=en-AU
# PAY_RATE_SYMBOL=$
PAY_RATE=45.0
# Optional overrides:
# PAY_RATE_WEEKDAY=45.0
# PAY_RATE_WEEKEND=60.0
# PAY_RATE_SATURDAY=55.0
# PAY_RATE_SUNDAY=65.0
# PAY_RATE_CURRENCY=AUD
# PAY_RATE_LOCALE=en-AU
# PAY_RATE_SYMBOL=$
```

#### 4. Redeploy
Force redeploy to apply environment variables

#### 5. Get Webhook URL
Your webhook endpoint will be: `https://your-project.vercel.app/api/bot`

#### 6. Set Up Daily Reminders
Follow the [GitHub Actions Setup Guide](GITHUB_ACTIONS_SETUP.md) to configure automated daily reminders with Australian timezone support.

> ℹ️ Reminders run on the `Australia/Melbourne` timezone by default. If you need a different base timezone, update `DEFAULT_TIMEZONE` in `src/bot/services/reminder.js` and align your GitHub Actions cron schedule accordingly.

### Railway

Railway provides simple deployment with persistent storage:

#### 1. Deploy from GitHub
1. Go to [Railway](https://railway.app)
2. Sign in with GitHub
3. Click **"New Project"**
4. Select **"Deploy from GitHub repo"**
5. Choose your forked repository
6. Click **"Deploy Now"**

#### 2. Configure Environment Variables
1. Go to your project dashboard
2. Click **"Variables"** tab
3. Add the required environment variables:
   - `TELEGRAM_BOT_TOKEN`
   - `AUTHORIZED_USER_ID`
   - `MONGODB_URI`

#### 3. Get Domain
1. Go to **"Settings"** tab
2. Click **"Generate Domain"**
3. Your webhook URL: `https://your-project.up.railway.app/api/bot`

### Render

Render offers free web services with automatic deploys:

#### 1. Create Web Service
1. Go to [Render](https://render.com)
2. Sign in with GitHub
3. Click **"New"** → **"Web Service"**
4. Connect your GitHub repository
5. Configure:
   - **Name**: telegram-work-logger
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

#### 2. Environment Variables
In the **Environment Variables** section, add:
- `TELEGRAM_BOT_TOKEN`
- `AUTHORIZED_USER_ID`  
- `MONGODB_URI`

#### 3. Deploy
1. Click **"Create Web Service"**
2. Wait for deployment to complete
3. Your webhook URL: `https://your-service-name.onrender.com/api/bot`

### Fly.io

Fly.io provides global deployment with Docker containers:

#### 1. Install Fly CLI
```bash
# macOS
brew install flyctl

# Linux
curl -L https://fly.io/install.sh | sh

# Windows
powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
```

#### 2. Login and Initialize
```bash
fly auth login
cd your-project-directory
fly launch
```

#### 3. Configure Secrets
```bash
fly secrets set TELEGRAM_BOT_TOKEN="your_bot_token"
fly secrets set AUTHORIZED_USER_ID="your_user_id"
fly secrets set MONGODB_URI="your_mongodb_uri"
```

#### 4. Deploy
```bash
fly deploy
```

#### 5. Get URL
```bash
fly info
# Your webhook URL: https://your-app-name.fly.dev/api/bot
```

## 🔗 Webhook Configuration

After deployment, configure your bot to use webhooks:

### 1. Set Webhook URL

Use the Telegram API (recommended; BotFather may not expose a setwebhook option):
```bash
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://your-app-domain.com/api/bot"}'
```

### 2. Verify Webhook
```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

**Expected Response:**
```json
{
  "ok": true,
  "result": {
    "url": "https://your-app-domain.com/api/bot",
    "has_custom_certificate": false,
    "pending_update_count": 0,
    "last_error_date": 0,
    "max_connections": 40,
    "allowed_updates": ["message"]
  }
}
```

#### Production vs Preview URLs (Vercel)
- Vercel creates preview deployments per branch/commit.
- To run your bot in production, set the webhook to your production domain (e.g., `https://<project>.vercel.app/api/bot` or your custom domain), not a preview URL (which looks like `...-git-<branch>-...vercel.app`).
- After promoting/merging your branch to production, re-run the `setWebhook` with the production URL.

## 🧪 Testing & Verification

### 1. Basic Bot Test
1. Message your bot on Telegram: **"hi"**
2. Expected response: Welcome message with quick start guide

### 2. Work Log Test
1. Send: **"Worked 6 hours today"**
2. Expected response: **"✅ Logged 6 hours for today."**

### 3. Command Tests
1. Send: **"/help"** → Should show help message
2. Send: **"/today"** → Should show today's entries
3. Send: **"/summary"** → Should show weekly/monthly summary

### 4. Error Handling Test
1. Send: **"Hello world"** → Should show parsing help
2. Send: **"/unknown"** → Should show unknown command error

### 5. Platform Health Check
Visit: `https://your-app-domain.com/api/test` (if available)

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Bot Not Responding
**Symptoms**: No response to messages
**Causes & Solutions**:
- ❌ Wrong webhook URL → Verify URL in BotFather
- ❌ Wrong bot token → Check environment variable
- ❌ Wrong user ID → Verify with @userinfobot
- ❌ Deployment failure → Check platform logs

#### Database Connection Errors
**Symptoms**: "Error saving your work log"
**Causes & Solutions**:
- ❌ Wrong connection string → Verify MongoDB URI
- ❌ Network restrictions → Check Atlas IP whitelist
- ❌ Authentication failure → Verify username/password
- ❌ Database permissions → Check user privileges

#### Serverless Function Timeouts
**Symptoms**: Delayed responses or timeouts
**Causes & Solutions**:
- ❌ Cold start delays → Normal for serverless
- ❌ Database timeout → Optimize connection settings
- ❌ Function timeout → Check platform limits

#### Webhook Certificate Issues
**Symptoms**: Webhook not accepting updates
**Causes & Solutions**:
- ❌ HTTP instead of HTTPS → Use HTTPS URL only
- ❌ Invalid SSL certificate → Use proper hosting platform
- ❌ Self-signed certificate → Use platform-provided domains

### Platform-Specific Debugging

#### Vercel
```bash
# View logs
vercel logs your-project-name

# Local development
vercel dev
```

#### Railway
1. Go to project dashboard
2. Click **"Deployments"** tab
3. View build and runtime logs

#### Render
1. Go to service dashboard
2. Click **"Logs"** tab
3. Monitor real-time logs

#### Fly.io
```bash
# View logs
fly logs

# Check app status
fly status
```

### Database Debugging

#### Test MongoDB Connection
```javascript
// Create test script: test-db.js
const mongoose = require('mongoose');

async function testConnection() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Database connected successfully');
    await mongoose.connection.close();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
  }
}

testConnection();
```

#### MongoDB Atlas Monitoring
1. Go to Atlas dashboard
2. Click **"Monitoring"** → **"Metrics"**
3. Check connection count and performance

## 🔧 Post-Deployment

### 1. Security Hardening

#### Environment Variables
- [ ] Verify all secrets are in platform environment (not in code)
- [ ] Remove any local `.env` files from repository
- [ ] Use strong, unique passwords

#### MongoDB Security
- [ ] Enable 2FA on Atlas account
- [ ] Restrict network access to deployment IPs only
- [ ] Use database-specific users (not root)
- [ ] Enable audit logging if available

#### Platform Security
- [ ] Enable 2FA on hosting platform
- [ ] Set up deployment notifications
- [ ] Review access permissions

### 2. Monitoring Setup

#### Basic Monitoring
- [ ] Set up uptime monitoring (UptimeRobot, Pingdom)
- [ ] Configure error notifications
- [ ] Monitor database usage

#### Advanced Monitoring
- [ ] Set up application performance monitoring
- [ ] Create custom dashboards
- [ ] Configure alerting thresholds

### 3. Backup Strategy

#### Database Backups
- [ ] Atlas automatic backups (enabled by default)
- [ ] Local backup scripts if needed
- [ ] Test restore procedures

#### Code Backups
- [ ] GitHub repository with regular commits
- [ ] Tag releases for easy rollback
- [ ] Document deployment procedures

### 4. Maintenance Planning

#### Regular Tasks
- [ ] Monitor bot usage and performance
- [ ] Review and rotate credentials quarterly
- [ ] Update dependencies regularly
- [ ] Test disaster recovery procedures

#### Scaling Considerations
- [ ] Monitor database storage usage
- [ ] Track serverless function costs
- [ ] Plan for increased usage

### 5. Documentation

#### User Documentation
- [ ] Create user guide for team members
- [ ] Document common commands and usage
- [ ] Provide troubleshooting guide

#### Technical Documentation
- [ ] Document deployment procedures
- [ ] Maintain architecture diagrams
- [ ] Keep environment variables documented

---

## 🎉 Deployment Complete!

Congratulations! Your Telegram Work Hours Logger Bot is now deployed and ready for use. 

### Quick Start Reminder
1. Message your bot: **"hi"**
2. Log your first entry: **"Worked 8 hours today"**
3. Check your summary: **"/summary"**
4. Get help anytime: **"/help"**

### Support Resources
- 📖 [README.md](README.md) - Main documentation
- 🏗️ [TECHNICAL_DOCS.md](TECHNICAL_DOCS.md) - Technical details
- 🔌 [API_DOCS.md](API_DOCS.md) - API reference
- 🌐 Platform-specific documentation
- 💬 Community support forums

Happy time tracking! 🎯

