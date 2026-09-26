# Spec 002 — The house over Sowel

**Status**: ✅ Implemented — written after the fact, 2026-09-26, to put on record
work that was built iteratively with the owner at the screen. The 3D application's
half is its spec 003 (`sowel-house-3d`).

## Context

Phase 3 built the 3D house as a static app (`sowel-house-3d`). Phase 2's stack did
not serve it, and a visitor who got past the landing page never saw it again: `/`
routes to the Sowel interface from then on. The owner's ask was to watch the house
react while using Sowel.

Serving it surfaced four bugs every scripted check had passed over, because none of
them opens a page: a WebSocket refused for its Origin, the landing page writing
token keys the interface does not read, a redirect to a host without the port, and
the interface's service worker answering `/maison/` from its cache. Then two
layouts were tried on the running demo: side by side, which the owner found poor,
and a vignette over the interface, which stayed.

## Goals

- The 3D house is served from the same origin as Sowel: one login, one session,
  one host to expose in phase 5.
- From anywhere in the Sowel interface, the house is on screen in a vignette, and
  can go full screen and back without leaving Sowel.
- The published Sowel image stays untouched.
- A visitor never ends up at a login screen they have no password for.

## Non-goals

- Building the 3D app here. The stack mounts a build (`HOUSE_3D_DIST`).
- Clicking in the house. Phase 4.

## Functional requirements

### FR1 — `/maison/`, same origin

nginx serves `${HOUSE_3D_DIST}` read-only at `/maison/` (SPA fallback to its
`index.html`); `/maison` redirects to it. `absolute_redirect off`, so every redirect
is relative: nginx builds absolute ones from `$host`, which drops the port, and the
right host is whatever the visitor typed — behind the phase-5 tunnel it will not be
this one either. `Cache-Control: no-cache` on the app, so a new build is picked up
on the next load.

### FR2 — The session is the product's

The proxy passes `$http_host`, port included: the core allows a WebSocket whose
Origin matches the Host it was reached on, and `Host: localhost` against
`Origin: http://localhost:8080` refused every live update — the interface's own
included. `CORS_ORIGINS` comes from `PUBLIC_ORIGIN`. The landing page writes the
keys the interface reads, `sowel_access_token` and `sowel_refresh_token`.

### FR3 — A neutral service worker

The Sowel image ships a PWA whose worker, at scope `/`, answers every navigation
from its cached shell — so `/maison/` never reached nginx and the visitor landed on
`/login`. The proxy serves its own `/sw.js`: no fetch handler, it deletes the old
worker's caches and, only if there were some, reloads the open pages once. A
first-time visitor is not reloaded under their first click. `no-store` on it, so it
can always be replaced.

### FR4 — Signing out signs out of the demo

The `showroom=entered` cookie routes `/` to the interface; logging out cleared the
tokens and not the cookie, and handed the visitor Sowel's login screen for an
account whose password they were never given. The logout now clears the cookie and
`/` is the landing page again, which signs them straight back in.

### FR5 — The vignette

The proxy injects one script into the interface's HTML (`sub_filter` before
`</body>`, upstream compression off so there is text to filter):
`/showroom-ui/mini-house.js`. A file, because the interface's CSP allows scripts
from its origin and none inline. It draws a small window, bottom right, holding
`/maison/?mini=1`:

- dragged by its bar, resized from its top-left corner, reduced to a "3D" pill;
- full screen over the page by setting the frame's `#full` anchor — no reload —
  and back with the same button or Escape;
- position and size remembered per browser (`localStorage.showroom_mini`), full
  screen not, so a reload never lands anyone under a view that covers Sowel;
- open on a desk, closed on a phone; absent while signed out;
- reduced, the iframe is removed rather than hidden: a WebGL scene behind a pill is
  a phone's battery for nothing.

### FR6 — Framing, only by this origin

`/maison/` sends `frame-ancestors 'self'` and `X-Frame-Options: SAMEORIGIN`; the
Sowel interface keeps the image's `frame-ancestors 'none'`. The side-by-side layout
needed Sowel framed and relaxed that; with the vignette, only the house is framed,
and the relaxation is gone.

### FR7 — The verification opens what a visitor opens

`verify-showroom.sh` checks the framing (Sowel by none, the house by this origin),
that the vignette's script is injected and served, and parses headers by prefix.

## Acceptance criteria

- `verify-showroom.sh` is green.
- In a fresh browser: landing page → dashboard with the vignette → the house reacts
  to a light switched in Sowel → full screen and back → logout → landing page.
- In a browser that had the old PWA worker: `/maison/` serves the house.

## Edge cases

- A visitor on a phone: the vignette starts as the pill.
- The interface navigates without a page load: the script's 2 s watcher follows
  sign-in and sign-out.
- A saved position off screen after a window resize: clamped back on.
