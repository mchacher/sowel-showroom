# Spec 005 — The guided tour

**Status**: 📝 Draft — proposed 2026-09-27, awaiting the owner's validation.

## Context

Spec 004 gave the visitor journeys, and they work: walk into a room, a recipe reacts,
the panel reads the proof. The owner, trying them: _the "Essayer" button and the
menu on the left make no sense; the UX has to be much better._

What is wrong, concretely:

- **Hidden.** "Essayer" is a small amber button in the vignette's title bar, over
  the Sowel interface. A first visitor lands on a dashboard full of numbers and
  does not look there.
- **A wall of text.** The panel lists every journey at once, each with three
  paragraphs and three buttons. It reads like documentation, not like a demo.
- **The wrong stage.** What there is to watch — the figure, the lights, the
  radiator, the fan — is in a 440 px vignette, while the panel and the Sowel
  interface take the rest of the screen. In full screen, the panel sits on the left
  like a menu nobody asked for.
- **No story.** Nothing says where to start, what comes next, or when it is over.
  "Sortir" is a chore the visitor has to remember.
- **The "why" is missing.** The point — _a recipe did this_ — is a sentence in
  grey. The recipe itself, its rule, is never shown.

## Goals

- A first-time visitor **understands what Sowel does in under three minutes**,
  without reading more than two lines at a time.
- **One thing at a time**: one step, one action, one thing to watch.
- **The house is the stage**: the 3D takes the screen during the tour.
- **Show the rule**: each step ends on the recipe that did it, in plain words,
  read from Sowel — not paraphrased by the showroom.
- **Then let go**: the tour ends in Sowel's own interface, where the visitor can
  explore freely, with the vignette.

## Non-goals

- Seeing the other visitors in the 3D, and a visitor count. A real need (see
  "Several visitors" below) with its own spec.
- New recipes. The temperature-threshold recipe stays its own increment.
- Changing the Sowel interface. The core is untouched; the tour is the showroom's.

## Functional requirements

### FR1 — Two ways in, from the landing page

The landing page offers two buttons, the first one primary:

```
┌───────────────────────────────────────────────┐
│  Une maison qui vit, et que vous pouvez       │
│  manipuler.                                   │
│                                               │
│  [ ▶ Visite guidée · 2 min ]  [ Explorer Sowel ]│
└───────────────────────────────────────────────┘
```

- **Visite guidée** opens the tour (`/visite`).
- **Explorer Sowel** goes to the Sowel interface, as today.

Both log in as the guest the way the page does today.

### FR2 — The tour is a page of its own, the 3D full screen

`/visite` is a showroom page: the 3D house fills the screen, and a **story card**
sits over it — bottom left on a desk, a bottom sheet on a phone.

```
┌──────────────────────────────────────────────────────────────┐
│ Sowel · visite guidée                 ● ● ○ ○ ○    FR/EN   ✕  │
│                                                              │
│                  [ the house, in 3D, live ]                  │
│                                                              │
│ ┌──────────────────────────────┐                             │
│ │ 2 / 5 · Chambre d'enfant      │                             │
│ │ Entre dans la chambre.        │                             │
│ │                               │                             │
│ │ [ ▶ Y aller ]                 │                             │
│ └──────────────────────────────┘                             │
└──────────────────────────────────────────────────────────────┘
```

The header: a progress of dots, the language, and ✕ which leaves for the Sowel
interface.

### FR3 — A step has three moments

Each step moves through the same three moments, in the same card:

1. **Do** — one sentence, one button. "Entre dans la salle de bain." `[▶ Y aller]`
2. **Watch** — the button is gone; the 3D frames the room and the figure walks;
   the card shows **one live line** and says what to look at. The moment it
   happens, the line turns green: "✓ La lumière s'est allumée."
3. **Why** — the card turns over to the rule that did it, **read from Sowel**:
   the recipe's name and its parameters in plain words, and a link to it.

```
 Do                         Watch                        Why
┌─────────────────────┐    ┌─────────────────────┐    ┌──────────────────────────┐
│ 1/5 · Salle de bain │    │ 1/5 · Salle de bain │    │ 1/5 · Pourquoi ?         │
│ Entre dans la salle │    │ Regarde la lumière… │    │ Recette « Motion Light » │
│ de bain.            │ →  │                     │ →  │ Quand quelqu'un est      │
│                     │    │ ✓ Lumière allumée   │    │ détecté dans Salle de    │
│ [ ▶ Y aller ]       │    │                     │    │ bain → allumer la lampe, │
└─────────────────────┘    └─────────────────────┘    │ éteindre 5 s après.      │
                                                      │ Voir dans Sowel ↗        │
                                                      │ [ Suivant → ]            │
                                                      └──────────────────────────┘
```

