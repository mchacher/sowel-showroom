# Architecture — spec 003

## The seed, through the core's own door

```
reset.sh
  │ 1. earliest energy point?  ── InfluxDB query (admin token, this stack's own)
  │ 2. missing days → the simulator package's generator (simulator spec 004)
  │       node <plugin>/dist/history/cli.js --fixture demo-fr.zip
  │            --until <earliest|now> --days <n> --out /tmp/seed
  │       → influx-raw.lp, influx-hourly.lp, influx-daily.lp,
  │         influx-energy-hourly.lp, influx-energy-daily.lp
  │ 3. zip = fixture + those five files
  │ 4. POST /api/v1/backup (restore)  ── the core writes each file to its bucket
  ▼
```

The generator runs from the plugin's released tarball, inside a throwaway container
of the Sowel image (it has Node), exactly as the reset already runs its shell
steps. No new image, no socket.

## The journals, across the wipe

```
before the wipe   docker compose exec sowel node dump-tables.js  → journals.json
wipe, restore     as today
after the restore docker compose exec sowel node load-tables.js  ← journals.json
restart           so the core's stores reopen on the reloaded rows
```

Both scripts use the image's own `better-sqlite3`, read the table's columns from
`PRAGMA table_info`, and insert only the columns both sides have. The table list is
FR3's, in one place (`scripts/lib/journal-tables.txt`), so adding a table is a
one-line change and a reviewed one.

## Why not stop wiping the database

Leaving the SQLite file in place and letting the restore replace the backup tables
would keep every journal for free. It would also keep everything else a visitor
can leave behind that no backup carries — timed actions, push subscriptions, plugin
state — and every table a future core adds. The reset's promise is a fresh house;
what survives it should be a list someone chose.
