# Plan: Different Pay Rates for Different Jobs

**Question:** Can I set different pay for different jobs?  
**Answer:** Not today. It is feasible and fits the existing tag (“job”) model with a focused change to pay calculation.

---

## Current state (main)

| Area | Behavior |
|------|----------|
| Jobs | Free-text **tags** on work entries (e.g. `freelance`, `clientb`) — no Job collection |
| Pay rates | Global env vars only: `PAY_RATE`, `PAY_RATE_WEEKDAY/SATURDAY/SUNDAY/WEEKEND/HOLIDAY` |
| Tag role | Filtering (`/paycycle freelance`, `/category`) and holiday detection (`PAY_RATE_HOLIDAY_TAGS`) |
| Pay math | Hours bucketed by day type → multiplied by **one** global rate per bucket |

Core logic lives in `src/bot/handlers/commands.js` (`PAY_RATES`, `calculateHoursByType`, `calculatePayTotals`).  
Schema in `src/bot/services/database.js` has `date`, `hours`, `tag` — no rate field.

Filtering by tag already shows earnings for one job, but still uses the **same** global rates.

---

## Goal

Allow each job/tag to use its own hourly rate (or rate set), while keeping:

- Existing global day-type rates as the default for untagged / unconfigured tags
- Holiday override behavior
- Current commands and logging UX (`5 hrs on freelance`)

---

## Recommended approach: env map + per-entry rate resolution

Prefer env config first — matches how all rates work today (Vercel env vars, no DB migration, single-user bot).

### Config shape

```bash
# Flat rate per tag (overrides day-type rates for that tag)
PAY_RATE_BY_TAG=freelance:55,clientb:80,agency:45

# Optional: day-type overrides for a specific tag (higher priority than flat tag rate)
# PAY_RATE_TAG_freelance_WEEKDAY=55
# PAY_RATE_TAG_freelance_SATURDAY=70
# PAY_RATE_TAG_freelance_SUNDAY=90
# PAY_RATE_TAG_freelance_HOLIDAY=100
```

### Rate resolution (per entry)

1. If tag has day-type-specific env rate for this day → use it  
2. Else if tag has flat `PAY_RATE_BY_TAG` rate → use it (including on weekends unless day-type override exists)  
3. Else if tag is a holiday tag → `PAY_RATES.holiday`  
4. Else → global weekday / Saturday / Sunday rate  

Untagged entries always use global day-type (and never holiday unless tagged).

### Calculation change

Today pay is computed from **aggregated hour buckets**. Mixed job rates need **per-entry** (or per tag+dayType) multiplication:

```text
for each entry:
  rate = resolveRate(entry)
  pay += hours * rate
```

Refactor `calculatePayTotals` (or add `calculatePayFromEntries(entries)`) so `/summary`, `/today`, `/paycycle`, and `/paycycles` all share one path.

Display can keep a simple total, plus optional breakdown by tag when multiple job rates apply:

```text
Estimated pay: $1,240.00
  • freelance: 12h × $55 = $660.00
  • clientb: 8h × $80 = $640.00
```

Day-type lines remain useful when only global rates apply; when job rates dominate, prefer tag breakdown (or show both if space allows).

---

## Implementation steps

### 1. Config parsing
- Add `parsePayRatesByTag()` for `PAY_RATE_BY_TAG` (`tag:number` pairs, case-insensitive tags)
- Optionally parse `PAY_RATE_TAG_<name>_<DAYTYPE>` env vars
- Document in `.env.example`

### 2. Rate resolver
- New helper: `resolveEntryRate(entry) → number`
- Encapsulate holiday + day-of-week + tag lookup

### 3. Pay aggregation refactor
- Add `calculatePayFromEntries(entries)` returning `{ total, byTag, byDayType }`
- Wire into: `handleSummary`, `handleToday`, `handlePayCycle`, `handlePayCycles`
- Keep `PAY_RATES_ENABLED` true if **either** global rates or any tag rate is set

### 4. UX / commands
- Update `/help` to mention per-job rates
- Extend `/category <tag>` to show estimated pay using that tag’s resolved rate (nice-to-have in same PR)
- Optional: `/rates` or include job rates in `/help` / `/stats` so configured tag rates are visible without checking Vercel

### 5. Docs
- Update `docs/TECHNICAL_DOCS.md`, `docs/README.md`, and `.env.example`
- Note: changing a tag rate in env affects **all historical** summaries for that tag (rates are not snapshotted on the entry)

### 6. Tests / manual checks
- Untagged hours → global rates unchanged
- Tagged with configured rate → uses job rate
- Tagged without config → falls back to global
- Holiday tag vs job rate priority (document chosen order; recommend job day-type/flat over holiday if both could apply, **or** holiday wins — pick one and document)
- Mixed tags in one pay cycle → correct total
- `/paycycle freelance` with freelance-specific rate

**Suggested holiday vs job priority:** if a tag is listed in both `PAY_RATE_BY_TAG` and `PAY_RATE_HOLIDAY_TAGS`, prefer the **job rate** (explicit job config wins). Pure holiday tags without a job rate keep holiday pay.

---

## Optional follow-up (Phase 2): bot-managed rates

If env-only is too stiff (redeploy to change rates):

| Piece | Change |
|-------|--------|
| Collection | `job_rates` `{ tag, weekday?, saturday?, sunday?, holiday?, flat? }` |
| Commands | `/setrate freelance 55`, `/setrate freelance sat 70`, `/rates` |
| Resolver | DB rate → env tag rate → global day-type |

Larger scope; only needed if rates change often. Not required for the first ship.

---

## Out of scope / non-goals

- Changing how tags are extracted from messages  
- Multi-user / multi-currency per job  
- Snapshotting the rate onto each historical entry (can be Phase 3 if rate history matters)  
- Full Job CRUD UI outside Telegram  

---

## Risk & complexity

| Factor | Notes |
|--------|--------|
| Invasiveness | Medium — pay helpers in `commands.js` only; schema optional for Phase 1 |
| Backward compatibility | High — unset `PAY_RATE_BY_TAG` → identical to current behavior |
| Main risk | Summary formatting when mixing global day-type and per-tag rates; keep totals correct first, polish breakdown second |
| Dependencies | None new; env parsing only |

---

## Suggested ship order

1. **MVP:** `PAY_RATE_BY_TAG` + per-entry resolver + shared pay helper + docs  
2. **Polish:** tag breakdown in summaries, `/category` pay, list rates in help  
3. **Phase 2 (if needed):** Mongo-backed `/setrate`  

---

## Files to touch (MVP)

- `src/bot/handlers/commands.js` — parsing, resolver, aggregation, handlers, help text  
- `.env.example` — document `PAY_RATE_BY_TAG`  
- `docs/TECHNICAL_DOCS.md`, `docs/README.md` — config + behavior  
- `TODO.md` — track remaining polish / Phase 2  

No database migration for MVP.
