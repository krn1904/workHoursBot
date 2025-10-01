# WorkHours Bot TODO

This file tracks requested features, verifications, and concrete action items.

## Features & Tasks

- Delete Entries: Implement safe deletion of recent entries (limit 5–10).
- Date-Based Logging: Verify and fix any issues parsing non-today dates.
- Paycycle Details: Completed — Consolidate summary and detailed logs into `/paycycle`.
- Off-Today Logging Logic: Verify and fix logic when adding work for dates other than today.

## Details, Findings, and Action Items

- Delete Entries (limit to last 5 or 10)
  - Findings: No delete API/command exists yet.
  - Action:
    - Add DB method `deleteLastEntries(limit = 5)` that removes most recent N entries by `timestamp` and returns deleted items (id, date, hours, tag, timestamp).
    - Add command `/delete [n]` (defaults to 5, cap at 10). Show a preview and require explicit confirmation: `/delete confirm [n]`.
    - Update `/help` with usage and safeguards (only last N, confirmation required).


- Paycycle log details (full listing for the cycle)
  - Status: Completed — `/paycycle` now returns the pay cycle summary and a detailed entry list in one response (newest first, capped at 50 with truncation note).
  - Compatibility: `/paycycle detail` and `/paycyclelog` continue to work as aliases but return the same consolidated output.

- Verify logic for adding work other than today
  - Findings:
    - Logging path uses `parsed.date` correctly (`api/bot.js:handleWorkLogMessage`). Confirmation message displays "today" when appropriate.
    - Command handler import bug likely breaks several commands in serverless handler:
      - In `api/bot.js:handleCommand` it requires `../messageParser` and `../commands`, but the actual paths are `../src/bot/handlers/messageParser` and `../src/bot/handlers/commands`.
  - Action:
    - Fix the require paths in `api/bot.js:handleCommand` to the correct handler files.
    - After fixing, re-verify `/paycycle`, `/summary`, `/log`, etc.

## Proposed Implementation Plan

- DB Layer
  - Add `deleteLastEntries(limit)` and unit/integration check via manual call.

- Bot Commands
  - Add `/delete [n]` with confirmation flow and cap to 10.
- Consolidate `/paycycle` to include detailed listing alongside the summary. Completed.
  - Update `/help` text accordingly.

- Parser Fixes
  - Fix separator handling in `_parseSpecificDate` for dash-only dates.
  - Add coverage/tests or manual examples for: `12-15`, `15-12`, `12/15`, `15/12`, ISO.

- Serverless Handler Fix
  - Correct import paths in `api/bot.js:handleCommand` to point to `src/bot/handlers`.

## Acceptance Criteria

- Deletion: `/delete` shows a preview, requires `/delete confirm`, and only deletes up to 10 recent entries. Returns count and a brief list of deleted entries.
- Date Logging: Messages like "Worked 5h on 12-15" and "Worked 3.5h on 15-12" log to the correct current-year dates. ISO and slash-formats continue to work.
- Paycycle Details: `/paycycle` lists cycle totals and detailed entries, limits output sensibly, notes truncation, and formats hours consistently.
- Commands: `/summary`, `/log`, `/paycycle`, `/category`, `/today` all function correctly in serverless due to fixed imports.

## Daily Reminder Delivery (Not Receiving Telegram Messages)

- Findings:
  - Internal scheduler is disabled in serverless (Vercel) by design: `DailyReminder.start()` exits early when serverless is detected. Delivery must be via the `api/reminder` endpoint triggered by an external cron (e.g., GitHub Actions).
  - You reported the workflow runs daily multiple times, but no Telegram messages arrive.
  - Potential causes:
    - Missing/incorrect `TELEGRAM_BOT_TOKEN` or `AUTHORIZED_USER_ID` in deployment environment.
    - `REMINDER_SECRET` set in Vercel but GitHub Actions request missing or mismatching Bearer token.
    - GitHub Action not using `POST` with `Content-Type: application/json` and body `{ "action": "send_daily" }` to the correct URL (`/api/reminder`).
    - Telegram blocked the bot from messaging due to not starting chat: ensure the authorized user has initiated a chat with the bot at least once.
    - Network egress or rate limiting issues; add logging to confirm `sendMessage` result/response code.
- Action:
  - Verify Vercel env vars: `TELEGRAM_BOT_TOKEN`, `AUTHORIZED_USER_ID`, and (if used) `REMINDER_SECRET`.
  - Confirm GitHub Actions curl step posts to `https://<vercel-app>/api/reminder` with headers:
    - `Authorization: Bearer ${{ secrets.REMINDER_SECRET }}` (only if configured)
    - `Content-Type: application/json`
    - Body: `{ "action": "send_daily", "source": "github_actions_production" }`
  - Add enhanced logging in `api/reminder.js` around request validation and Telegram send outcome.
  - Optionally add a `/reminder test` command to trigger a one-off reminder via the API to validate delivery.
  - If desired, add a lightweight GET health endpoint that returns whether env vars are configured for reminders.
