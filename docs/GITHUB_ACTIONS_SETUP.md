# GitHub Actions Reminder Guide

Configure the provided workflow (`.github/workflows/daily-reminder.yml`) to trigger your Telegram reminder once per day.

## 1. Prerequisites
- Deployed bot with `/api/reminder` reachable over HTTPS.
- `REMINDER_SECRET` configured on the hosting platform.
- GitHub repository containing this workflow.

### Required GitHub secrets
| Secret | Example | Purpose |
|--------|---------|---------|
| `BOT_WEBHOOK_URL` | `https://your-app.vercel.app` | Base URL for the deployed bot. |
| `AUTHORIZED_USER_ID` | `123456789` | The same Telegram ID used by the bot. |
| `REMINDER_SECRET` | `super-secret` | Bearer token used by `/api/reminder`. |
| `REMINDER_RANDOM_SEED` (optional) | `my-seed` | Influences which cron slot sends the reminder each day. |

Ensure the hosting platform also exposes `REMINDER_SECRET` (value must match the secret above).

## 2. How the Workflow Runs
1. Four cron jobs fire daily (5:00, 7:30, 9:45, 11:15 UTC).
2. The workflow hashes (`REMINDER_RANDOM_SEED` + day-of-year) to pick one slot; only that run calls `/api/reminder`.
3. Test/ manual runs skip the gate and always send a reminder.
4. The reminder engine checks the local window (3–11 PM in `DEFAULT_TIMEZONE`).

## 3. Setup Steps
1. **Add GitHub secrets** listed above.
2. **Mirror `REMINDER_SECRET`** in your deployment environment.
3. **Enable Actions** (repository → Actions → enable if disabled).
4. **Manual test:** run the workflow via GitHub; expect a ✅ log and Telegram notification.

## 4. Cron Reference
| Local (AEST) | UTC | Cron expression |
|--------------|-----|----------------|
| 3:00 PM | 5:00 AM | `0 5 * * 0-6` |
| 5:30 PM | 7:30 AM | `30 7 * * 0-6` |
| 7:45 PM | 9:45 AM | `45 9 * * 0-6` |
| 9:15 PM | 11:15 AM | `15 11 * * 0-6` |

- To exclude weekends, change `0-6` to `1-5` in all expressions and limit `activeDays` in `src/bot/services/reminder.js`.
- Adjust times for other regions by editing the cron expressions and updating `DEFAULT_TIMEZONE`.

## 5. Customisation Tips
- **Frequency**: add/remove cron lines in the workflow as needed (`0 5,7,9,11 * * 0-6` for every ~2 hrs, for example).
- **Holiday messaging**: reminders reuse the same holiday-aware pay output driven by `PAY_RATE_HOLIDAY*` variables.

## 6. Troubleshooting
| Symptom | Suggested check |
|---------|-----------------|
| Logs show “Not today’s slot” | Expected; only one of four runs sends per day. |
| 401 from `/api/reminder` | Confirm `REMINDER_SECRET` matches deployment and GitHub secret. |
| Reminder runs but Telegram silent | Check `/api/reminder` logs for window/holiday info; ensure timezone window covers runtime. |
| Actions not running | Verify Actions are enabled and cron expressions are committed to default branch. |
| Wrong user receives reminder | Confirm `AUTHORIZED_USER_ID` secret and deployment env match the intended Telegram ID. |

With secrets and cron configured, reminders will appear once per day without further maintenance.
