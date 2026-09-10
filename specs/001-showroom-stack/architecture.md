# Spec 001 — Architecture

## Layout

```
compose.yml                 sowel + influxdb + proxy, nothing else
.env.example                every key, no value
proxy/
  nginx.conf                deny list, quotas, the landing page, the upstream
landing/
  index.html                one page, no build step
scripts/
  reset.sh                  the contract: one command from zero
  lib/sowel-api.sh          login, wait-for-health, the curl wrappers
  check-deny-list.sh        the core's allowlist vs. what this repo classified
  deny-list.txt             the classification itself, one route per line
docs/
  operations.md             what to do when it breaks, for a human at 3 a.m.
```

## nginx, not Caddy

The project map leaned Caddy for its simpler config and automatic TLS. Choosing
nginx instead, for two reasons that both turned out to matter more:

**Rate limiting.** `limit_req` is built into nginx. Caddy's is a third-party module,
which means building and maintaining a custom Caddy image to get FR4 — a lot of
machinery for one directive.

**TLS is not ours.** Automatic TLS was Caddy's other advantage, and phase 5
terminates TLS at a Cloudflare tunnel. Locally this is plain HTTP on a loopback
port. The advantage does not apply.

This amends the map's lean rather than contradicting a decision; the decision table
never named a proxy.

## How a request flows

```
browser → nginx :8080
            │
            ├─ /                    → landing/index.html          (static)
            ├─ denied paths         → 403, no upstream contacted
            ├─ mutating /api/v1/*   → limit_req, then sowel:3000
            ├─ /api/v1/*  (reads)   → sowel:3000
            ├─ /ws                  → sowel:3000, upgraded
            └─ everything else      → sowel:3000                  (the product UI)
```

Sowel's port is **not published on the host**. The only way in is the proxy, which
is what makes AC5 meaningful: the same request that 403s through the proxy succeeds
from inside the compose network, so the 403 is demonstrably the proxy's doing and
not the core's.

## The deny list, as data

`scripts/deny-list.txt` is the classification, one line per route:

```
keep  POST    ^/api/v1/equipments/[^/]+/orders/[^/]+$
deny  PUT     ^/api/v1/me/password$
```

Two things read it. `check-deny-list.sh` compares it against
`STANDARD_WRITE_ALLOWLIST` in `../sowel/src/auth/auth-middleware.ts` and fails on
any route the core allows and this file does not mention. And the nginx config
carries the `deny` lines as `location` blocks — generated, with a check that the
generated file matches the data, so the two cannot drift.

Exact-match locations matter here: `PUT /api/v1/me` is denied and
`PUT /api/v1/me/preferences` is kept, so the first needs `location = /api/v1/me`.

## The reset, step by step

`reset.sh`, with `set -euo pipefail` and a `trap` that says which step failed:

| Step          | How                                                                                                           |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| Stop Sowel    | `docker compose stop sowel` — InfluxDB keeps running and keeps its volume                                     |
| Wipe SQLite   | `docker compose run --rm --entrypoint sh sowel -c 'rm -rf /app/data/*'` — the data volume, not the image      |
| Start, wait   | `docker compose start sowel`, then poll `/api/v1/health` until 200                                            |
| Admin         | `POST /api/v1/auth/setup` from `.env`                                                                         |
| Fixture       | `POST /api/v1/backup` with the fixture fetched for the pinned simulator version                               |
| Restart, wait | the restore says `restartRequired: true`, and it means it                                                     |
| Admin again   | the fixture carries no users, so the setup wizard runs a second time — this is the core's contract, not a bug |
| Guest         | `POST /api/v1/users` as admin, role `standard`                                                                |
| Verify        | FR6, every assertion, exit non-zero on the first failure                                                      |

**The fixture is not committed here.** It is built in the simulator repository,
where the catalogue it depends on lives, and fetched at a pinned tag:

```
https://raw.githubusercontent.com/mchacher/sowel-plugin-simulator/v${SIMULATOR_VERSION}/docs/fixtures/demo-fr.zip
```

Two copies of a generated binary in two repositories is one copy too many, and the
pin is what the showroom is for (`CLAUDE.md`: the showroom pins the versions).

## Where the plugin comes from

The fixture registers `simulator` in the `plugins` table, so the core downloads it
on startup (spec 058) once the registry carries it
([sowel#940](https://github.com/mchacher/sowel/pull/940)).

Until that merges, and for working offline, `SIMULATOR_TARBALL` points at a local
tarball which the reset unpacks into the plugins volume. The script says which path
it took, because "it worked on my machine" usually means the other one.

## What the verification actually checks

Not a smoke test — the six things phase 1 found can silently be wrong:

```
integrations       every one reports connected
devices            count matches the fixture, all online
equipments         all online, none without a data binding
recipe instances   every enabled instance has started
arbiter            enabled, with at least two profiled loads
guest              can order a light; CANNOT change its own password
```

The last line is the deny list tested against a running proxy. A security rule
asserted in a config file and never exercised is a comment.

## Operations

`docs/operations.md` is written for a human at three in the morning who did not
write any of this: what the nightly reset does, how to tell whether it ran, what a
failed reset leaves behind (the previous house, still running — the reset stops
Sowel before wiping, so a failure mid-way leaves an empty instance, and the script
says so), and how to roll the core image back.
