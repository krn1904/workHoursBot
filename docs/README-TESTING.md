# Testing Your Telegram Bot API Connection

## 🎯 Quick Test Summary

Your bot structure is **✅ CORRECT** and ready for testing!

## 📋 Testing Checklist

### ✅ Completed
- [x] Bot file structure verified
- [x] API endpoints properly configured  
- [x] Webhook handler setup correctly
- [x] Test scripts created

### 🔄 Next Steps
- [ ] Deploy to Vercel/Production
- [ ] Set up Telegram webhook
- [ ] Test live message handling
- [ ] Monitor API logs

## 🚀 Step-by-Step Testing Process

### 1. Deploy Your Bot

First, make sure your bot is deployed to Vercel:

```bash
# Deploy to production
vercel --prod

# Note the deployment URL (e.g., https://your-app-name.vercel.app)
```

### 2. Test Your API Endpoints

Update `test-api.js` with your actual Vercel URL and run:

```bash
# Update BASE_URL in test-api.js first!
node test-api.js
```

Expected output:
- ✅ Environment endpoint working
- ✅ POST test endpoint working
- ✅ Bot webhook endpoint working

### 3. Set Up Telegram Webhook

Replace `<YOUR_BOT_TOKEN>` and `<YOUR_VERCEL_URL>` with your actual values:

```bash
# Set the webhook
curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -d "url=<YOUR_VERCEL_URL>/api/bot"

# Verify webhook is set
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getWebhookInfo"
```

### 4. Test Live Messages

Send these test messages to your bot on Telegram:

1. **Basic work log**: `"Worked 6 hours today"`
2. **Different format**: `"5.5 hrs on freelance"`  
3. **Command test**: `/help`
4. **Authorization test**: Have someone else try to message the bot

### 5. Monitor API Calls

#### Option A: Vercel Dashboard
1. Go to your Vercel dashboard
2. Click on your project
3. Go to "Functions" tab
4. Check logs for `/api/bot` function
5. Send a message and watch for new log entries

#### Option B: Real-time Logs
```bash
# If you have Vercel CLI installed
vercel logs --follow
```

#### Option C: Test Endpoint Monitoring
```bash
# Test if your API is receiving requests
curl -X POST "<YOUR_VERCEL_URL>/api/test-post" \
  -H "Content-Type: application/json" \
  -d '{"test": "message", "timestamp": "'$(date -Iseconds)'"}'
```

## 🔍 Debugging Guide

### Common Issues & Solutions

#### 1. "Webhook not receiving messages"
- ✅ Check webhook URL is correct
- ✅ Verify bot token is valid
- ✅ Ensure HTTPS (Vercel provides this automatically)
- ✅ Check Vercel function logs for errors

#### 2. "Environment variables not found"
- ✅ Set environment variables in Vercel dashboard
- ✅ Redeploy after adding environment variables
- ✅ Use exact variable names: `TELEGRAM_BOT_TOKEN`, `AUTHORIZED_USER_ID`, `MONGODB_URI`

#### 3. "Bot responds but doesn't save data"
- ✅ Check MongoDB connection string
- ✅ Verify database permissions
- ✅ Check Vercel function logs for database errors

#### 4. "Unauthorized access" message
- ✅ Verify `AUTHORIZED_USER_ID` matches your Telegram user ID
- ✅ Get your user ID by messaging @userinfobot on Telegram

### Log Analysis

When you send a message, you should see logs like:
```
Creating new TelegramBot instance...
Setting up bot handlers...
Processing Telegram update...
```

If you see errors, they'll help identify the issue:
- `Configuration error` = Missing environment variables
- `Cannot connect to MongoDB` = Database connection issue
- `processUpdate failed` = Bot logic error

## 🧪 Test Commands

### Quick API Health Check
```bash
curl "<YOUR_VERCEL_URL>/api/test"
```

### Simulate Webhook Message
```bash
curl -X POST "<YOUR_VERCEL_URL>/api/bot" \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "message_id": 1,
      "from": {"id": YOUR_USER_ID, "first_name": "Test"},
      "chat": {"id": YOUR_USER_ID, "type": "private"},
      "date": '$(date +%s)',
      "text": "Worked 6 hours today"
    }
  }'
```

## ✅ Success Indicators

Your bot is working correctly when:

1. **Webhook responds**: API returns 200 status
2. **Bot processes message**: Logs show message processing
3. **Database saves entry**: Work hours are logged
4. **Bot replies**: You receive confirmation message
5. **Commands work**: `/help`, `/summary` respond correctly

## 🆘 Need Help?

If you're still having issues:

1. **Check Vercel logs** for specific error messages
2. **Verify environment variables** are set correctly
3. **Test individual components** using the test scripts
4. **Check Telegram webhook status** with getWebhookInfo
5. **Ensure bot token is valid** by calling getMe API

## 📱 Final Test

Send this message to your bot: `"Worked 8 hours today"`

Expected response: `"✅ Logged 8 hours for today."`

If you get this response, your API connection is working perfectly! 🎉