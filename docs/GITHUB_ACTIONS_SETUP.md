# GitHub Actions Daily Reminder Setup Guide

This guide helps you set up automatic daily reminders using GitHub Actions, which will work perfectly with your serverless deployment.

## 🎯 How It Works

1. **GitHub Actions runs on schedule** (4 times daily between 3PM-11PM Australian time)
2. **Daily slot selection** picks exactly one of the four windows per day (feels random, guaranteed delivery)
3. **Calls your bot's API** to trigger the reminder
4. **Sends Telegram message** using your existing reminder system

## 🇦🇺 Australian Timezone Support

The system is configured for **Australian Eastern Standard Time (AEST)** by default:
- Reminders arrive at 3:00 PM, 5:30 PM, 7:45 PM, and 9:15 PM AEST
- GitHub Actions runs at corresponding UTC times (5:00 AM, 7:30 AM, 9:45 AM, 11:15 AM UTC)
- Supports other Australian timezones (see customization section)

## 🔧 Setup Steps

### 1. Configure GitHub Secrets

In your GitHub repository, go to **Settings** → **Secrets and variables** → **Actions** and add these secrets:

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `BOT_WEBHOOK_URL` | `https://your-app.vercel.app` | Your bot's deployment URL |
| `AUTHORIZED_USER_ID` | `123456789` | Your Telegram user ID |
| `REMINDER_SECRET` | `your-random-secret-key` | Random string for security |
| `REMINDER_RANDOM_SEED` (optional) | `any string` | Overrides daily slot rotation seed |

### 2. Add Environment Variable to Your Deployment

Add this environment variable to your hosting platform (Vercel/Railway/etc.):

```
REMINDER_SECRET=your-random-secret-key
```

**Important**: Use the same `REMINDER_SECRET` value in both GitHub and your deployment.

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

The workflow runs **4 times daily** on every day of the week in Australian timezone:
- **3:00 PM AEST** (afternoon check-in)
- **5:30 PM AEST** (end of workday) 
- **7:45 PM AEST** (evening wrap-up)
- **9:15 PM AEST** (final reminder)

> ℹ️ By default the bot treats all reminder scheduling as `Australia/Melbourne`. Update `DEFAULT_TIMEZONE` in `src/bot/services/reminder.js` if you deploy in another region.

Exactly one run per day will send a reminder (selected via a deterministic hash of the day and your seed), so delivery time rotates while still feeling random.

## 🔒 Security Features

- **Bearer token authentication** prevents unauthorized access
- **User ID validation** ensures only you receive reminders
- **HTTPS-only communication** with your bot
- **No sensitive data in logs** - tokens are hidden

## 🌍 Timezone Considerations

The schedule uses **Australian Eastern Standard Time (AEST)** by default.

### **Current Configuration (AEST - Sydney/Melbourne):**
| Australian Time | UTC Time | GitHub Actions Cron |
|----------------|----------|-------------------|
| 3:00 PM AEST | 5:00 AM UTC | `0 5 * * 0-6` |
| 5:30 PM AEST | 7:30 AM UTC | `30 7 * * 0-6` |
| 7:45 PM AEST | 9:45 AM UTC | `45 9 * * 0-6` |
| 9:15 PM AEST | 11:15 AM UTC | `15 11 * * 0-6` |

### **Other Australian Timezones:**

**Adelaide/Darwin (ACST - UTC+9.5):**
```yaml
- cron: '30 5 * * 0-6'   # 3:00 PM ACST
- cron: '0 8 * * 0-6'    # 5:30 PM ACST  
- cron: '15 10 * * 0-6'  # 7:45 PM ACST
- cron: '45 11 * * 0-6'  # 9:15 PM ACST
```

**Perth (AWST - UTC+8):**
```yaml
- cron: '0 7 * * 0-6'    # 3:00 PM AWST
- cron: '30 9 * * 0-6'   # 5:30 PM AWST
- cron: '45 11 * * 0-6'  # 7:45 PM AWST
- cron: '15 13 * * 0-6'  # 9:15 PM AWST
```

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

### Change Australian Timezone
Edit the cron schedules in `.github/workflows/daily-reminder.yml` (and update `DEFAULT_TIMEZONE` in `src/bot/services/reminder.js` if you want a different base timezone) based on your location:

**For Adelaide (ACST):**
```yaml
# Replace the existing schedule section with:
schedule:
  - cron: '30 5 * * 0-6'   # 3:00 PM ACST
  - cron: '0 8 * * 0-6'    # 5:30 PM ACST
  - cron: '15 10 * * 0-6'  # 7:45 PM ACST
  - cron: '45 11 * * 0-6'  # 9:15 PM ACST
```

**For Perth (AWST):**
```yaml
# Replace the existing schedule section with:
schedule:
  - cron: '0 7 * * 0-6'    # 3:00 PM AWST
  - cron: '30 9 * * 0-6'   # 5:30 PM AWST
  - cron: '45 11 * * 0-6'  # 7:45 PM AWST
  - cron: '15 13 * * 0-6'  # 9:15 PM AWST
```

### Change Reminder Frequency
Edit the cron schedules in `.github/workflows/daily-reminder.yml`:
```yaml
# More frequent (every 2 hours)
- cron: '0 5,7,9,11,13 * * 0-6'

# Less frequent (once daily)
- cron: '0 7 * * 0-6'  # 5:30 PM AEST only
```

### Weekday-Only Reminders
If you want to exclude weekends, change `0-6` to `1-5` in your cron expressions and set `activeDays` to weekdays only in `src/bot/services/reminder.js`.

## ✅ Success Indicators

You'll know it's working when:
- GitHub Actions runs show "✅ Reminder sent successfully"
- You receive random Telegram reminders between 3PM-11PM Australian time
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
