# Architecture — spec 005

## Where it lives

```
sowel-showroom/landing/
  index.html            FR1: two buttons instead of one
  visite/
    index.html          FR2: the page — the 3D frame, the card, the header
    tour.js             the steps (data), the three moments, the live reads
  showroom-ui/
    mini-house.js       FR6: the vignette without the panel, a "Visite guidée" link
    journeys.js         the journeys' data and live reads, shared with tour.js
```

The page is static, served by the proxy like the landing page. It talks to Sowel
through the public API with the guest's session, and to the 3D through the frame's
anchor — the same two channels the vignette uses today (spec 004).

**The journeys' data and their live reads move out of `mini-house.js`** into
`journeys.js`, loaded by both. `mini-house.js` keeps only what the vignette needs.

## The 3D

One new anchor in sowel-house-3d (its spec 003, amended): `focus=<room>` frames a
room — the camera's target on the room's centre, the distance to fit it — without
changing the storey rule. And `tour` hides what the tour replaces (FR5): the room
list, the status line, "Ouvrir Sowel". Both generic: any page embedding the house
can use them.

## "Why", from Sowel

`GET /api/v1/recipe-instances` (readable by the guest since spec 001's amendment)
gives each instance's `recipeId` and `params`. The card finds the instance by
recipe and zone, and renders its rule from a small table of templates, one per
recipe it knows:

```
motion-light:           "Quand quelqu'un est détecté dans {zone} → allumer {lights},
                         éteindre {timeout} après."
motion-light-dimmable:  "… seulement sous {luxThreshold} lx, à {slot} % entre …"
presence-heater:        "Présence dans {zone} → confort ; vide depuis {timeout} → éco ;
                         la nuit ({nightStart}–{nightEnd}), éco."
```

The numbers come from Sowel; the sentence around them is the showroom's. A recipe
without a template shows its name and a link, nothing invented.

## Why not in the 3D app

The tour's content — which rooms, which recipes, what to say — is this demo's, not
the 3D app's, which stays generic. The 3D app gains two generic anchors; the story
stays here.
