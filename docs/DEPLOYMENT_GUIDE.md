# Deployment Guide

Fast checklist for getting the Work Hours Logger live.

## 1. Prerequisites
- Telegram bot token (`@BotFather`).
- Your Telegram user ID (`@userinfobot`).
- MongoDB connection string (Atlas recommended).
- Hosting account (Vercel/Railway/Render/Fly).
- Optional: GitHub repository connected to enable Actions.

## 2. Environment Variables
Set the following on your hosting platform (and locally for testing):
```
TELEGRAM_BOT_TOKEN=
AUTHORIZED_USER_ID=
MONGODB_URI=
REMINDER_SECRET=

# Optional pay & locale settings
PAY_RATE=45.0
PAY_RATE_WEEKDAY=45.0
PAY_RATE_WEEKEND=60.0
PAY_RATE_SATURDAY=55.0
PAY_RATE_SUNDAY=65.0
PAY_RATE_HOLIDAY=80.0
PAY_RATE_HOLIDAY_TAGS=holiday,public_holiday,public holiday
PAY_RATE_HOLIDAY_MESSAGE=Public Holiday
PAY_RATE_CURRENCY=AUD
PAY_RATE_LOCALE=en-AU
PAY_RATE_SYMBOL=$

# Date format preference (optional)
DATE_FORMAT_PREFERENCE=DMY
# Options: DMY (DD/MM/YYYY, default) or MDY (MM/DD/YYYY)
```
**Holiday pay**: Activates when a log message includes any tag from `PAY_RATE_HOLIDAY_TAGS`. Examples:
- `"Worked 8 hours on holiday"` → Uses holiday pay rate
- `"7.5 hours on public holiday"` → Uses holiday pay rate
- `"6 hrs on public_holiday"` → Uses holiday pay rate

## 3. Recommended Flow (Vercel)
1. **Import repo** in Vercel and connect GitHub.
2. **Add env vars** above (Project → Settings → Environment Variables).
3. **Deploy**; Vercel builds serverless functions automatically.
4. **Set webhook** once deployment is live:
   ```bash
   curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -H 'Content-Type: application/json' \
     -d '{"url": "https://<your-domain>.vercel.app/api/bot"}'
   ```
5. (Optional) Update DNS/custom domain after verifying the default URL works.

## 4. Other Platforms (Quick Notes)
- **Railway** – create project → deploy from GitHub → add env vars → note generated domain → set webhook.
- **Render** – new Web Service (Node) → build `npm install`, start `npm start` → add env vars → deploy → set webhook.
- **Fly.io** – deploy Node app with secrets set via `fly secrets set`; ensure HTTPS and persistent process for polling mode if not using webhooks.

## 5. Reminders via GitHub Actions
- Workflow: `.github/workflows/daily-reminder.yml`.
- Secrets required: `BOT_WEBHOOK_URL`, `AUTHORIZED_USER_ID`, `REMINDER_SECRET`, optional `REMINDER_RANDOM_SEED`.
- Actions run four cron slots per day (`0 5/7/9/11 * * 0-6`); deterministic logic chooses one slot to send the reminder.
- Reminder endpoint checks the 3–11 PM window in `DEFAULT_TIMEZONE` (hard-coded to Australia/Melbourne—adjust in `src/bot/services/reminder.js` if needed).

## 6. Post-Deployment Tests
1. `curl https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo` → verify webhook points at production domain.
2. Send `Worked 6 hours today` in Telegram → expect “✅ Logged …” reply.
3. Run `/summary`, `/today`, `/category` (no tag) to confirm pay/holiday outputs.
4. Trigger GitHub Action manually to confirm `/api/reminder` works (look for ✅ log entry).

## 7. Troubleshooting
| Symptom | Quick Fix |
|---------|-----------|
| Webhook 404/timeout | Re-run `setWebhook` with correct HTTPS domain. |
| Unauthorized response | Confirm `AUTHORIZED_USER_ID` matches the account using the bot. |
| No reminders sent | Check Actions logs; ensure `REMINDER_SECRET` header matches deployment and run time is inside window. |
| Pay/holiday missing | Verify `PAY_RATE*` values and that log message contains a recognised tag. |
| Duplicate deployments | Disable polling mode locally; rely on webhooks in production. |

Deployment complete once all smoke tests pass. For deeper internals, see Technical Docs and API Quick Reference.
