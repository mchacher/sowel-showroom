# Spec 004 — The thirty-second visitor

**Status**: 📝 Draft, for review. First increment: walk into the bathroom.

## Context

A visitor gives the demo thirty seconds. The house is live and the charts are full
(spec 003), but nothing tells a visitor what to try, and what makes Sowel worth
looking at — recipes reacting to what happens in the house — is exactly what a
visitor does not stumble on. Clicking a lamp on and off shows a switch, not Sowel.

The owner, 2026-09-27: guided journeys in the live house, **built on recipes that
react to presence and to temperature — that is the whole point of Sowel**. Not a
replay of the past (discussed and set aside: Sowel's own interface cannot follow
the 3D back in time, and its pages already show the past), and not the visitor
driving equipments by hand.

The visitor acts on the world, never on the equipment: they walk into a room, the
simulator's ghost (simulator spec 002, FR4) makes the room's sensor see somebody,
and a recipe decides what happens. The visitor watches Sowel do it.

## Goals

- A panel, "Essayer", on the vignette: a few journeys, one click each.
- Each journey says what to do, does it, and says where to look.
- First increment: **"Entrer dans la salle de bain"** — the light comes on whatever
  the time of day, then goes off once the visitor has left.

## Non-goals

- Driving equipments by hand. The product's own pages do that already.
- The other journeys; they are listed below, for the next increments.

## Functional requirements

### FR1 — The "Essayer" panel

A button on the vignette's bar opens a small panel of journeys. Each journey is a
line: what it is, a button that does it, and after the click, what to watch — in
the 3D, and where in Sowel. Absent while signed out, like the vignette.

### FR2 — The visitor is a figure that walks

The owner: _a character that moves, to make it visual — something like a toy figure,
but not so much that the brand would object._

The visitor is drawn in the 3D house as a small toy-like figure (house-3d spec 005)
that **walks**: from the front door, through the plan's doors and up its stairs, to
the room the journey names. The 3D app, which holds the visitor's session, moves the
visitor's ghost room by room as the figure enters each one — the `sim.ghost` order on
the house's "Simulation" equipment, `<visitor id>:<room>`, through the public API.
So the lights come on along the way, each at the moment the figure walks in, and what
the visitor sees and what Sowel does never disagree.

The panel starts a walk by setting the frame's anchor (`#walk=salle-de-bain`); the
visitor id is random, kept in `localStorage` on this origin, shared by the panel and
the 3D. Two browsers are two figures and two ghosts; nobody moves the household.

Each visitor sees their own figure. Everybody seeing everybody is a next increment
(below).

### FR3 — Increment 1: walk into the bathroom

- **"Entrer dans la salle de bain"**: the vignette turns to the upper storey, the
  figure appears at the front door and walks to the bathroom — hall, stairs, landing,
  bathroom — each light coming on as it walks in. In the bathroom, the motion-light
  recipe switches the lamp on **whatever the time of day**: no luminosity threshold,
  not disabled by daylight.
- The panel says: the lights came on because recipes saw you, and links to the
  bathroom's page in Sowel.
- **"Sortir"**: the figure walks back down and out of the front door; the lights go
  off behind it, a minute after it has left each room.

This needs, in the demo fixture (simulator spec 003, amended): a motion sensor in the
bathroom, and a motion-light instance on it — one-minute timeout, no threshold, not
disabled by daylight.

## Acceptance criteria

- As the guest, in daylight and at night: the figure walks from the front door to the
  bathroom in under twenty seconds, and each light on its way comes on as it enters;
  the bathroom lamp is on when it arrives, in the vignette and in Sowel.
- "Sortir": the figure walks out; each light goes off within ninety seconds of it
  leaving the room.
- Two browsers are two figures and two ghosts: one leaving does not switch the
  other's light off.

## Edge cases

- The visitor clicks twice: the same ghost, placed twice; nothing strobes (the
  simulator's debounce, and one ghost per visitor).
- The token has expired: the panel says so rather than failing silently.
- More than ten visitors at once: the oldest ghost is dropped (simulator FR4); that
  visitor's light goes off early. Acceptable.

## Next increments (recorded, not specified)

From the discussion of 2026-09-27, in the order worth doing:

| #   | Journey                                                                                   | Needs                                                                             |
| --- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| P2  | Walk through the house: hall › stairs › bedroom, the lights following                     | the panel moving the ghost on a path                                              |
| P3  | Settle in the living room: no light if bright enough, a dimmed one in the evening slot    | nothing — the dimmable recipe does it; explain the threshold                      |
| P4  | Leave a room: the house goes back to sleep behind you                                     | shorter timeouts in the fixture (living room, kitchen: 10 min)                    |
| T1  | Walk into child's room 2: the radiator goes to comfort, the temperature climbs            | heater and thermostat absence timeouts shortened (15 min)                         |
| T2  | Walk into the empty house (weekday daytime): the heat pump back from eco 17 °C to 20 °C   | the same; the heat pump's fan turning in the 3D when it heats                     |
| T3  | Let the cold in (living room forced to 16 °C): the regulation heats back to the setpoint  | `sim.temperature` from the panel; the temperature on the room                     |
| —   | The showcase: back home on a winter evening — lights, heat pump, consumption, all at once | P2 + T2                                                                           |
| —   | Too hot: past a threshold, Sowel closes the shutters on the sunny side                    | **a new recipe package, to create**: none reacts to a temperature threshold today |
| —   | Show the reasoning: each journey links to the recipe's log                                | a way to reach a recipe's log from a link in Sowel's interface                    |
