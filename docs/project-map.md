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

- **Occupants** — a small household (two adults, one or two children) with weekday and weekend agendas, small randomness, and a position that is a zone. Leaving and returning goes through the entrance (door contact opens). Each occupant is a device: `zone` (enum of zone names + `away`), `present` (boolean).
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

## Component D — operations (this repo)

- **Compose** — `docker-compose.yml`: stock Sowel image, InfluxDB, the reverse proxy (Caddy or nginx) serving the 3D app and the landing page and fronting the API, **no Docker socket**, plugin dir pre-seeded with the simulator, guest credentials in `.env`.
- **Reset** — `scripts/reset.sh`: stop, drop the SQLite volume only, start, run first-admin setup, create the guest user, restore the demo fixture, install the simulator from the registry (or a personal source in dev), verify `/api/v1/health`. Cron nightly at 04:00. Reuses the screenshot pipeline already scripted in the core's `sowel-docs` skill.
- **Fixture** — `fixtures/showroom.zip`, produced from the core's anonymised fixture with the simulator remap. The plan JSON of the 3D app is checked against it.
- **Exposure** — a dedicated VM, Cloudflare tunnel (WAF, rate limit, bot protection), `demo.sowel.org`, link from `docs.sowel.org` and the core README. Private host details go in `sowel-ops`, which must also drop its former demo-host section.
- **Local first** — everything above runs on a laptop with `docker compose up`, before any VM exists.

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

| Phase | Repository               | What                                                                                                                                                | Status   |
| ----- | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 0     | `sowel` (core)           | Standard users activate modes ([#912](https://github.com/mchacher/sowel/issues/912), shipped in [#916](https://github.com/mchacher/sowel/pull/916)) | ✅ Done  |
| 1     | `sowel-plugin-simulator` | World model, devices, orders, `sim.*`, fixture remap                                                                                                | 📝 To do |
| 2     | `sowel-showroom`         | Compose, proxy, reset, demo fixture, landing page                                                                                                   | 📝 To do |
| 3     | `sowel-house-3d`         | Plan, mapping, REST + WS, read-only scene                                                                                                           | 📝 To do |
| 4     | `sowel-house-3d`         | Clicks, own ghost, journal, visitor count, mobile                                                                                                   | 📝 To do |
| 5     | `sowel-showroom`         | VM, tunnel, `demo.sowel.org`, links, reset monitoring                                                                                               | 📝 To do |
| 6     | all                      | Roof and solar panels, furniture, faults, shared ghosts                                                                                             | 📝 To do |

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
