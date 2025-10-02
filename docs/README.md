# Telegram Work Hours Logger Bot

Track daily work hours by chatting with your own Telegram bot. Messages are parsed, stored in MongoDB, surfaced in quick summary commands, and optionally translated into pay estimates (weekday/weekend/holiday). Scheduled reminders keep you logging on time.

## How It Works
- **Webhook**: Telegram sends updates to `/api/bot`; we authenticate the sender and route either to command handlers or work-log parsing.
- **Logging**: Natural language like “Worked 6 hours on design yesterday” becomes a normalised entry (`date`, `hours`, `tag`, `raw_message`, `timestamp`).
- **Summaries**: `/summary`, `/today`, `/paycycle`, etc. aggregate from MongoDB and return Markdown responses with pay breakdowns when configured.
- **Reminders**: GitHub Actions triggers `/api/reminder` four times daily (only one run sends); the reminder engine checks the 3–11 PM window in `DEFAULT_TIMEZONE`.
- **Tags & pay**: Any entry whose tag matches `PAY_RATE_HOLIDAY_TAGS` uses the holiday rate. `/category` without arguments shows all discovered tags so you can drill into one.

For deeper architecture context, see the [Technical Overview](TECHNICAL_DOCS.md).

## Quick Start
1. Create a bot with [@BotFather](https://t.me/botfather) and copy the token.
2. Get your Telegram user ID via [@userinfobot](https://t.me/userinfobot).
3. Provision MongoDB (Atlas recommended) and copy the connection string.
4. Set the environment variables (below) on your host.
5. Deploy (Vercel/Railway/Render/Fly or `node bot.js` locally).
6. Register the webhook: `curl https://api.telegram.org/bot<token>/setWebhook -d '{"url":"https://<domain>/api/bot"}'`.
7. DM the bot: `Worked 6 hours today` → expect a ✅ reply.

## Command Cheat Sheet
| Command | Description |
|---------|-------------|
| `/summary` | Weekly & monthly totals with weekday/weekend/holiday breakdowns and pay estimates (if rates configured). |
| `/today` | Today’s entries, time/tags per line, holiday marker, pay totals. |
| `/log` | Latest 5 entries (newest first). |
| `/category [tag]` | Lists all tags when omitted; totals and entry count when provided. |
| `/paycycle` | Current pay-cycle hours plus a detailed entry list (capped 50). |
| `/help` | Cheat sheet including configured pay rates. |
| `/delete …` | Preview/delete the most recent entries (confirmation required). |
| `/stats`, `/validate`, `/reset confirm`, `/backup`, `/reminder …` | Admin utilities. |

The [API Quick Reference](API_DOCS.md) describes each command’s response format.

## Configuration
```
# Required
TELEGRAM_BOT_TOKEN=...
AUTHORIZED_USER_ID=...
MONGODB_URI=...

# Optional pay/rate settings
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

# Reminder API authentication
REMINDER_SECRET=...
```
- Leave the pay variables unset or zero to hide earnings in outputs.
- Holiday pay activates when the message tag matches any value in `PAY_RATE_HOLIDAY_TAGS` (e.g. “Worked 8 hours on holiday”).
- `DEFAULT_TIMEZONE` inside `src/bot/services/reminder.js` defaults to Australia/Melbourne; change it (and cron schedules) if you deploy elsewhere.

## Reminders at a Glance
- Workflow: `.github/workflows/daily-reminder.yml` (four cron slots per day; deterministic slot selection).
- Secrets: `BOT_WEBHOOK_URL`, `AUTHORIZED_USER_ID`, `REMINDER_SECRET` (optional `REMINDER_RANDOM_SEED`).
- Endpoint: `POST /api/reminder` with `Authorization: Bearer <REMINDER_SECRET>`.
- See the [GitHub Actions Guide](GITHUB_ACTIONS_SETUP.md) for cron tuning and troubleshooting.

## Data & Project Layout
- Mongo collection `work_entries` with `{ date, hours, tag, raw_message, timestamp }` and indexes on `date`, `tag`, `timestamp`.
- Key folders:
  - `api/` → Webhook + reminder handlers.
  - `src/bot/handlers/` → `commands.js`, `messageParser.js`.
  - `src/bot/services/` → `database.js`, `reminder.js`.

## Troubleshooting
| Issue | Quick check |
|-------|-------------|
| Bot silent | `curl getWebhookInfo`; confirm HTTPS domain + `AUTHORIZED_USER_ID`. |
| Reminders missing | Inspect GitHub Actions logs; ensure run time is inside 3–11 PM in `DEFAULT_TIMEZONE` and `REMINDER_SECRET` matches. |
| Pay/holiday missing | Check `PAY_RATE*` env vars > 0 and log message contains a recognised tag. |
| `/category` empty | Log entries with `…on <tag>` then rerun `/category`. |

## Documentation Map
- [Technical Overview](TECHNICAL_DOCS.md) – architecture, modules, env vars.
- [API Quick Reference](API_DOCS.md) – endpoints & command formats.
- [Deployment Guide](DEPLOYMENT_GUIDE.md) – platform setup + cron secrets.
- [GitHub Actions Guide](GITHUB_ACTIONS_SETUP.md) – reminder workflow.
- [Testing Checklist](README-TESTING.md) – post-deployment smoke tests.
- [Reset Guide](RESET_GUIDE.md) – `/reset` flow and recovery.
