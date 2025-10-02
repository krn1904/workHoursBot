# Database Reset Guide

Use this when you want a clean slate. Reset deletes every document in `work_entries`, but the bot automatically exports a backup first.

## Before You Reset
- Run `/stats` to review totals.
- If you need an extra copy, run `/backup` or export data manually.
- Remember: only the authorised user can trigger reset.

## Reset Flow (commands)
1. `/reset` → shows warning + current stats.
2. `/reset confirm` → creates backup, deletes all entries, reports summary.

Example transcript:
```
/stats
/reset
/reset confirm
```

After success you’ll see: “✅ Database Reset Complete … 📝 Start logging: ‘Worked 6 hours today’”.

## What Reset Affects
- ✅ Work entries in MongoDB.
- ❌ Bot token / user authorisation / pay-rate config / pay-cycle start date (unchanged).

If you reset by mistake, grab the backup payload from logs and re-import via a script using `database.logWorkEntry(...)`.
