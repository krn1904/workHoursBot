# Telegram Work Hours Logger Bot

A personal Telegram bot for tracking daily work hours with natural-language messages. It stores entries in MongoDB, exposes a lightweight command set for summaries, and supports automated reminders.

## Quick Start
1. **Create a bot** with [@BotFather](https://t.me/botfather); copy the token.
2. **Fetch your user ID** from [@userinfobot](https://t.me/userinfobot).
3. **Provision MongoDB** (Atlas or local) and grab the connection URL.
4. **Set environment variables** (see below) and deploy to Vercel/Railway/Render.
5. **Set Telegram webhook** to `https://<your-domain>/api/bot`.
6. DM the bot: `Worked 6 hours today`.

## Commands
| Command | Summary |
|---------|---------|
| `/summary` | Weekly + monthly totals with weekday/weekend/holiday breakdowns and pay estimates (if configured). |
| `/today` | Today’s entries with per-entry details and pay breakdown. |
| `/log` | Latest 5 entries (holiday entries flagged). |
| `/category [tag]` | Lists all tags when omitted; totals for a specific tag when provided. |
| `/paycycle` | Current pay-cycle hours + detailed entry list (capped at 50). |
| `/help` | Cheat sheet plus configured pay rates. |
| `/stats`, `/validate`, `/reset confirm`, `/backup` | Admin utilities. |
| `/delete …` | Preview/delete the last N entries with confirmation. |

## Environment Variables
```
# Required
TELEGRAM_BOT_TOKEN=...
AUTHORIZED_USER_ID=...
MONGODB_URI=...

# Optional (examples)
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
```
- Leave all pay vars unset to hide earnings in responses.
- Holiday rates trigger when a log message includes any tag listed in `PAY_RATE_HOLIDAY_TAGS` (e.g. “Worked 8 hours on holiday”).
- Reminder timezone is hard-coded in `src/bot/services/reminder.js` (`DEFAULT_TIMEZONE` = Australia/Melbourne).

## Deployment Notes
- **Vercel flow:** push repo → set env vars → deploy → `curl https://api.telegram.org/bot<token>/setWebhook -d '{"url":"https://<domain>/api/bot"}'`.
- **GitHub Actions reminders:** `daily-reminder.yml` hits `/api/reminder` four times per day; only one run sends the reminder using deterministic slot selection.
- **Local dev:** `npm install && node bot.js` (polling mode). Reminders require a long-running process or manual `/api/reminder` call.

## Data Model & Layout
- Mongo collection `work_entries` stores `{ date, hours, tag, raw_message, timestamp }` plus indexes on `date`, `tag`, and `timestamp`.
- Key directories:
  - `api/` → Vercel handlers (`bot.js`, `reminder.js`).
  - `src/bot/handlers/` → `commands.js`, `messageParser.js`.
  - `src/bot/services/` → `database.js`, `reminder.js`.

## Troubleshooting
- **Bot silent?** re-run `getWebhookInfo`, confirm domain and HTTPS.
- **No reminders?** check GitHub Actions logs and `REMINDER_SECRET` header; ensure run time falls inside 3–11 PM window in `DEFAULT_TIMEZONE`.
- **Holiday pay missing?** confirm message tag matches `PAY_RATE_HOLIDAY_TAGS` and rates are non-zero.
- **Category list empty?** log entries with a trailing keyword (e.g. “on clientX”); `/category` without args will enumerate them.

Refer to the technical and API quick references for deeper details.
