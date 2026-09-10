# Sowel showroom — project map

**Status**: proposed (macro document — it records the decisions and the plan, and delegates the detail to one spec per phase)
**Repositories**: [`sowel-showroom`](https://github.com/mchacher/sowel-showroom) (this one, infrastructure), [`sowel-plugin-simulator`](https://github.com/mchacher/sowel-plugin-simulator) (plugin), [`sowel-house-3d`](https://github.com/mchacher/sowel-house-3d) (application)
**Related in the core**: [mchacher/sowel#912](https://github.com/mchacher/sowel/issues/912) (standard users activate modes), spec 124 (shadow mode), spec 131 (role gate), spec 136 (personal plugin sources), spec 111 (plugin isolation), spec 140 (capacity arbiter), spec 089 (plugin supply chain)

## Problem

Sowel has no public face. The docs show screenshots; the README shows a paragraph. Someone who wants to know _what the product does_ has to install it, bind hardware, and wait a week for the pages to fill. There is nothing to click on.

The maintainer's production is a good example of a Sowel home — PV, heat pump, shutters, motion lighting, modes, energy arbitration — but it is a family's home. Its data leaks who is where and when. It cannot be the demo, and an anonymised copy of it cannot either: an inert copy shows red banners, offline rows and empty charts. The core's `sowel-docs` skill states it plainly: _an inert instance cannot photograph a live one._

So the demonstrator needs **live data that belongs to nobody**, and a way for a visitor to **act and see Sowel react** — not a video, not a static tour.

## Goal

A public URL where anyone can open a Sowel instance that runs a fictional house: people live in it, the sun rises on it, its recipes fire, and a visitor can turn a light on, close a shutter, walk into a room and watch the motion sensor, the recipe and the journal do their job. Next to it, the same house rendered in 3D, driven by the same Sowel, so that what the visitor clicks in the picture is what Sowel actually does.

## Decisions already taken

Settled in discussion; the phase specs do not reopen them.

| Topic                    | Decision                                                                                                            | Why                                                                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Relation to the core     | **A separate project.** Three repos, one nature each. The core changes only through ordinary product issues (#912). | Nothing demo-specific belongs in the product. Everything the demo needs can be done with a plugin, a reverse proxy and a client of the public API.                                    |
| Source of the live data  | **Pure simulator**, no mirror of production                                                                         | A mirror leaks presence patterns and gives a read-only demo. A simulator is deterministic, safe, interactive.                                                                         |
| Can a visitor act?       | **Yes** — orders, modes, timed actions, simulation triggers                                                         | A demo you cannot touch is a screenshot.                                                                                                                                              |
| Several visitors at once | **One shared world**, with rules (below)                                                                            | Per-visitor worlds lose "one Sowel"; a queue is the fallback if sharing turns chaotic.                                                                                                |
| Who is the visitor       | A shared **guest account with the `standard` role**                                                                 | Spec 131's fail-closed gate already limits a standard user to usage mutations. What it still allows and should not (own password, tokens, MFA) is blocked by the proxy.               |
| Hosting                  | A **dedicated VM** later; **local Docker** first                                                                    | The former demo host no longer exists.                                                                                                                                                |
| Reset cadence            | **Nightly at 04:00**, as a safety net                                                                               | Rate limits + short overrides + a reconverging simulation make the reset rarely necessary. Adjust after observation.                                                                  |
| Energy history           | **No backfill.** The reset wipes SQLite and **keeps the InfluxDB volume**                                           | A plugin cannot write history, and replaying weeks through the pipeline is heavy. Real-time accrual is consistent with what the visitor sees; after a week the Energy pages are full. |
| Simulated time           | **Real time**, never accelerated                                                                                    | A visitor at 03:00 sees a sleeping house. History stays coherent.                                                                                                                     |
| The 3D house             | A **generic application** in its own repo, not a page of the product UI and not a piece of the demo infrastructure  | It reads a plan and a mapping and talks to any Sowel instance. The showroom is one of its deployments; a user's own home is another, later.                                           |
| 3D construction          | **Procedural** walls from a plan JSON + **CC0 low-poly furniture** (Kenney, Quaternius, Poly Pizza) + Sowel palette | No Blender skill required, everything data-driven, stylised rather than pseudo-realistic. The prototype in `sowel-house-3d/prototype/` validated the look.                            |
| Solar panels             | On the roof, so the house gets a roof — **later phase**                                                             | Requested; not needed to validate the rest.                                                                                                                                           |

## Rejected alternatives (so they are not re-litigated)

Each of these was considered and turned down. Reopening one is allowed; doing it
without knowing it was already weighed is not.

| Rejected                                                       | Why                                                                                                                                                                                                        |
| -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mirroring production over MQTT into the demo                   | Authentic data, but read-only, and it publishes a family's presence patterns to the internet. A hybrid (real PV and weather, simulated rooms) stays possible if the PV story ever needs it.                |
| Replaying a week of InfluxDB history shifted to "now"          | Realistic curves, more work than the simulator, and less interactive for the visitor.                                                                                                                      |
| A demo mode inside the core (`SOWEL_DEMO_MODE`)                | The first draft put the guest session, the allowlist, the quotas and the banner in the product. Every one of them is doable in the plugin, the proxy or the 3D app. The product stays stock.               |
| One simulated world per visitor                                | Loses "one Sowel", and the host carries N simulations. A shared world is also a better demo: things move because someone else is there.                                                                    |
| A pilot queue (one visitor drives, others watch)               | Kept as the fallback if the shared world turns chaotic despite debounce and quotas. Not v1: it makes most visitors spectators.                                                                             |
| Blender-authored geometry                                      | Needs a skill the project does not have, and a rebuild for every plan change. Procedural walls plus CC0 furniture is data-driven and was validated by the prototype.                                       |
| Names: `sowel-maquette`, `sowel-house-twin`, `sowel-dollhouse` | "Maquette" was disliked; "twin" oversells (digital-twin means a synchronised model of a real building, and the demo house is fictional); "dollhouse" reads as a toy. `sowel-house-3d` is plain and honest. |

## The pieces and their contract

```
                 ┌──────────────────────────────────────────────────────┐
                 │  sowel-showroom (infra)                               │
                 │                                                       │
   browser       │  ┌────────────────┐                                  │
 ◄──────────────►│  │ Reverse proxy  │   ┌──────────────────────────┐   │
                 │  │ - guest login  │   │ Sowel (stock image)       │   │
   house-3d      │  │ - deny list    │──►│  ┌────────────────────┐  │   │
   (static app)  │  │ - IP quotas    │   │  │ Simulator plugin    │  │   │
                 │  │ - static twin  │   │  │ - occupants (agenda)│  │   │
   orders,       │  └────────────────┘   │  │ - sun, weather      │  │   │
   sim triggers  │                       │  │ - thermal per room  │  │   │
 ──────────────► │   reset cron ────────►│  │ - PV, loads, grid   │  │   │
                 │   (nightly)           │  │ - ephemeral presence│  │   │
                 │                       │  │ - executes orders   │  │   │
                 │                       │  │ - per-target debounce│ │   │
                 │                       │  └─────────┬──────────┘  │   │
                 │                       │            ▼             │   │
                 │                       │  Device Manager ► Events │   │
                 │                       │  Equipments ► Zones      │   │
                 │                       │  Recipes ► Modes         │   │
                 │                       │  Arbiter ► InfluxDB      │   │
                 │                       └──────────────────────────┘   │
                 └──────────────────────────────────────────────────────┘
```

- **The simulator simulates the physical world, not the sensors.** It moves people, computes temperatures and power, and publishes them as ordinary device data. Motion lighting, presence heating, shutters at dusk, pool scheduling, capacity arbitration are **Sowel's own recipes and engines** running on top. Nothing in the simulator knows what a recipe is. That is the point of the demo: it is really Sowel doing the work.
- **Every write goes through Sowel's public API.** The 3D app sends equipment orders and simulation triggers like any client; it never talks to the plugin. The product UI and the 3D app are two clients of one state.
- **Occupants are devices.** Each person is a simulator device with a `zone` enum reading. Their position is therefore visible to the API, the WebSocket, the history and the 3D app, with no side channel. A plugin has no other way to publish state, and it is the right way.
- **Two kinds of presence, from day one.** Scheduled occupants, and _ephemeral presence_ triggered from outside (a visitor's click). The second exists because of the multi-visitor rules below.
- **The core stays stock.** The showroom runs the published `ghcr.io/mchacher/sowel` image. Anything the demo needs that the product does not offer is done in the plugin, the proxy or the 3D app, or becomes an ordinary product issue argued on its own merits.

## Component A — the simulator plugin (`sowel-plugin-simulator`)

An integration plugin like any other: `createPlugin(deps)`, registry entry with `sha256` and `owner` (spec 089), installable through a personal source while it is being developed (spec 136). It runs under the spec 111 scoped deps: it can only write devices whose `integrationId` is its own — hence the fixture remap below.

**World model** (deterministic given the clock; real-time):

- **Occupants** — a small household (two adults, one or two children) with weekday and weekend agendas, small randomness, and a position that is a zone. Leaving and returning goes through the entrance (door contact opens). Each occupant is a device: `zone` (enum of zone names + `away`), `present` (boolean) — published for the 3D application and for debugging, under `generic`. **Presence reaches Sowel through the motion sensors, not through those devices**: an occupant is not in a zone, it moves between them, so it is not something a person binds to an equipment. What a person binds is a PIR in a room, and that PIR fires because an occupant is in it (simulator spec 001, FR7).
- **Environment** — sun elevation and azimuth (from `home.latitude/longitude`, which a plugin may read), outdoor temperature with a seasonal baseline and a diurnal cycle, weather state (clear, cloudy, rain) that modulates PV and temperature, humidity spike in the bathroom after the morning shower.
- **Thermal** — first-order model per room: setpoint from the heating equipment's orders, loss towards outdoor, solar gain when shutters are open and the sun faces the window. Presence thermostats have something to regulate.
- **Energy** — PV = f(sun elevation, clouds) with a nominal peak; base load; appliances triggered by the agenda (cooking at 19:00, dishwasher after, laundry on Saturday); heat pump draw from the thermal model; controllable flexible loads (water heater, pool pump) that the capacity arbiter (spec 140) can actually allocate surplus to. Grid = load − PV, signed.
- **Ephemeral presence** — a motion pulse of N seconds in a zone, or a temporary ghost occupant that walks where told and expires after two minutes without input, capped at about ten at a time. Triggered only by simulation orders.

**Devices** — the catalogue comes from the core's anonymised showroom fixture (`docs/fixtures/showroom-fr.zip` in `mchacher/sowel`), so the demo home _is_ the shape of the maintainer's home: same zones, same equipment types, same recipes and modes. The fixture build gains one step: rewrite every device's `integration_id` to `simulator` and add the simulator's own devices (occupants, weather station, grid meter, PV inverter). The plugin re-declares those devices through discovery on start so the bindings resolve.

**Orders** — the plugin executes every order the real integrations would (light `power`, shutter `position`, thermostat `setpoint`, heater `mode`…), updates the corresponding reading with a plausible delay, and never throws. In addition, sensors expose **simulation orders** that no real device has: `sim.motion` on a PIR, `sim.open`/`sim.close` on a door contact, `sim.temperature` on a probe, `sim.weather` on the weather station, `sim.enter`/`sim.leave` on an occupant, `sim.ghost` on a zone-level pseudo-device. They are ordinary `DeviceOrder`s so the whole existing plumbing (bindings, aliases, audit, WebSocket) applies.

**Per-target debounce** — the plugin ignores an order on a target that changed less than a few seconds ago. This is where the "ten hands on one lamp" rule lives, since the core has no demo mode.

**Non-goals** — writing InfluxDB history (impossible from a plugin, and not wanted, see decisions); simulating hardware failures (later, could be a nice demo of spec 116 staleness and alarms); anything time-accelerated.

## Component B — demo hardening, outside the core (this repo)

What an earlier draft called "demo mode in the core" is done here, with no product change:

- **Guest session** — the guest is an ordinary `standard` user created by the reset script. The landing page logs in through `POST /api/v1/auth/login` with the guest credentials baked into the showroom and hands the session to the product UI and to the 3D app. Nothing to type.
- **Deny list in the reverse proxy** — spec 131 lets a standard user change their own password, mint API tokens, enrol MFA and register push subscriptions. On a shared account those are attack surface: the proxy answers 403 to `PUT /api/v1/me/password`, `/api/v1/me/tokens*`, `/api/v1/me/mfa/*`, `/api/v1/push/subscriptions`. Mode activation needs #912 in the core; until it lands, the demo simply has no mode switch for visitors.
- **Quotas** — per IP at the proxy (and at Cloudflare in production): one mutation every 2 s, thirty per minute. Per target: the simulator's debounce.
- **Nothing dangerous is reachable** — self-update, plugin management, backup restore, user management are admin-only and the guest is not admin. No notification or MQTT publisher is configured. The Docker socket is never mounted (spec 105).
- **Attribution** — the core's audit log already names the actor (the guest user), the occupants are named devices, and recipes are named. The 3D app's journal reads that log; "a visitor", "Léa", "motion-light" come for free.
- **Banner and visitor count** — in the landing page and the 3D app, not in the product UI. The count is the proxy's or the 3D app's own connection count. A "this is a demo instance" banner in the product UI would be a product issue in `mchacher/sowel`, argued on its own; the showroom does not depend on it.
- **Short overrides** — a visitor's manual action holds for a few minutes before the recipes take over again. This is a recipe parameter (timeouts) set in the demo fixture, not a mechanism.

## Component C — the 3D application (`sowel-house-3d`)

A static web app: Three.js, no backend of its own in v1. Generic: it renders _a_ house for _a_ Sowel instance; the showroom is one deployment.

- **Model** — a plan JSON (rooms as rectangles, walls with door/window openings, door graph for pathing, furniture placements) extruded procedurally; furniture from CC0 low-poly packs; palette from the Sowel design system (ocean blue, amber, warm off-whites). Later: a roof, and solar panels on it.
- **Mapping** — a JSON that ties plan objects to Sowel IDs: `light:salon` → equipment id, `window:salon-1` → shutter equipment, `room:salon` → zone id and the PIR device that carries `sim.motion`, occupant devices → figures. In the showroom it is versioned with the demo fixture: the plan and the fixture change together.
- **Reads** — REST for the initial state, WebSocket for everything after. Lamps glow on `power`, shutters slide on `position`, figures move on an occupant's `zone`, the sky follows the sun and the weather readings, the journal panel shows the activity log.
- **Writes** — clicking a lamp sends the equipment order; a window toggles its shutter; the floor of a room sends `sim.ghost` (v1: the visitor's own ghost walks there) — never moves the household.
- **Visitors** — v1: each visitor sees their own ghost and only the _effects_ of the others (LEDs, lamps, journal, count). Ghosts visible to everyone need a realtime channel Sowel does not give a plugin: v2, with a small WebSocket relay next to the app.
- **Prototype** — `sowel-house-3d/prototype/maison-temoin.html` is the throwaway that validated the look (seven rooms, day cycle, weather, three occupants on an agenda, clickable lamps/shutters/floors, a fake motion-light for narration). It is self-contained and has no link to Sowel; keep it as the visual reference, do not grow it.

### How the 3D application actually calls a simulation order

Established on a stock Sowel 1.68.0 while building simulator spec 002, because it
changes what the 3D application has to know.

**Sowel has no device-level order route.** `POST /api/v1/devices/:id/...` dispatches
nothing; the only path that reaches a plugin's `executeOrder` is
`POST /api/v1/equipments/:id/orders/:alias`. So a `sim.*` order is reachable only
through an **equipment order binding** — which works, takes a free-form alias, needs
no category and needs nothing from the core.

Two consequences:

- The **demo fixture** (simulator spec 003) must create those bindings. A simulation
  order nobody bound is one nobody can call, and the 3D application cannot create
  bindings of its own.
- The 3D application addresses a room by **the equipment id of its sensor**, not by a
  device id. That mapping belongs in the plan JSON it already needs, and it is the
  fixture's to provide.

Asking the core for a device-order route was considered and not taken: the decision
table above says anything the demo needs which the product does not offer is done in
the plugin, the proxy or the 3D app — and this needed nothing at all.

## Component D — operations (this repo)

- **Compose** — `docker-compose.yml`: stock Sowel image, InfluxDB, the reverse proxy (Caddy or nginx) serving the 3D app and the landing page and fronting the API, **no Docker socket**, plugin dir pre-seeded with the simulator, guest credentials in `.env`.
- **Reset** — `scripts/reset.sh`: stop, drop the SQLite volume only, start, run first-admin setup, create the guest user, restore the demo fixture, install the simulator from the registry (or a personal source in dev), verify `/api/v1/health`. Cron nightly at 04:00. Reuses the screenshot pipeline already scripted in the core's `sowel-docs` skill.
- **Fixture** — `fixtures/showroom.zip`, produced from the core's anonymised fixture with the simulator remap. The plan JSON of the 3D app is checked against it.
- **Exposure** — a dedicated VM, Cloudflare tunnel (WAF, rate limit, bot protection), `demo.sowel.org`, link from `docs.sowel.org` and the core README. Private host details go in `sowel-ops`, which must also drop its former demo-host section.
- **Local first** — everything above runs on a laptop with `docker compose up`, before any VM exists.

## Phase 1 is done, and here is what it proved

Walked on a stock Sowel 1.68.0 in Docker: instance wiped, the plugin installed, the
built fixture restored. 92 devices, 86 equipments all `online`, no binding without a
value, 21 of 22 recipe instances started.

**The house automates itself.** `sim.motion` on the cellar's sensor turns occupancy
true, the `motion-light` recipe fires, the lamp comes on attributed to `Motion
Light` in the journal, and the recipe releases it 105 seconds later on its own
timeout. Nobody ordered the lamp.

**And the energy arbiter arbitrates.** A visitor forces the sky sunny:

| t     | PV   | grid     | surplus | tank    | 230 V contact | arbiter     |
| ----- | ---- | -------- | ------- | ------- | ------------- | ----------- |
| 15 s  | 1186 | −767     | −85     | 0       | –             | pending     |
| 150 s | 1221 | −802     | 720     | 0       | –             | pending     |
| 270 s | 1251 | −832     | **808** | 0       | –             | pending     |
| 285 s | 1256 | **−235** | 696     | **600** | **closed**    | **granted** |

The surplus climbs past the 700 W the tank needs, the arbiter grants, the
`water-heater-solar` recipe closes the contact, the compressor draws 600 W. And
`availableSurplusW` falls only from 808 to 696 while the export collapses from
−832 to −235 — because the arbiter knows the collapse is its own grant. That is the
reservation accounting core spec 140 exists for, on a house that belongs to nobody.

**Three things phase 1 found that are worth carrying forward.**

The core's restore reads its column list from the first row of each table and
silently drops the rest ([mchacher/sowel#939](https://github.com/mchacher/sowel/issues/939)),
so a fixture must hand it uniform rows.

A simulated load running on its own schedule is indistinguishable, to the arbiter,
from a human on a wall switch — it suspended itself on the pool pump with the reason
`wall-switch-on`, correctly. Anything the arbiter may claim must be driven only by
orders.

And the recipe packages could not be downloaded from inside the container, which
sits behind a TLS-intercepting proxy. Probably local to that machine, but **the
reset script must fail loudly on a missing package** rather than come up with
twenty-one dead instances.

## The thirty-second visitor, and why the clock is the wrong lever

**Reopened 2026-09-09.** The decision table says _real time only, no accelerated
clock_. The request was for accelerated-time modes a visitor could choose. The
request is right about the problem and, I think, wrong about the lever — so here is
the problem, what cannot work, and what can.

### The problem is real

A visitor watches for thirty seconds. Most of what is worth seeing takes hours: the
sun crossing, the production curve filling, the pool warming by a tenth of a degree,
a thermostat chasing its setpoint, the arbiter granting a load at noon and revoking
it when a cloud passes. A house that lives in real time is honest and, to someone
who has just arrived, indistinguishable from a still photograph.

### An accelerated clock inside the plugin cannot work

Not "is inelegant" — cannot. Sowel keeps its own time, in at least five places the
plugin has no reach into:

| Where                             | What it uses                                                      |
| --------------------------------- | ----------------------------------------------------------------- |
| `src/zones/sunlight-manager.ts`   | `suncalc` on `new Date()` — **the core computes its own sunrise** |
| Mode calendar                     | `croner`, on the real wall clock                                  |
| `src/energy/tariff-classifier.ts` | `getHours()`, for the HP/HC split                                 |
| Energy aggregation                | Day boundaries at real local midnight                             |
| History                           | InfluxDB rows written with real timestamps                        |

Accelerate the simulator and its sun drifts away from the core's. A "shutters at
dusk" recipe then fires against the core's dusk while the simulated sky is still
bright — the two halves of the demo contradict each other, which is worse than a
demo that is merely slow. The same goes for a time offset rather than a rate: the
desynchronisation is the problem, not its direction.

### What works: replay the day, do not live it faster

The visitor wants to **watch** a day, not to **live** in a fast house. Those are
different asks, and only the second one breaks anything.

**1. Seed the history at reset** (phase 2, this repo). The reset script writes
thirty days of synthetic history straight into InfluxDB, computed from the
simulator's own model — possible precisely because simulator spec 001 made the world
a pure function of the clock, so any past instant is computable. A visitor then
lands on **full charts**: today's production curve up to now, the week, the month.
The live series continues them seamlessly. No clock is faked and nothing can
disagree, because history is what history is.

This is the biggest win for the least work, and it is worth noticing why: most of
what takes hours to watch is historical anyway.

**2. A time-lapse in the 3D application** (phase 4). A "revoir la journée" control
that replays the last twenty-four hours from recorded history — the sun crossing,
the shutters moving, the production filling, the arbiter granting at noon — at
whatever speed the visitor likes. It is a **view**, not a clock: the engine keeps
running in real time underneath, and nothing in it is faked. Combined with the
seeded history it works for the very first visitor.

**3. Shorten what is slow** (simulator spec 003, and its open question here). The
recipe timeouts: a motion light that holds for ten minutes is right in a house and
wrong in a demo. Plus the `sim.*` levers that already exist — force the sky and the
production changes within a second, place a ghost and the lamp comes on. Immediate
causality is what thirty seconds actually needs.

### If a genuinely fast house is still wanted

There is exactly one coherent way to do it: **accelerate the whole container, not
the plugin.** A second instance — same image, clock faked for Sowel _and_ InfluxDB
at around twelve times — keeps everything in agreement, because everything is fast
together: the core's own sun, the calendar, the tariff classifier, the history.

It is viable only because the showroom resets nightly, so the faked offset never
grows beyond a dozen days and TLS certificates stay valid. The costs are real: twice
the containers, and the month and year energy views are meaningless on that
instance.

**Recommendation: do 1, 2 and 3, and hold the fast instance** until the real-time
demo exists and we can see whether it is still needed. My expectation is that seeded
history plus a replay removes most of the need, and that what is left — watching a
live day turn — is worth one deliberate second instance rather than a compromise in
the first.

**Status: proposed.** The decision table's _real time only_ still stands for the
main instance, and should, because it is what keeps the history coherent with what a
visitor sees. Nothing above contradicts it; the fast instance in the last section
would, and would need the table amended with it.

## Multi-visitor rules

| Risk                                 | Rule                                                                  |
| ------------------------------------ | --------------------------------------------------------------------- |
| Lamps flicker under ten hands        | Per-target debounce in the simulator, per-IP quota at the proxy       |
| Occupants get dragged around         | Visitors never move the household; they get a ghost of their own      |
| Manual overrides pile up             | Recipe timeouts are short in the demo fixture; agenda reconverges     |
| Nobody understands why it moved      | Journal from the audit log, visitor count in the 3D app               |
| A script hammers the API             | Cloudflare per IP, proxy quota, nightly reset                         |
| The whole thing turns chaotic anyway | Fallback, not v1: one pilot at a time, two-minute slots, others watch |

## Out of scope (recorded so it is not lost)

- Solar panels on the roof, and the roof itself (asked for; last phase).
- Ghosts visible to all visitors (needs a relay; v2 of the 3D app).
- Simulated hardware faults (staleness, offline devices, alarms) — a good later demo of spec 116 and the alarm surfaces.
- A floor-plan editor; the plan is a JSON edited by hand.
- Per-visitor private worlds; a pilot queue (fallback only).
- Any change to the product UI. A demo banner there is a separate product issue.

## Open questions

1. Which real recipes ship in the demo fixture, and which timeouts are shortened for demonstration?
2. Guest session: per-visitor token pair with the standard TTLs (leaning yes), or one long-lived shared token?
3. Proxy: Caddy (simpler config, automatic TLS) or nginx (what most readers know)? Leaning Caddy.
4. Home location for the fixture: keep Paris (current showroom) or a sunnier fictional place for the PV story?
5. Does the 3D app's journal read the audit log (admin-only today) or the activity feed? To check against the core's role gate.

## Development plan

Each phase is one spec, one branch, one PR in its repo, testable on its own. Phases 1–2 do not depend on the 3D work; the 3D depends on them only through the API.

**This table is the cross-repository status.** It is the only place where the
whole project is visible at once, so it is updated at two moments, both written
into each repository's feature skill: to 🚧 when a phase's spec is written, to ✅
when its last pull request merges. Each repository's own `docs/specs-index.md`
carries the detail below a phase, and is CI-gated there.

| Phase | Repository               | What                                                                                                                                                                                                                                                                                                                                                                                                            | Status   |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 0     | `sowel` (core)           | Standard users activate modes ([#912](https://github.com/mchacher/sowel/issues/912), shipped in [#916](https://github.com/mchacher/sowel/pull/916))                                                                                                                                                                                                                                                             | ✅ Done  |
| 1     | `sowel-plugin-simulator` | World model, devices, orders, `sim.*`, demo fixture — three specs, all shipped: [001 the house that lives](https://github.com/mchacher/sowel-plugin-simulator/tree/main/specs/001-world-model), [002 the house that obeys](https://github.com/mchacher/sowel-plugin-simulator/tree/main/specs/002-orders), [003 the demo house](https://github.com/mchacher/sowel-plugin-simulator/tree/main/specs/003-fixture) | ✅ Done  |
| 2     | `sowel-showroom`         | Compose, proxy, reset, demo fixture, landing page                                                                                                                                                                                                                                                                                                                                                               | 📝 To do |
| 3     | `sowel-house-3d`         | Plan, mapping, REST + WS, read-only scene                                                                                                                                                                                                                                                                                                                                                                       | 📝 To do |
| 4     | `sowel-house-3d`         | Clicks, own ghost, journal, visitor count, mobile                                                                                                                                                                                                                                                                                                                                                               | 📝 To do |
| 5     | `sowel-showroom`         | VM, tunnel, `demo.sowel.org`, links, reset monitoring                                                                                                                                                                                                                                                                                                                                                           | 📝 To do |
| 6     | all                      | Roof and solar panels, furniture, faults, shared ghosts                                                                                                                                                                                                                                                                                                                                                         | 📝 To do |

Status: 📝 To do · 🚧 In progress · ✅ Done

**Phase 0, closed 2026-09-06.** A `standard` user activates, deactivates and
applies a mode; defining what a mode _is_ stays admin-only. It carried one
decision the review forced into the open, recorded in the spec 131 amendment:
activating a mode is **not** a pure actuation. A mode's impacts may include
`recipe_toggle` and `recipe_params`, which durably enable, disable or
re-parameterise a recipe — writes a standard user is refused directly, and that
deactivating the mode does not undo. It is kept because an admin authors the
impacts (the visitor chooses _when_, never _what_), and because the calendar and
a physical button already did exactly this with no role attached at all.

For the showroom that means the guest gets a mode switch and cannot reach
anything that defines a mode. No demo-only exception was needed, which was the
point of routing this through the product rather than around it.

```
 Phase 0 ── core: #912 standard users activate modes ──────────────────────┐
            (mchacher/sowel — an ordinary product issue)                    │
                                                                            │
 Phase 1 ── sowel-plugin-simulator v1                                       │
            world model, devices, order execution, simulation orders,       │
            per-target debounce; fixture remap script                       │
            gate: installed on a local stock instance, Energy Live and      │
            the zones fill up, motion-light fires on a simulated occupant   │
                     │                                                      │
 Phase 2 ── sowel-showroom, local ◄─────────────────────────────────────────┘
            compose, proxy with guest login + deny list + quotas,
            reset script, demo fixture, landing page
            gate: `docker compose up` then `scripts/reset.sh` gives a
            living house a fresh browser lands in, logged in, and
            cannot break
                     │
 Phase 3 ── sowel-house-3d, read-only
            plan JSON, mapping, REST + WS, sun/weather, occupants moving,
            lamps and shutters reflecting state
            gate: the 3D view mirrors the product UI with no lag a human
            notices
                     │
 Phase 4 ── sowel-house-3d, interactive
            clicks → orders, own ghost, journal, visitor count, mobile
            gate: click a room in 3D, watch the PIR, the lamp and the
            journal react in the product UI on another screen
                     │
 Phase 5 ── hosting
            VM, tunnel, demo.sowel.org, links from docs/README,
            sowel-ops updated, monitoring of the nightly reset
                     │
 Phase 6 ── polish
            roof and solar panels, richer furniture, weather visuals,
            simulated faults, ghosts visible to all (relay)
```

Rough weight: phases 1, 3 and 4 carry most of the work; 2 and 5 are small; 0 is a one-liner plus tests and docs. Phase 1 alone already pays for itself: it gives the core's docs screenshot pipeline a live instance, which it has been missing.

## Acceptance for this document

Done when every phase above has its own spec referencing it, and the decision table has not been contradicted by any of them without an explicit amendment here.

**What keeps this document true.** Three things, none of them good intentions:

- Each repository's `scripts/check-specs-index.sh` fails a pull request that adds a spec folder without a row in that repository's index. CI-enforced.
- Each repository's feature skill requires the phase status here to move at two named moments, and requires a contradicting spec to amend the decision table in the same pull request.
- The Sowel core's `CLAUDE.md` names the three repositories and links here, so an agent that starts in the core finds the project instead of rebuilding it.

The core learned the underlying lesson the expensive way: its release notes never drifted because a workflow fails on a missing anchor, while its documentation drifted for three months because nothing failed. Same authors, same pace; the difference is the gate.
