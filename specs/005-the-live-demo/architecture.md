# Architecture — spec 005

## The pieces

```
compose
  proxy        nginx — the public door; now also routes visitors' orders to the queue
  queue        NEW — a small Node service, no dependency, in memory: the queue and its record
  sowel        stock image, untouched
  influxdb

landing/
  index.html           one button: "Entrer dans la démo" → /demo
  demo/
    index.html         FR1: the two halves, the queue, the actions, the journal
    demo.js            the page: follows the queue (SSE), drives the Sowel frame and the 3D
  showroom-ui/
    mini-house.js      the vignette stays for Sowel opened alone; its "Essayer" panel goes
```

## Sowel in a frame

The page frames the Sowel interface from the same origin. Sowel's own headers refuse
every frame; the proxy relaxes that **for this origin only** (`frame-ancestors 'self'`,
`X-Frame-Options: SAMEORIGIN`), which `verify-showroom.sh` checks the way it checks the
3D's today. Same origin means the page can:

- navigate the frame's router (`history.pushState` and a `popstate` event) to a room's
  page when "Suivre" is on;
- find the card and the recipe row by their text, and draw the highlight and the bubble
  in the page, positioned over the frame's elements. Nothing is written into Sowel's
  DOM, which would re-render it away.

The vignette script sees it is framed and stays out, as it already does.

## The queue

A service of a few hundred lines, one file, `node:24-alpine`, in the compose file:

- **In**: `POST /queue` from the page (a journey) and, through the proxy, every visitor
  order (`POST` equipment and zone orders, mode activations, timed actions) — the proxy
  sends those to the queue instead of to Sowel. The visitor is the `showroom_visitor`
  cookie; one pending action each. The answer is immediate: `202` with the position,
  and a body the interface reads as success, so a click in Sowel does not show an error.
- **Out**: `GET /queue/stream`, server-sent events — the queue, the running action and
  the record — to every page.
- **Running**: an order is forwarded to Sowel on the compose network with the visitor's
  own bearer token (kept from the request), then held 3 s. A journey is a slot of 20 s
  given to its visitor: their page walks the figure and sends the ghost's orders, which
  the queue forwards at once because they come from the slot's holder.
- **Record**: the last hundred actions, in memory; a reset empties it with the rest.

The proxy's write allowlist (spec 001, amended) still decides what may be written at
all; the queue only decides when.

## The journal

The page merges the queue's record (SSE) with Sowel's activity feed (`activity.added`
on the WebSocket, which the guest's session already receives), sorted by time, and
draws it over the 3D frame — in the page, not in the 3D app, which stays generic.

## The 3D

Two generic additions to sowel-house-3d (its spec 005, amended): a walk may carry a
label and whose it is (`walk=<room>&who=Visiteur 3&me=0`), so the page can walk someone
else's figure grey and named; and the frame does not send the ghost's orders itself
when the page says so (`ghost=page`), because in the demo the page sends them for the
slot's holder only.
