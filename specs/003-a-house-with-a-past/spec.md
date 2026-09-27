# Spec 003 — A house with a past

**Status**: ✅ Implemented — the burn-in week is phase 5's. Prerequisite of phase 5: the demo does not open to
the public with empty charts.

## Context

The owner, 2026-09-26: _before deploying, historical data has to exist — the solar
arbiter's included._ A visitor opens the Energy page and sees one day, or a few
hours; opens the arbiter and sees nothing at all. The demo's most interesting
screens are the ones that need time.

Two things stand in the way today.

**The decision table says "no backfill".** The reset keeps InfluxDB and lets history
accrue in real time, on the grounds that a plugin cannot write history and that
replaying weeks through the pipeline is heavy. Both premises have moved: the core's
own backup format carries InfluxDB history as line protocol, one file per bucket,
and its restore writes them (`src/backup/backup-manager.ts`, `INFLUX_BUCKETS`). A
Sowel backup with history in it is an ordinary backup; nothing is replayed through
the pipeline and nothing in the product changes.

**The arbiter's history dies every night.** It lives in SQLite, in four tables no
backup carries — `arbiter_decision_log` and `arbiter_surplus_log` (7 days),
`arbiter_daily_load_metrics` and `arbiter_daily_home_metrics` (400 days) — and the
reset wipes the database file before restoring the fixture. Even left to accrue in
real time, the arbiter would never show more than the current day. That is a bug of
this stack, whatever is decided about seeding.

## Goals

- On opening, a visitor sees full charts: energy by day, week and month over the
  last thirty days; temperatures, humidity, light, the pool, over the same range.
- The arbiter shows a real week: its decisions, its surplus curve, its daily
  metrics.
- History survives the nightly reset — InfluxDB as today, and the SQLite journals
  with it.
- Nothing ever overwrites a real point. Seeded history fills only the days before
  the first real one.
- The core stays stock.

## Non-goals

- Synthetic arbiter decisions. See FR4.
- A time-lapse of the day (project map, phase 4).
- History older than thirty days.

## Functional requirements

### FR1 — The decision table is amended

`docs/project-map.md`: "Energy history — no backfill" becomes "seeded once, through
the core's backup format, then accrued in real time". The reasoning above goes with
it, as an amendment.

### FR2 — Seed the history the instance does not have

At install, and at every reset, the reset script finds the instance's earliest
energy point (`sowel-energy-hourly`). If there are fewer than thirty days before
now, it asks the simulator for the days that are missing — from thirty days ago up
to that earliest point (simulator spec 004) — and puts the line-protocol files it
gets into the fixture's zip before restoring it. The core's restore writes them to
their buckets. A second run finds thirty days and seeds nothing.

### FR3 — The reset keeps the journals

The reset still wipes the house, and keeps its history. Before wiping SQLite it
copies out the history tables no backup carries; after the restore it puts them
back:

| Table                                                      | Why kept                                            |
| ---------------------------------------------------------- | --------------------------------------------------- |
| `arbiter_decision_log`, `arbiter_surplus_log`              | The arbiter's week — its timeline and surplus curve |
| `arbiter_daily_load_metrics`, `arbiter_daily_home_metrics` | Its daily metrics, which the core keeps 400 days    |
| `activity_log`, `recipe_log`                               | The journal a visitor reads, and each recipe's log  |

Every other table not in the backup is wiped as today — timed actions, push
subscriptions, MFA, plugin state: things a visitor may have left behind. Rows go
back by column name, intersected with the current schema, so a core upgrade that
adds a column does not break the reset. The core's own purges keep each table to
its retention.

### FR4 — The arbiter's history is the arbiter's

No arbiter decision is invented. The arbiter's first week comes from the arbiter:
the stack runs on its production host for **at least seven days before the public
link goes out** (phase 5), and FR3 keeps what it decides across every reset in that
week and after.

Rejected, and why:

- **Synthetic decisions from a model of the arbiter.** The arbiter is the product's
  feature being shown. A timeline of grants the product never made, from a model
  that is not its algorithm, would be a demo of something else.
- **Replaying the seeded surplus through the core's arbiter offline.** Faithful, but
  it drives the core's internal classes from outside, against no contract; the
  first refactor of the arbiter breaks the reset.

### FR5 — The verification says the charts are full

`verify-showroom.sh` gains three checks, through the public API as a guest:

- the energy history for the last thirty days has a value for every day;
- a sensor's history (the living room's temperature) covers the last seven days;
- once the burn-in is done (a flag in `.env`), the arbiter's timeline has decisions
  in the last seven days.

## Acceptance criteria

- On an empty InfluxDB, one reset gives thirty days of energy in the Energy page's
  month view, and temperatures over the last week.
- A second reset seeds nothing, and the data from the first is intact.
- An arbiter decision taken before a reset is still in its timeline after it.
- Seeded days and real days meet without a gap or an overlap at the first real
  point.
- `verify-showroom.sh` is green.

## Edge cases

- **An instance with ten real days.** Twenty days are seeded, before the first real
  one.
- **A core upgrade changes a bucket's format.** The simulator's output is pinned
  against a real backup (simulator spec 004, FR4); the pin fails before the demo
  does.
- **A daylight-saving change inside the seeded range.** Days are local days, as the
  core's energy aggregation counts them.
- **The simulator is not installed yet on a fresh stack.** The seed runs after the
  plugin is installed, from its package, not from the running instance.
