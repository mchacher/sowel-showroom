# Running the showroom

Written for someone at three in the morning who did not write any of this.

## The one command

```bash
scripts/reset.sh
```

That is the whole contract: from whatever state the demo is in, back to the house
every visitor should find. It is safe to run twice, and safe to run while visitors
are connected — they are logged out and land on the welcome page again.

If it exits non-zero it says which step failed and leaves the instance mid-way.
Running it again is almost always the right answer.

## Is the demo actually fine?

```bash
scripts/verify-showroom.sh
```

Ten checks, no browser. It answers the question an HTTP 200 does not: Sowel can
answer perfectly while the house behind it does nothing.

Every check exists because something was once quietly broken:

| Check                                      | What it caught                                                                                                                                                                                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| integrations connected                     | the plugin can fail to load and the instance still answers 200                                                                                                                                                                                                      |
| devices present and online                 | a fixture can restore with bindings pointing at nothing                                                                                                                                                                                                             |
| equipments online and bound                | an equipment with no binding reads `offline` and looks like a hardware fault                                                                                                                                                                                        |
| **recipe definitions loaded**              | twenty-one instances against zero definitions — the house answering when clicked and automating nothing                                                                                                                                                             |
| arbiter enabled with loads                 | three energy profiles restored as three nulls, because the core reads its column list from the first row ([sowel#939](https://github.com/mchacher/sowel/issues/939))                                                                                                |
| the guest can act, and cannot end the demo | a write gate asserted in a config file and never exercised is a comment; since 2026-09-27 also: the guest is an admin, a configuration write and the private reads are refused by the proxy, the admin screens are readable, the admin door is on the loopback only |

One line is a note rather than a check: **the production meter is offline at
night.** The simulated inverter goes offline after sunset instead of reporting
0 W, because that is what a real one does. It is the house being honest about the
dark.

## What the reset does and does not keep

|            |                                                                                                                                                                              |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Wiped**  | SQLite (the whole house: zones, equipments, bindings, recipes, users) and the plugins directory                                                                              |
| **Kept**   | InfluxDB, and the journals no backup carries: the arbiter's decisions, surplus and daily metrics, the activity journal, the recipes' logs (`scripts/lib/journal-tables.txt`) |
| **Seeded** | Whatever of the last thirty days InfluxDB lacks, computed by the simulator (its spec 004) and restored with the fixture                                                      |

So a fresh instance opens with a month of charts, and every reset after that seeds
nothing: the history is real from the first live point on (spec 003).

## Before the public link: the burn-in week

The seeded month has energy and sensors, and no arbiter: the arbiter's decisions
are the product's, and none are invented (spec 003, FR4). So the stack runs on its
host for **at least seven days before the link goes out**, resetting every night as
it will in production. Then:

1. `scripts/verify-showroom.sh` — the energy and temperature checks are green;
2. set `ARBITER_BURNED_IN=1` in `.env` and run it again — the arbiter check now
   requires six full days of its own in the last seven;
3. publish the link.

## When it breaks

**The page says "la démo n'est pas encore prête".** The landing page could not read
`/showroom/config.json`, which the reset writes. Either the reset has not run yet,
or it failed before its last step. Run it.

**The page loads but Sowel does not.** `docker compose logs sowel`. The proxy serves
the landing page itself, which is deliberate: it works while Sowel is restarting,
which is exactly when somebody arrives.

**Recipe definitions missing.** The instance could not download its packages. Two
usual causes: no outbound network, or a proxy intercepting TLS — phase 1 hit the
second, and the symptom is an instance that comes up cheerfully with recipe
instances pointing at nothing. Set `PACKAGES_DIR` in `.env` to a directory of
extracted packages and re-run the reset; it refuses to side-load nothing.

**A visitor reports a 429.** Working as intended: a sequential visitor is never
refused, only briefly slowed. A 429 means something was firing in parallel.

**The demo is read-only, and that is on purpose** (spec 001, amended 2026-09-27).
The guest is an admin: it sees every screen. The public door refuses every write
`scripts/write-allowlist.txt` does not name, and every read
`scripts/admin-reads.txt` marks `refuse`, with "Démo en lecture seule".
`proxy/nginx.conf` is generated from both.

**A visitor can do something they should not, or cannot do something they should.**
Edit the list, run `scripts/generate-proxy-conf.sh`, `docker compose restart proxy`.
Then add the case to `scripts/verify-showroom.sh`, because the rule you do not
exercise is the rule that comes back.

**The core gained an admin-only path.** `npm run validate` fails, naming it. That is
`check-admin-reads.sh` reading the core's admin gates: a new private read is a
decision, not a leak. Writes need no such check — a new one is refused until named.

**What visitors do goes through a queue** (spec 005). The `queue` service — one file,
`queue/server.mjs`, no dependency — takes every visitor order the proxy marks `queue`
in `scripts/write-allowlist.txt`, runs them one at a time, and streams the queue and
the journal to every floating window. It holds everything in memory: a restart empties
the queue and the journal, nothing else. `docker compose logs queue` says whether its
feed from Sowel is connected; `verify-showroom.sh` checks that an order is queued and
that the stream answers.

**Administering the demo by hand.** The public door is read-only for everyone, the
owner included. The admin door listens on `127.0.0.1:${ADMIN_PORT:-8081}` on the
host: locally, or `ssh -L 8081:127.0.0.1:8081 <host>` from elsewhere. The scripts
already use it for their writes.

## Rolling the core back

`SOWEL_IMAGE` in `.env` pins it. Change it, `docker compose up -d sowel`, then
`scripts/verify-showroom.sh` — which is what catches a breaking change, rather than
a visitor.

## What is not here

The VM, DNS, the tunnel and the nightly schedule are phase 5 and live in the
private `sowel-ops`. Everything above runs on a laptop, and should keep doing so:
a demo whose only environment is production is a demo nobody dares touch.
