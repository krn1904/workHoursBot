# GitHub Actions Daily Reminder Setup Guide

This guide helps you set up automatic daily reminders using GitHub Actions, which will work perfectly with your serverless deployment.

## 🎯 How It Works

1. **GitHub Actions runs on schedule** (4 times daily between 3PM-11PM UTC)
2. **Random selection** ensures only 1 reminder per day on average
3. **Calls your bot's API** to trigger the reminder
4. **Sends Telegram message** using your existing reminder system

## 🔧 Setup Steps

### 1. Configure GitHub Secrets

In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions** and add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `BOT_WEBHOOK_URL` | `https://your-app.vercel.app` | Your bot's deployment URL |
| `AUTHORIZED_USER_ID` | `123456789` | Your Telegram user ID |
| `REMINDER_SECRET` | `your-random-secret-key` | Random string for security |

### 2. Add Environment Variable to Your Deployment

Add this environment variable to your hosting platform (Vercel/Railway/etc.):

```
REMINDER_SECRET=your-random-secret-key
```

**Important**: Use the same secret value in both GitHub and your deployment.

### 3. Enable GitHub Actions

1. Go to your repository's **Actions** tab
2. If disabled, click **"I understand my workflows, go ahead and enable them"**
3. The workflow will automatically start running

### 4. Test the Setup

#### Manual Test:
1. Go to **Actions** tab in your GitHub repo
2. Click **"Daily Work Hours Reminder"**
3. Click **"Run workflow"** → **"Run workflow"**
4. Check if you receive a test reminder

#### API Test:
```bash
curl -X POST "https://your-app.vercel.app/api/reminder" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-random-secret-key" \
  -d '{
    "action": "send_daily",
    "user_id": "123456789",
    "source": "manual_test"
  }'
```

## ⏰ Schedule Details

The workflow runs **4 times daily** on weekdays:
- 3:00 PM UTC (15:00)
- 5:30 PM UTC (17:30)
- 7:45 PM UTC (19:45)
- 9:15 PM UTC (21:15)

Each run has a **25% chance** of sending a reminder, ensuring you get approximately **1 reminder per day** at a random time.

## 🔒 Security Features

- **Bearer token authentication** prevents unauthorized access
- **User ID validation** ensures only you receive reminders
- **HTTPS-only communication** with your bot
- **No sensitive data in logs** - tokens are hidden

## 🌍 Timezone Considerations

The schedule uses **UTC time**. Convert to your local timezone:

| Your Timezone | Reminder Window |
|---------------|-----------------|
| **EST/EDT** (UTC-5/-4) | 10:00 AM - 6:00 PM |
| **PST/PDT** (UTC-8/-7) | 7:00 AM - 3:00 PM |
| **GMT** (UTC+0) | 3:00 PM - 11:00 PM |
| **CET/CEST** (UTC+1/+2) | 4:00 PM - 12:00 AM |

To adjust for your timezone, modify the cron schedules in `.github/workflows/daily-reminder.yml`.

## 🐛 Troubleshooting

### No Reminders Received
1. **Check GitHub Actions logs**:
   - Go to Actions tab → Daily Work Hours Reminder
   - Click on latest run to see logs
   
2. **Verify secrets are set**:
   - Settings → Secrets and variables → Actions
   - Ensure all 3 secrets are present

3. **Test API endpoint**:
   ```bash
   curl "https://your-app.vercel.app/api/reminder" \
     -X POST \
     -H "Authorization: Bearer your-secret"
   ```

### Authentication Errors
- Ensure `REMINDER_SECRET` matches in both GitHub and deployment
- Check that the secret doesn't have extra spaces or characters

### Wrong User Receiving Reminders
- Verify `AUTHORIZED_USER_ID` is your correct Telegram user ID
- Get your ID from @userinfobot on Telegram

## 🎛️ Customization

### Change Reminder Frequency
Edit the cron schedules in `.github/workflows/daily-reminder.yml`:
```yaml
# More frequent (every 2 hours)
- cron: '0 15,17,19,21,23 * * 1-5'

# Less frequent (once daily)
- cron: '0 18 * * 1-5'  # 6 PM UTC only
```

### Include Weekends
Change `1-5` to `0-6` in cron schedules:
```yaml
- cron: '0 15 * * 0-6'  # Include Sunday (0) and Saturday (6)
```

### Different Timezone
Adjust hours in cron schedules:
```yaml
# For PST (UTC-8), subtract 8 hours
- cron: '0 7 * * 1-5'   # 7 AM UTC = 11 PM PST (previous day)
- cron: '30 9 * * 1-5'  # 9:30 AM UTC = 1:30 AM PST
```

## ✅ Success Indicators

You'll know it's working when:
- GitHub Actions runs show "✅ Reminder sent successfully"
- You receive random Telegram reminders between your scheduled hours
- The bot checks if you've already logged hours (smart skip feature)
- Reminders have variety in messages and timing

## 🔄 Alternative Solutions

If GitHub Actions doesn't work for you:

1. **Cron-job.org** (free external cron service)
2. **Zapier** (automation platform)
3. **IFTTT** (simple automation)
4. **Google Cloud Scheduler** (paid service)
5. **AWS EventBridge** (paid service)

All these can call your `/api/reminder` endpoint with the same authentication.