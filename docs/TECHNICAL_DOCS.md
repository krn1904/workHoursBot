# Technical Overview

A quick-map for engineers working on the Telegram Work Hours Logger Bot.

## 1. Architecture Snapshot
- **Entry point:** Telegram → Vercel `/api/bot` webhook → serverless handler.
- **Core runtime:** Stateless Node.js functions; MongoDB Atlas (or compatible) for persistence.
- **Reminder path:** GitHub Actions (or any cron) POSTs to `/api/reminder`, which triggers the same bot stack.

```
Telegram ──▶ api/bot (webhook)
             │
             ├─► messageParser → commands
             │                └─► MongoDB (work_entries)
             └─► api/reminder (cron-triggered)
```

## 2. Module Reference
| Layer | Key Files | Responsibility |
|-------|-----------|----------------|
| Webhook | `api/bot.js` | Validate env, route Telegram updates, reuse bot instance. |
| Reminder API | `api/reminder.js` | Authenticated endpoint used by GitHub Actions; honours reminder window & force mode. |
| Bot setup | `src/bot/bot.js` | Connect MongoDB, wire parser + commands, optionally bootstrap reminders. |
| Commands | `src/bot/handlers/commands.js` | Handle `/summary`, `/today`, `/log`, `/category`, `/paycycle`, admin actions, pay estimates & holiday handling. |
| Parser | `src/bot/handlers/messageParser.js` | Extract hours, normalize dates, infer tags, basic validation. |
| Database | `src/bot/services/database.js` | Mongo connection pooling, CRUD helpers, stats & validation utilities. |
| Reminder engine | `src/bot/services/reminder.js` | Schedules random-time reminders (3–11 PM in `DEFAULT_TIMEZONE`), supports holiday-aware pay output when triggered. |

## 3. Data Model (`work_entries`)
```json
{
  "_id": ObjectId,
  "date": "YYYY-MM-DD",
  "hours": Number,
  "tag": "lowercase tag or null",
  "raw_message": "original Telegram text",
  "timestamp": ISODate
}
```
**Indexes:** `{date:1}`, `{tag:1}`, `{timestamp:-1}`, optional `{date:1, tag:1}` for pay-cycle/category lookups.

## 4. Runtime Flow Highlights
1. **Webhook message** → authorize user → command or work-log branch.
2. **Work logs** → parser normalises (`today`, `yesterday`, specific dates) → `database.logWorkEntry` → confirmation reply.
3. **Commands** reuse shared helpers:
   - `/summary` & `/paycycle` aggregate hours + pay breakdown (weekday/weekend/holiday).
   - `/category` without args lists available tags; with a tag returns totals.
4. **Holiday pay**: any entry whose tag matches `PAY_RATE_HOLIDAY_TAGS` uses the holiday rate in calculations and is flagged in responses.
5. **Reminders**: serverless helper refuses to run inside webhook window; GitHub Actions hits `/api/reminder` 4× daily, deterministic slot chooses one send.

## 5. Configuration Cheat Sheet
### Required
```
TELEGRAM_BOT_TOKEN
AUTHORIZED_USER_ID
MONGODB_URI
```

### Optional highlights
```
PAY_RATE, PAY_RATE_WEEKDAY/SATURDAY/SUNDAY
PAY_RATE_WEEKEND (fallback for Sat/Sun)
PAY_RATE_HOLIDAY
PAY_RATE_HOLIDAY_TAGS=holiday,public_holiday,public holiday
PAY_RATE_HOLIDAY_MESSAGE="Public Holiday"
PAY_RATE_CURRENCY / PAY_RATE_LOCALE / PAY_RATE_SYMBOL
DATE_FORMAT_PREFERENCE (DMY or MDY; defaults to DMY for DD/MM/YYYY)
REMINDER_SECRET (shared with GitHub Actions)
DEFAULT_TIMEZONE (set in reminder service; defaults to Australia/Melbourne)
```
When no pay rates are provided, summaries omit the earnings sections.

## 6. Deployment Notes
- **Primary target:** Vercel (serverless). Also tested on Railway/Render/Fly.
- **GitHub Actions:** `daily-reminder.yml` runs 4 cron slots (0–6 weekdays+weekend) and calls `/api/reminder` with the correct headers.
- **Local dev:** run `node bot.js` (polling mode). Reminders rely on long-running process; for production use cron + `/api/reminder`.

## 7. Operations & Testing
- **Security:** single-user authorization via `AUTHORIZED_USER_ID`. All secrets live in env vars; bot token must never hit logs.
- **Logging:** use host platform logs (`console.log`). Reminder endpoint logs send decisions (`Within window`, `Outside window`).
- **Testing:** manual Telegram checks remain primary; parser/command helpers follow unit-testable boundaries (`messageParser`, `database`).
- **Monitoring:** MongoDB Atlas metrics + hosting platform logs cover most telemetry needs.

## 8. Quick Troubleshooting
- **Unexpected 401** → confirm `AUTHORIZED_USER_ID` and bearer token (`REMINDER_SECRET`).
- **No reminders** → check GitHub Actions logs; ensure send slot matched current run and env includes `PAY_RATE*`/timezone as expected.
- **Date logging off** → retest parser with `12-15`, `15-12`, `12/15`, ISO formats; adjust `_parseSpecificDate` if needed.

This summary is intentionally concise—use the in-code comments and API docs for deeper detail.