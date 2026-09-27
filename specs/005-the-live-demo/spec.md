# Spec 005 — The live demo: Sowel and the house, side by side

**Status**: 📝 Draft — the owner chose the direction on 2026-09-27 from three HTML
mock-ups (a guided tour, Sowel and the house side by side, the house with a journal of
causes): the second, with the third's journal, and a queue for what visitors do.
Awaiting validation of this text.

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

### FR1 — One page, two halves

`/demo` is the showroom's page, and the landing page's one button leads there.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ DÉMO EN DIRECT · choisis une action à droite     5 visiteurs · Quitter     │
├──────────────────────────────────────────┬─────────────────────────────────┤
│ Sowel — the real interface               │ The house, live (3D)            │
│  ● Sowel suit l'action en cours [Suivre] │   ┌─────────────────────────┐   │
│  Salle de bain                           │   │         [3D]            │   │
│  [Lumière: Allumée]  [Détecteur] [Temp]  │   │ ┌ journal ──────────┐   │   │
│  Recettes: [Motion Light · a agi]        │   │ │16:32 Motion Light…│   │   │
│   ╰─ "C'est elle qui a allumé."          │   └─┴───────────────────┴───┘   │
│                                          │ File d'attente                  │
│                                          │  EN COURS Visiteur 3 · SdB  12 s│
│                                          │  2e · toi  Bureau          ~25 s│
│                                          │ Ajoute une action : [..] [..]   │
└──────────────────────────────────────────┴─────────────────────────────────┘
```

- **Left**: the Sowel interface, as it ships, framed from the same origin.
- **Right**: the 3D house with the journal over it (FR4), the queue (FR3), and the
  actions to add (FR2).
- **On a phone**, stacked: the 3D and its journal, the queue, then Sowel.

### FR2 — Actions

The right half lists what a visitor can do — the journeys of spec 004: walk into the
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
- **Sowel follows**: when an action starts, the left half opens the page of its room
  and points at what changed — the card, the recipe — with a short bubble ("Cette
  recette a vu Visiteur 3 entrer, et a allumé").

**Suivre** is on by default and can be turned off: a visitor browsing Sowel is not
dragged away by someone else's action. Their own action always brings them back.

### FR6 — Who is who

A visitor is "Visiteur N", given on arrival and kept for the visit (the id of spec 004,
now also a cookie, so a click in the Sowel frame carries it). Their own lines and action
read "Toi".

## Acceptance criteria

- [ ] AC1 — From the landing page, one click opens `/demo` with Sowel and the house.
- [ ] AC2 — Two browsers: an action from each runs one after the other; both see the
      queue, both see each action run, and both journals read the same.
- [ ] AC3 — A lamp switched from its card in Sowel appears in the queue, runs, and stays
      in the journal with who did it.
- [ ] AC4 — A visitor cannot queue a second action while theirs waits.
- [ ] AC5 — With "Suivre" on, the Sowel half opens the running action's room and points
      at the recipe that acted; with it off, it stays where the visitor is.
- [ ] AC6 — Usable on a phone in portrait (390 × 844).
- [ ] AC7 — The core is untouched: the stock image, no plugin but the simulator.

## Edge cases

| Case                                             | Behaviour                                                                                           |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| The queue service is down                        | Actions are refused with a clear message; browsing still works; the reset's checks catch it.        |
| The visitor holding the running action leaves    | Their walk still completes (the ghost expires on its own); the queue moves on at its time.          |
| A pointed-at element is not on the page          | The bubble shows at the top of the Sowel half instead: the story holds even if the interface moves. |
| Night, bright daylight, another visitor's effect | The journal reads what Sowel says; the bubble says why nothing lit ("il fait assez clair").         |
