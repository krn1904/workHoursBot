# Testing Checklist

Use this guide after deployment to confirm the bot is wired correctly.

## 1. Smoke Tests
1. **Webhook status**
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/getWebhookInfo"
   ```
   Ensure `url` points to your production `/api/bot` endpoint and `last_error_date` is empty.
2. **Manual ping** – message the bot: `Worked 6 hours today` → expect a ✅ reply.
3. **Commands** – run `/summary`, `/today`, `/category` (no arg) to verify data + pay breakdown.
4. **Reminder dry run** – trigger the Actions workflow manually or `curl /api/reminder` with the correct `REMINDER_SECRET`; check logs for “Within reminder time window”.

## 2. Useful Commands
```bash
# Set webhook (one-off)
curl -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://<your-domain>/api/bot"}'

# Follow Vercel logs (requires Vercel CLI)
vercel logs <project> --follow

# Quick reminder test
date -u; curl -X POST "$BOT_WEBHOOK_URL/api/reminder" \
  -H "Authorization: Bearer $REMINDER_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"action":"send_daily","user_id":"'$AUTHORIZED_USER_ID'","source":"manual_test"}'
```

## 3. Troubleshooting Snapshot
| Symptom | Try this |
|---------|----------|
| No reply to `/help` | Confirm webhook URL and `AUTHORIZED_USER_ID`. |
| Logging works but hours missing | Check MongoDB connection string/permissions. |
| Reminders never send | Inspect GitHub Actions logs; verify runtime (3–11 PM in `DEFAULT_TIMEZONE`) and `REMINDER_SECRET`. |
| Holiday pay absent | Ensure log message includes a tag from `PAY_RATE_HOLIDAY_TAGS` and rates are non-zero. |
| Unauthorized response | `AUTHORIZED_USER_ID` mismatch—double check via @userinfobot. |

Keep these basics handy; deeper debugging lives in platform logs and the Technical/API references.
