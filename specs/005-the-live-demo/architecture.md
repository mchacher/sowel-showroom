# Architecture — spec 005

## The pieces

```
compose
  proxy        nginx — the public door; routes visitors' orders to the queue, and /queue/
  queue        NEW — a small Node service, no dependency, in memory: the queue, its record,
               and the journal's feed from Sowel
  sowel        stock image, untouched
  influxdb

landing/showroom-ui/
  mini-house.js   the floating window (spec 004), now the demo: the 3D, the journal, the
                  strip with the queue and the actions, "Suivre"
```

No new page: the window's script already runs inside the Sowel interface, on every page
the proxy serves it. It can therefore:

- navigate Sowel's router (`history.pushState` and a `popstate` event) to a room's page
  when "Suivre" is on;
- find the card and the recipe row by their text, and draw the highlight and the bubble
  in an overlay of its own, positioned over them. Nothing is written into Sowel's DOM,
  which would re-render it away.

## The queue

One file, `node:24-alpine`, no dependency, in the compose file:

- **In**: `POST /queue/journey` from the window (a journey), and, through the proxy,
  every visitor order — equipment and zone orders, mode activations, timed actions: the
  proxy sends the writes its allowlist marks `queue` to the service instead of to Sowel.
  The visitor is the `showroom_visitor` cookie, set by the window; one pending action
  each. The answer is immediate — `200 {"success": true, "queued": n}`, which the
  interface reads as success — or `409` with a message when one is already pending.
- **Out**: `GET /queue/stream`, server-sent events: the queue, the running action, the
  visitors connected, and the journal. A stream is also the visitor's presence: gone for
  30 s, their pending action goes.
- **Running**: an order is forwarded to Sowel on the compose network with the visitor's
  own bearer token (kept from the request), then the house is held 3 s. A journey is a
  slot of 20 s given to its visitor: their window walks the figure and sends the
  journey's orders (the ghost, a simulated temperature), which the queue forwards at
  once because they come from the slot's holder.
- **The journal's feed**: the service logs in as the guest and holds **one** WebSocket to
  Sowel, subscribed to `activity`: detections, and each order with the recipe or mode
  that sent it. It merges them with its own record of who did what, keeps the last
  hundred lines, and sends them on the stream. One connection to Sowel for everybody,
  rather than one each — the core rate-limits every visitor together (spec 001's walk).

The proxy's write allowlist (spec 001, amended) still decides what may be written at
all; the queue only decides when.

## The 3D

Two generic additions to sowel-house-3d (its spec 005, amended): a walk may say whose it
is — `walk=<room>&who=Visiteur 3&me=0` — so the window can walk someone else's figure,
grey and named, beside the visitor's own; and a walk with `me=0` sends no ghost order,
since that visitor's own window does.
