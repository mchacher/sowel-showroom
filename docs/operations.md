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

| Check                                      | What it caught                                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| integrations connected                     | the plugin can fail to load and the instance still answers 200                                                                                                       |
| devices present and online                 | a fixture can restore with bindings pointing at nothing                                                                                                              |
| equipments online and bound                | an equipment with no binding reads `offline` and looks like a hardware fault                                                                                         |
| **recipe definitions loaded**              | twenty-one instances against zero definitions — the house answering when clicked and automating nothing                                                              |
| arbiter enabled with loads                 | three energy profiles restored as three nulls, because the core reads its column list from the first row ([sowel#939](https://github.com/mchacher/sowel/issues/939)) |
| the guest can act, and cannot end the demo | a deny list asserted in a config file and never exercised is a comment                                                                                               |

One line is a note rather than a check: **the production meter is offline at
night.** The simulated inverter goes offline after sunset instead of reporting
0 W, because that is what a real one does. It is the house being honest about the
dark.

## What the reset does and does not keep

|           |                                                                                                 |
| --------- | ----------------------------------------------------------------------------------------------- |
| **Wiped** | SQLite (the whole house: zones, equipments, bindings, recipes, users) and the plugins directory |
| **Kept**  | InfluxDB                                                                                        |

History therefore accrues from launch day and survives every reset. That is a
decision, not an accident — a demo whose charts are empty every morning shows
nothing about energy.

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

**A visitor can do something they should not.** `scripts/deny-list.txt` is the
classification and `proxy/nginx.conf` is generated from it. Add a line, run
`scripts/generate-proxy-conf.sh`, `docker compose restart proxy`. Then add the case
to `scripts/verify-showroom.sh`, because the rule you do not exercise is the rule
that comes back.

**The core's role gate grew a route.** `npm run validate` fails, naming it. That is
`check-deny-list.sh` reading `STANDARD_WRITE_ALLOWLIST` out of the core: a new
thing a visitor can do is a decision, not a discovery.

## Rolling the core back

`SOWEL_IMAGE` in `.env` pins it. Change it, `docker compose up -d sowel`, then
`scripts/verify-showroom.sh` — which is what catches a breaking change, rather than
a visitor.

## What is not here

The VM, DNS, the tunnel and the nightly schedule are phase 5 and live in the
private `sowel-ops`. Everything above runs on a laptop, and should keep doing so:
a demo whose only environment is production is a demo nobody dares touch.
