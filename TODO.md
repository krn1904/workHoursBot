# WorkHours Bot TODO

This file tracks requested features, verifications, and concrete action items.

## Features & Tasks

### Different pay rates per job/tag
- [ ] **Status:** Planned (not implemented). See `docs/PLAN_PER_JOB_PAY_RATES.md`
- [ ] MVP: `PAY_RATE_BY_TAG` env + per-entry rate resolution in pay summaries
- [ ] Polish: tag pay breakdown in `/summary` & `/paycycle`; show pay in `/category`
- [ ] Optional Phase 2: Mongo-backed `/setrate` / `/rates` commands (no redeploy to change rates)
