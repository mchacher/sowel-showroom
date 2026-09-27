# Spec 005 — The live demo: Sowel, and the house beside it

**Status**: 🚧 Validated by the owner on 2026-09-27, in implementation. The direction
was chosen from three HTML mock-ups (a guided tour, Sowel and the house side by side,
the house with a journal of causes): the second, with the third's journal, a queue for
what visitors do — and the house kept in its **floating window** over Sowel rather than
docked beside it (owner, the same day).

## Context

Spec 004 gave the visitor journeys, and they work: walk into a room, a recipe reacts,
the panel reads the proof. The owner, trying them: _the "Essayer" button and the menu on
the left make no sense; the UX has to be much better._

- **Hidden.** "Essayer" is a small button in the vignette's title bar; a first visitor
  lands on a dashboard full of numbers and never looks there.
- **A wall of text.** Every journey at once, three paragraphs and three buttons each.
- **The wrong stage.** What there is to watch is in a 440 px vignette.
- **No cause shown.** _A recipe did this_ is a grey sentence; the recipe is never seen
  acting in Sowel.
- **Several visitors** act on one shared house, and nobody sees who did what: B sees a
  light go off and does not know why.

## The idea

**The visitor acts in the house; Sowel reacts under their eyes.** Sowel's own interface
is the story: the page of the room opens, the card that changed lights up, the recipe
that acted is pointed at. Beside it, the house in 3D, with a journal of what just
happened. Everybody is there at once; what they do goes through **one queue, shown to
all**, so each action is seen, and seen to be someone's.

## Goals

- A first visitor understands what Sowel does in **under two minutes**.
- **Cause and effect are visible**: what was seen, which recipe acted, what it did.
- **Several visitors share the house without confusion**: one action at a time, who
  did it said, and a queue anyone can read.
- **The real product tells the story**: the Sowel interface, stock, not a copy of it.

## Non-goals

- A single pilot at a time: everybody browses and acts; only the execution is serial.
- Showing every visitor as a figure in the 3D — only the one whose action is running
  (FR5).
- Anything in the core. The interface is stock; the queue and the page are the
  showroom's.

## Functional requirements

### FR1 — Sowel, and the house in its floating window

The Sowel interface takes the whole screen, as it ships. Over it, the **floating window
of spec 004** — moved, resized, reduced to a pill, opened full screen — now holds the
demo:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Sowel — the real interface, full screen                                      │
│  Salle de bain                                                               │
│  [Lumière: Allumée]  [Détecteur]  [Temp]                                     │
│  Recettes: [Motion Light · a agi]          ┌──── Maison 3D · 5 visiteurs ──┐ │
│   ╰─ "Cette recette a vu Visiteur 3…"      │            [3D]               │ │
│                                            │ ┌ journal ─────────────┐      │ │
│                                            │ │16:32 Motion Light → …│      │ │
│                                            │ └──────────────────────┘      │ │
│                                            ├───────────────────────────────┤ │
│                                            │ ▶ Visiteur 3 · salle de bain  │ │
│                                            │   Toi · 2e · ~25 s   [Suivre] │ │
│                                            │ [SdB] [Chambre] [Séjour] [..] │ │
│                                            └───────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **The 3D**, with the journal over it (FR4).
- **Below it, a strip** that folds away: the running action, the visitor's own place in
  the queue, "Suivre", and the actions to add (FR2). Unfolded, the whole queue.
- **The "Essayer" button and its panel go.**
- **On a phone**, the window is a bottom sheet: the 3D and the strip, over Sowel.

### FR2 — Actions

The strip lists what a visitor can do — the journeys of spec 004: walk into the
bathroom, go to child's room 2, settle in the living room, open the office window.
Choosing one **adds it to the queue**; it does not happen at once.

**What a visitor does in Sowel goes to the queue too** (owner, 2026-09-27): switching a
lamp from its card, activating a mode, a timed action. Nothing a visitor does reaches
the house except through the queue.