- **No "Sortir".** The next step walks the figure where it goes next; the last one
  walks it out of the house. Leaving a room is part of what there is to watch.
- **If nothing happens** within twenty seconds — another visitor, the night
  window, bright daylight — the card says so honestly and still shows the rule,
  which is what explains it: "Il fait assez clair (2 400 lx > 2 300 lx) : la
  recette n'allume pas. C'est voulu."
- **Voir dans Sowel** opens the recipe's room in the Sowel interface, in a new
  tab: the tour stays where it is.

### FR4 — The steps

| #   | Room             | Do                             | Proof (live line)                               | Why (the recipe, from Sowel)                |
| --- | ---------------- | ------------------------------ | ----------------------------------------------- | ------------------------------------------- |
| 0   | —                | "Voici la maison, en direct."  | the time, the sun, who is home                  | the house is simulated; Sowel runs it       |
| 1   | Salle de bain    | Entre dans la salle de bain    | the lamp on                                     | Motion Light                                |
| 2   | Chambre enfant 2 | Entre dans la chambre          | the radiator: eco → comfort                     | Presence Heater (day window said)           |
| 3   | Séjour           | Installe-toi au séjour         | luminosity against the threshold; the lights    | Motion Light Dimmable                       |
| 4   | Bureau           | Ouvre la fenêtre du bureau     | 19 → 15 °C, the heat pump starts, its fan turns | none: the heat pump's own regulation — said |
| 5   | —                | "À toi." The figure walks out. | the lights going off behind it                  | → the Sowel interface, the vignette         |

Step 0 lasts as long as the visitor wants; step 5 has two buttons: **Explorer
Sowel** (the dashboard, the vignette open) and **Recommencer**.

Day and night change the words, never the order: step 3 at night says the lights
come on dimmed; step 2 between 21:00 and 9:00 says the recipe holds eco at night
and shows it.

### FR5 — The 3D frames the step

During the tour the 3D is the stage, so it shows what the step is about:

- the camera **frames the step's room** (a new anchor, `focus=<room>`, house-3d);
- the storey follows the figure as it walks (house-3d spec 005, as today);
- the HUD shows only the sun dial and the storey switch: the room list, the
  status line and "Ouvrir Sowel" are the tour's to replace.

### FR6 — The vignette in Sowel loses its panel

In the Sowel interface, the vignette stays — the house beside the interface is
right — but the "Essayer" button and its panel go. In their place, a **Visite
guidée** link in the vignette's bar takes the visitor back to `/visite`.

### FR7 — Phone first

On a phone in portrait, the 3D takes the top two thirds and the card the bottom
third, full width; buttons are thumb-sized. The tour must be comfortable there:
that is where a shared link is opened.

## Several visitors

The owner asked what happens when several visitors act at once. One shared house:
the last order wins; each visitor has their own ghost, so one leaving a room does
not switch the light off on another; the simulator's debounce keeps a lamp from
strobing; the proxy rate-limits each address. What the tour must do about it is
**be honest**: the live line reads what Sowel says, not what the step expected, and
"if nothing happens" (FR3) covers another visitor turning the light off. Seeing the
others — their figures, a count, a journal of who did what — is the next spec.

## Acceptance criteria

- [ ] AC1 — From the landing page, a first visitor reaches step 1 in one click.
- [ ] AC2 — Each step shows its proof, or says honestly why not, within twenty
      seconds of its button.
- [ ] AC3 — No card shows more than two sentences at once, except "Why".
- [ ] AC4 — "Why" names the recipe and its rule from Sowel's own recipe instance:
      change a timeout in the fixture and the card says the new one.
- [ ] AC5 — The whole tour takes under three minutes at a normal pace.
- [ ] AC6 — Usable on a phone in portrait (walked on a 390 × 844 viewport).
- [ ] AC7 — The Sowel interface keeps its vignette, without "Essayer" or its panel.

## Edge cases

| Case                                        | Behaviour                                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------------------------- |
| The session expires mid-tour                | The page logs in again as the guest, silently, as the landing page does.                    |
| No WebGL                                    | The tour runs as cards only; the live lines still tell the story.                           |
| The visitor closes the tab mid-step         | The ghost expires after two minutes (simulator spec 002, FR4); nothing to clean up.         |
| A step's room has been changed by the owner | The step names its room by zone name; a missing zone skips the step, logged in the console. |
