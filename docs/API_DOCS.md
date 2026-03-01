# API Quick Reference

This document summarizes the callable surfaces exposed by the Work Hours Logger.

## 1. HTTP Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/bot` | POST | Telegram webhook token | Primary webhook handler. Accepts Telegram updates and returns an inline response payload. |
| `/api/reminder` | POST | `Authorization: Bearer <REMINDER_SECRET>` | Trigger the daily reminder flow (used by GitHub Actions/cron). |

### `/api/bot`
- Accepts raw Telegram update JSON.
- Rejects non-authorised `user_id`.
- Dispatches either to command handling (`/summary`, `/today`, etc.) or to work-log parsing.
- Always returns a JSON body describing the action (usually `sendMessage`).

Example minimal request:
```json
{
  "update_id": 123,
  "message": {
    "chat": { "id": 999 },
    "from": { "id": 111 },
    "text": "/summary"
  }
}
```

Example response body:
```json
{
  "method": "sendMessage",
  "chat_id": 999,
  "text": "📊 *Work Summary*...",
  "parse_mode": "Markdown"
}
```

### `/api/reminder`
- Body: `{ "action": "send_daily", "user_id": "<AUTHORIZED_USER_ID>", "source": "github_actions_production" }`
- Optional `source` values: `github_actions_production`, `github_actions_test`, `manual_test`.
- If `forceReminder` behaviour is desired use a `source` ending with `_test`.
- Runs the same reminder engine used by the bot: honours time-window (3–11 PM in configured timezone), holiday-aware pay outputs, and Telegram delivery logging.

---

## 2. Command Summary

| Command | Description |
|---------|-------------|
| `/summary` | Weekly + monthly totals with weekday/weekend/holiday breakdowns and optional pay estimates. |
| `/today` | Today’s entries with per-tag details and pay summary. |
| `/log` | Latest 5 entries (holiday entries flagged). |
| `/category [tag]` | Without a tag, lists available tags. With a tag, returns totals for that category. |
| `/paycycle [tag]` | Current pay-cycle hours and detailed entry list (capped 50). Works standalone or with optional tag parameter to filter entries. |
| `/paycycles [tag]` | Last 5 pay cycles summary with totals, breakdowns, and pay estimates. Works standalone or with optional tag parameter to filter all cycles. |
| `/help` | Overview of commands plus configured pay rates. |
| `/stats` | Database totals + tag count. |
| `/validate` | Runs database integrity checks. |
| `/reset confirm` | Clears the database (backup first). |
| `/backup` | Generates in-memory backup snapshot. |
| `/reminder` | Manual reminder info/test helper (no DB required). |

All responses are Markdown-formatted and include emojis for clarity. Pay breakdown sections only appear when at least one `PAY_RATE*` environment variable is non-zero.

**Tag Filtering for Pay Cycles**: Both `/paycycle` and `/paycycles` **work standalone without any parameters** and support optional tag filtering:
- `/paycycle` - Shows all entries in current pay cycle (default usage)
- `/paycycle project1` - Shows only entries tagged with "project1" in current cycle
- `/paycycles` - Shows last 5 pay cycles with all entries (default usage)
- `/paycycles freelance` - Shows last 5 pay cycles filtered to "freelance" tag only
- Tag parameter is completely optional - commands function perfectly without it
- Filtering uses case-insensitive partial matching (e.g., "proj" matches "project1", "project2")
- Displays match count vs total entries when filtering is active

---

## 3. Message Parsing Contract

`MessageParser.parseMessage(text)` returns:
```json
{
  "hours": Number|null,
  "date": "YYYY-MM-DD" (defaults to today),
  "tag": "string|null",
  "isValidWorkLog": Boolean
}
```
- Dates recognised: ISO (`2025-01-15`), slash/dash (`12/15`, `15-12`), keywords (`today`, `yesterday`).
- Tags: lowest-case tokens extracted from trailing words (configurable via `PAY_RATE_HOLIDAY_TAGS` for holiday detection).

**Holiday pay**: Activated when `tag` matches any configured holiday tag. Examples:
- `"Worked 8 hours on holiday"` → Tag: `holiday` → Uses holiday pay rate
- `"7.5 hours on public holiday"` → Tag: `public holiday` → Uses holiday pay rate
- `"6 hrs on public_holiday"` → Tag: `public_holiday` → Uses holiday pay rate

Holiday entries are flagged in command output (🎉 Public Holiday) and use the holiday rate in pay calculations.

---

## 4. Data & Stats Helpers

`Database` exposes:
- `logWorkEntry(date, hours, tag, rawMessage)`
- `getEntriesBetween(startDate, endDate)`
- `getTodayEntries(date)`
- `getLastEntries(limit)`
- `getCategoryTotal(tag)`
- `getDatabaseStats()`
- `deleteLastEntries(limit)` (used by `/delete`)
- `deleteEntriesByIds(ids)`
- `validateAndRepairDatabase()`

Entries live in the `work_entries` collection (see Technical Docs for schema/index details).

---

## 5. Reminder Engine Notes

- `sendScheduledReminder(bot, userId, database, forceReminder=false)` enforces time window (15:00–23:00 in `DEFAULT_TIMEZONE`).
- Reminder messages respect pay configuration and holiday labelling, mirroring `/summary`.
- GitHub Actions chooses one of four daily slots deterministically; manual/test triggers bypass randomness when required.

---

## 6. Error Handling & Auth

- All HTTP endpoints return `401` on missing/invalid tokens or user IDs.
- Telegram responses surface user-friendly messages; server logs keep stack traces.
- Unknown commands reply with an error and a pointer to `/help`.

---

## 7. Quick Troubleshooting

| Issue | Check |
|-------|-------|
| No webhook responses | Confirm Telegram webhook is set to `/api/bot` production URL. |
| Reminder not firing | Inspect GitHub Actions logs; ensure `REMINDER_SECRET`, `PAY_RATE*`, and timezone constants are set. |
| Category empty | Use `/category` without args to confirm tags exist; ensure logs include a tag keyword. |
| Holiday pay missing | Verify message tag matches `PAY_RATE_HOLIDAY_TAGS` and `PAY_RATE_HOLIDAY` is non-zero. |

This concise reference complements the in-code documentation. EOF