**One pending action per visitor.** While theirs waits or runs, the actions are shown
greyed with where theirs stands; a second click in Sowel says so in a toast. Nobody can
fill the queue alone.

### FR3 — The queue

One action runs at a time, in order of arrival, and everybody sees the same list: the
running action (who, what, how long left), then those waiting, the visitor's own
marked.

How long an action holds the house:

| Action                         | Holds                                       |
| ------------------------------ | ------------------------------------------- |
| A journey (a walk, the window) | 20 s — the walk, and time to see the effect |
| An order clicked in Sowel      | 3 s — done at once, then a pause to see it  |

It is not a long wait: with ten visitors each waiting with a journey, the last waits
about three minutes. A visitor who leaves the page loses their pending action (no
heartbeat for 30 s).

### FR4 — The journal, over the 3D

A small translucent panel over the 3D, newest on top, that **keeps every action,
however fast it went** (owner: a click is over in an instant, so the journal is what
shows it happened):

```
16:32:07  Lumière salle de bain : allumée
16:32:07  Motion Light : présence → allumer          (a recipe, in amber)
16:32:06  Détecteur salle de bain : présence
16:31:55  Visiteur 3 entre dans la salle de bain     (an action from the queue)
16:31:40  Visiteur 5 : Lumière séjour → allumée      (a click in Sowel, queued)
```

Two sources, merged by time:

- **the queue's own record**: who did what, clicked or chosen, when it ran;
- **Sowel's activity feed** (`activity.added` over the WebSocket): what was detected,
  each order with the recipe or mode that sent it.

It shows the last twenty lines and scrolls back to the last hundred; a visitor who
arrives sees the recent history, not an empty box.

### FR5 — Everyone watches the running action

While an action runs, every visitor's page shows it:

- **the 3D** walks the running visitor's figure, labelled with their name ("Visiteur
  3"): amber when it is the viewer's own, grey otherwise;
- **Sowel follows**: when an action starts, the interface opens the page of its room.
  The words — "Motion Light t'a vu entrer, et a agi" — are in the window, under the
  running action. Nothing is drawn over Sowel (amended the same day: a thick amber ring
  and a bubble, then a pulsing wash, were each "moche" — the page and the words say it).

**Suivre** is on by default and can be turned off: a visitor browsing Sowel is not
dragged away by someone else's action. Their own action always brings them back.

### FR6 — Who is who

A visitor is "Visiteur N", given on arrival and kept for the visit (the id of spec 004,
now also a cookie, so a click anywhere in Sowel carries it). Their own lines and action
read "Toi".

## Acceptance criteria

- [x] AC1 — From the landing page, one click opens Sowel with the house's window open.
- [x] AC2 — Two browsers: an action from each runs one after the other; both see the
      queue, both see each action run, and both journals read the same.
- [x] AC3 — A lamp switched from its card in Sowel appears in the queue, runs, and stays
      in the journal with who did it.
- [x] AC4 — A visitor cannot queue a second action while theirs waits.
- [x] AC5 — With "Suivre" on, Sowel opens the running action's room and points
      at the recipe that acted; with it off, it stays where the visitor is.
- [x] AC6 — Usable on a phone in portrait (390 × 844).
- [ ] AC7 — The core is untouched: the stock image, no plugin but the simulator.

## Edge cases

| Case                                             | Behaviour                                                                                     |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| The queue service is down                        | Actions are refused with a clear message; browsing still works; the reset's checks catch it.  |
| The visitor holding the running action leaves    | Their walk still completes (the ghost expires on its own); the queue moves on at its time.    |
| A pointed-at element is not on the page          | The bubble shows at the top of the page instead: the story holds even if the interface moves. |
| Night, bright daylight, another visitor's effect | The journal reads what Sowel says; the bubble says why nothing lit ("il fait assez clair").   |
