# Cash Reconciliation & Exceptions Tracker

Demo app for the daily work of a brokerage cash-management team. The firm, banks, people, and transactions are invented.

**Synthetic demonstration data. These are not real customers, accounts, or transactions.**

## Open the desk

You need Node.js 20+ and Docker.

```bash
cp server/.env.example server/.env
npm install
npm run db:up
npm run db:setup
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173). The page is the Friday, 6 November 2026 book: matches, breaks, leftover cash, and the close checklist. Choose Maya Chen, Jordan Hale, or Priya Shah in **Working as** and open a break to escalate or resolve it. The shared demo password is `Demo1234!`. This screen records the person you select and does not ask for the password.

`db:setup` applies the Prisma migration and loads the day. Postgres listens on **localhost:54329**. The API runs on port 4000. `npm test` checks the matcher and the synthetic day.

## Status

| Step | State |
| --- | --- |
| Database schema and synthetic day | Done |
| Matching engine and classification tests | Done |
| Desk API and the first screen | Done |
| Transfer approval screen, CSV export, screenshots | Not started |

`db:setup` applies the Prisma migration and loads Friday, 6 November 2026. Postgres listens on **localhost:54329**, so it does not collide with a Postgres already using 5432. The database password in `.env.example` is for this local demo only.

| Name | Email | Role | Password |
| --- | --- | --- | --- |
| Maya Chen | maya.chen@northline.demo | Maker (cash analyst) | `Demo1234!` |
| Jordan Hale | jordan.hale@northline.demo | Checker (cash approver) | `Demo1234!` |
| Priya Shah | priya.shah@northline.demo | Admin (operations manager) | `Demo1234!` |

Run `npm run db:seed` again to wipe the demo tables and reload the same day.

## Folder structure

```
docker-compose.yml
package.json
server/
  prisma/schema.prisma          accounts, imports, matches, exceptions, transfers, audit
  prisma/seed.ts                loads the synthetic day
  src/demo/generateDay.ts       the fixed business day, with no database
  src/money.ts                  signed amounts as cent integers
  src/dates.ts                  business-day calendar
  src/auth/password.ts          scrypt hashes for the demo users
  src/reconcile/match.ts        reference-id matcher
  src/desk/overview.ts          the payload for the screen
  src/index.ts                  Express API
client/                         React desk at localhost:5173
```

## What the synthetic day contains

Business date: **Friday, 6 November 2026**. Four fictional accounts:

| Account | Bank | Opening balance | Target |
| --- | --- | --- | --- |
| Operating | Harbor National | 2,450,000.00 | 0.00 |
| Settlement | Cedar Trust | 8,120,000.00 | 500,000.00 |
| Client money | Lake Street Bank | 15,000,000.00 | 0.00 |
| Disbursement | Redwood Deposit Bank | 640,000.00 | 500,000.00 |

Imported activity is 1,000 ACH, wire, check, and journal rows across the internal ledger and the bank file. Positive amounts are cash in. Negative amounts are cash out. The generator deliberately includes:

- clean matches
- timing differences (same reference and amount, different value date)
- amount mismatches
- items missing from the bank
- items missing from the ledger
- duplicates (a reference repeated on one side)

Pending items for Monday 9 November through Wednesday 11 November sit in `scheduled_items`. They are not part of Friday's match. The forecast will use those three business days.

Ledger ending balance is the opening balance plus every ledger row. A duplicate ledger entry counts twice, because both rows are on the books. An account has leftover cash when that ending balance is above its target. On this day, Operating, Settlement, and Client money are above target. Disbursement ends at 450,630.00, under its 500,000.00 target.

## Reconciliation rules

The matcher groups rows by reference ID, then classifies each group in this order:

1. **Duplicate** — the reference appears more than once on the ledger, on the bank file, or on both. Duplicate wins even if the other side is empty or the amounts differ.
2. **Missing in Bank** — one ledger row, no bank row.
3. **Missing in Ledger** — one bank row, no ledger row.
4. **Amount Break** — one row on each side, amounts differ.
5. **Matched** — one row on each side, amounts equal. If the value dates differ, the match is kept and `timingDifference` is set. `lagDays` is the bank value date minus the ledger value date, in calendar days.

A clean match (Matched, and not a timing difference) does not become an exception. Every other result does, including timing differences. Exception status is Open, Investigating, or Resolved. Notes, the owner, and the resolution reason are stored on the exception. Each status change is an `exception_events` row with the actor and a timestamp.

Aging and the cutoff view use that history. The close checklist passes when every exception for the day is Resolved or Investigating before the cutoff. Investigating counts as escalated. Anything still Open after the cutoff is past due. The demo cutoff is **16:00 America/Chicago**.

## Controls

Imported ledger and bank rows are read-only. Maker-checker applies only to wires and journals a user creates in the app.

- The approval threshold lives on `app_settings`. The demo value is **250,000.00**.
- A transfer at or under the threshold is stored as `POSTED`. The maker is recorded, and no second approval is required.
- A transfer above the threshold is stored as `PENDING_APPROVAL`. A different user has to approve it (`APPROVED`) or reject it (`REJECTED`). The maker cannot approve their own transfer.
- Journals name both accounts. External wires name a beneficiary and leave the destination account empty.
- `action_logs` records every change. The desk logs the seed load, the match run, and each exception update.
- On the screen, escalating or resolving a break writes the status change, the person, and the time. Creating a transfer is not on this screen yet. The threshold is shown on the checklist, and the transfer tables are ready for that step.
