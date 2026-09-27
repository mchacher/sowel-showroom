# Spec 001 — The showroom stack

**Status**: ✅ Implemented — walked from a clean checkout, twice
**Phase**: 2 of the [project map](../../docs/project-map.md)
**Depends on**: `sowel-plugin-simulator` v0.2.0 and its demo fixture (phase 1, done)

## Context

Phase 1 built a house that lives, obeys and automates itself. Nobody but its author
can reach it: it runs on a laptop, behind a hand-made admin account, with the
plugin installed by inserting a row into SQLite.

This spec is the difference between that and a URL. It is deliberately the small
phase — compose, a reverse proxy, a reset script, a landing page — and it is the
one that turns the work so far into something a stranger can use.

Hosting is phase 5 and needs a machine this repository does not have. Everything
here runs on `localhost` and must keep doing so: **a demo whose only environment is
production is a demo nobody dares touch.**

## Goals

- `docker compose up -d && scripts/reset.sh` gives a living house a browser lands
  in, already logged in, and **cannot break**.
- What a visitor can do is safe by construction, not by obscurity.
- The reset is one command and leaves the instance in exactly the same state every
  night.
- Nothing installation-specific is in this repository.

## Non-goals

| Not here                                      | Where                                                                                                 |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| The VM, DNS, the tunnel, `demo.sowel.org`     | Phase 5. This spec's output is what phase 5 deploys.                                                  |
| The 3D application                            | Phases 3 and 4. The landing page leaves a place for it.                                               |
| TLS certificates                              | The tunnel's, in phase 5. Locally it is plain HTTP on a loopback port.                                |
| Seeding InfluxDB with a synthetic past        | Proposed in the project map, not decided. This spec does not preclude it: the reset keeps InfluxDB.   |
| Shortening the demo fixture's recipe timeouts | The last open question of simulator spec 003, and a tuning pass over the fixture, not infrastructure. |

## Functional requirements

### FR1 — One command from zero

```bash
cp .env.example .env     # once
docker compose up -d
scripts/reset.sh
```

After that the browser finds a populated, moving Sowel at the configured port, and
no step was typed into a UI. If the reset needs a hand step it is not done.

`reset.sh` is idempotent: running it twice gives the same house, not a second one.

### FR2 — The guest account, and why its password is public

The reset creates one `standard` user. The landing page logs in as that user with
credentials baked into the page, so a visitor types nothing.

**That password is public by design**, and saying so is the point. The security
property this spec defends is _what a guest can do is safe_, never _nobody knows
the password_. A demo whose safety rests on a secret shipped to every browser would
be pretending.

So the question is only: what can a `standard` user do? The core's own
`STANDARD_WRITE_ALLOWLIST` answers it exactly (`src/auth/auth-middleware.ts`), and
the deny list below is **derived from that list**, not guessed at.

### FR3 — The deny list

Everything a `standard` user may write, and what the showroom does with it:

| Allowed by the core                                                 | Showroom | Why                                                                                                                |
| ------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| `POST /equipments/:id/orders/:alias`                                | **keep** | This is the demo.                                                                                                  |
| `POST /zones/:id/orders/:key`                                       | **keep** | All lights off, all shutters closed.                                                                               |
| `POST /modes/:id/activate` · `/deactivate` · `/apply-to-zone/:zone` | **keep** | Day / evening / night — core [#912](https://github.com/mchacher/sowel/issues/912) exists so a visitor can do this. |
| `POST`/`DELETE /equipments/:id/timed-action`                        | **keep** | "Close the gate in five minutes" is a good thing to show.                                                          |
| `PUT /me/preferences`                                               | **keep** | Language and theme. A visitor reading in English is a feature.                                                     |
| `POST /auth/logout`                                                 | **keep** | Harmless.                                                                                                          |
| `PUT /me/password`                                                  | **403**  | Would lock out every other visitor at once.                                                                        |
| `PUT /me`                                                           | **403**  | Renames the shared account. Cosmetic vandalism, no upside.                                                         |
| `POST`/`DELETE /me/tokens*`                                         | **403**  | A long-lived token is a way around this proxy.                                                                     |
| `POST`/`DELETE /push/subscriptions`                                 | **403**  | The demo would send notifications to a stranger's device.                                                          |
| `/me/mfa/*` (five routes)                                           | **403**  | Enrolling MFA on a shared account locks everyone out.                                                              |

Two of those — the password and MFA — are the ones that matter: each is a single
request that ends the demo until the next reset.

**The deny list is a list of paths, and paths drift.** FR7 gates that.

### FR4 — Quotas

Per IP at the proxy: one mutating request every two seconds sustained, thirty a
minute. Reads are not limited — a visitor with the product UI open is polling
nothing harmful, and the WebSocket is one connection.

**Excess is delayed before it is refused.** A visitor clicks a lamp, a shutter and
a mode in four seconds; a script does not stop. Six actions pass immediately, the
next six are held back to the sustained rate, and only past that does a caller get
a 429. Delaying makes the house feel momentarily slow, which is survivable;
refusing makes it feel broken, which is the thing we are trying to avoid.

Per target, the simulator's own three-second debounce already stops one lamp being
strobed. The proxy's job is the script, not the enthusiast.

### FR5 — The reset

1. Stop Sowel.
2. **Wipe SQLite, keep InfluxDB.** History accrues from launch day; that is the
   decision, not an accident.
3. Start Sowel, wait for health.
4. Create the admin from `.env`.
5. Restore the demo fixture.
6. Restart, wait for health.
7. Create the guest `standard` user.
8. **Verify, and fail loudly.**

### FR6 — The reset verifies rather than hopes

Phase 1 found this the hard way: the recipe packages could not be downloaded from
inside a container behind a TLS-intercepting proxy, and the instance came up
cheerfully with twenty-one recipe instances pointing at nothing. A demo that comes
up broken and says nothing is worse than one that refuses to come up.

`reset.sh` exits non-zero, having said which, unless:

- every integration reports `connected`;
- the device count matches the fixture's;
- every equipment is `online`;
- every recipe instance the fixture carries has **started**;
- the capacity arbiter is `enabled`;
- the guest can log in and order a light, and **cannot** change its own password.

That last pair is the deny list tested rather than asserted.

### FR7 — The deny list cannot drift silently

The core's allowlist will grow. When it does, the showroom must notice, because a
new `standard` write route is a new thing a visitor can do — which is sometimes
exactly what we want and sometimes a password change.

`scripts/check-deny-list.sh` reads `STANDARD_WRITE_ALLOWLIST` out of the core's
source (expected as a sibling checkout) and fails when it contains a route this
repository has not classified as keep or deny. It runs in `npm run validate`.

A route nobody has thought about is denied by the check, not by the proxy.

### FR8 — Nothing dangerous is reachable, and nothing is installation-specific

- The Docker socket is never mounted (`scripts/check-compose.sh` refuses it, and
  core spec 105 explains what it would cost).
- Admin-only surfaces — self-update, plugin management, backup restore, user
  management — are the core's own gate, and the guest is not admin.
- No notification publisher and no MQTT broker is configured.
- Hosts, IPs and passwords live in `.env`, which is ignored; `.env.example` is
  committed with every key and no value.

### FR9 — The landing page

One page, no build step, no framework. It says what the demo is in two sentences,
logs the visitor in, and offers the product UI. It leaves a labelled place for the
3D application so phase 3 adds a link and not a redesign.

It also says, plainly, that the house is simulated and resets every night. A
visitor who thinks this is somebody's real home is being misled.

## Acceptance criteria

- [x] AC1 — From a clean checkout: `cp .env.example .env`, `docker compose up -d`,
      `scripts/reset.sh` → a living house, no hand steps.
- [x] AC2 — `scripts/reset.sh` run twice gives the same state.
- [x] AC3 — The landing page logs a visitor in with nothing typed.
- [x] AC4 — A guest can order a light and switch a mode through the proxy.
- [x] AC5 — Every denied route returns 403 **through the proxy** while the same
      request succeeds against the origin, proving the proxy is what stops it.
- [x] AC6 — A burst of mutations from one IP is delayed and then refused, and
      reads are never limited.
- [x] AC7 — `reset.sh` fails, naming the problem, when a recipe package is missing.
- [x] AC8 — `check-deny-list.sh` fails when the core's allowlist gains a route.
- [x] AC9 — `npm run validate` is green; no credential in the repository.

## Edge cases

| Case                                                | Expected                                                                                                                                                                                        |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The plugin is not in the core's registry yet        | The reset accepts a local tarball through `SIMULATOR_TARBALL` and says which path it used. Registry install is the default once [sowel#940](https://github.com/mchacher/sowel/pull/940) merges. |
| InfluxDB has no data yet                            | Charts are empty and the reset still succeeds. History starting on launch day is the decision.                                                                                                  |
| Two visitors order the same lamp in the same second | The simulator's debounce drops the second. The proxy is not involved: different IPs, different buckets.                                                                                         |
| A visitor finds the guest password                  | Nothing changes. That is FR2.                                                                                                                                                                   |
| The reset runs while visitors are connected         | They are logged out and land on the page again. The nightly reset is announced on the landing page.                                                                                             |
| The core image is bumped                            | The compose pins it; bumping is a pull request here, and the reset's verification is what catches a breaking change.                                                                            |

---

## Amendments

### 2026-09-09 — what the walk found

Six things, all found by running it rather than by reading it.

**My own verification was vacuous.** The recipe check read
`i.get('running', True)`, and no such field exists on a recipe instance — so it was
true always. It passed on an instance with twenty-one enabled instances and **zero
recipe definitions loaded**, which is the exact phase 1 failure it was written to
catch. It now asks the other end: every `recipeId` an enabled instance names must
appear in `GET /api/v1/recipes`. A check that cannot fail is worse than no check,
because it is also a claim.

**The landing page and the product UI both wanted `/`.** The UI is a stock image
with absolute asset paths and cannot move under a subpath. The root is now routed on
a cookie the page sets once it has a session: a first visit sees the page, every
visit after goes straight in, and `/bienvenue` always brings it back. `try_files`
with a named location branches; `proxy_pass` inside an `if` does not.

**`burst=5 nodelay` was correct by the numbers and wrong for a visitor.** Measured:
thirty-five quick mutations gave five accepted and thirty refused. Someone who
clicks a lamp, a shutter and a mode in four seconds would be told no. Now
`burst=12 delay=6` — a sequential visitor is never refused, only briefly slowed
(twenty actions took twenty-eight seconds), while forty fired in parallel give
twelve through and twenty-eight refused. The distinction between a visitor and a
script is real rather than nominal.

**Bash brace-expands JSON.** `{"a":1,"b":2}` contains a comma, so the braces vanish
and the body arrives as `'username': ...`. Values now travel as argv into a small
`json_body` helper, which also means a password with a quote in it is not a
problem.

**`source`-ing `.env` runs it.** `ADMIN_DISPLAY_NAME=Showroom Admin` made `Admin` a
command. Docker Compose's own parser is happy either way, which is why it was not
obvious; quoting satisfies both, and `check-env-example.sh` now refuses an unquoted
value with a space.

**`"$EMPTY"/*/` walks the filesystem root.** `PACKAGES_DIR` was unset and the
side-load loop iterated `/Applications/`, `/Library/`, `/System/`. It did no harm
because an inner guard caught it, but it then side-loaded **nothing** and said so
only in a line nobody read. It now refuses to side-load zero packages: that is how
an instance comes up with recipe instances pointing at packages it does not have.

### 2026-09-09 — the production meter is excused at night

The simulated inverter goes offline after sunset rather than reporting 0 W, because
that is what a real one does (simulator spec 001, FR12), and the equipment it backs
goes offline with it. The verification notes it instead of failing on it. The house
being honest about the dark is not a broken demo.

### 2026-09-27 — the guest sees everything and changes nothing

**Status: validated by the owner on 2026-09-27.**

The owner: _every feature should be visible in the demo, with every setting
read-only; as it stands, a visitor does not see what Sowel does._ As a `standard`
user, the guest never sees devices, the calendar, integrations, plugins, logs,
publishers, the settings or the rest of the admin navigation. That is half the
product, and most of what makes it more than a remote control.

A `viewer` role in the core (every screen, forms disabled, secrets masked) is the
right product answer and a real project: about twenty-five UI files use one
`isAdmin` for both _may see_ and _may change_. The showroom does not wait for it.

#### FR2, amended — the guest is an admin, read-only at the proxy

The reset creates the guest with the **`admin`** role. Its password stays public by
design, and the property this spec defends does not change: _what a guest can do is
safe_. What enforces it does. It was the core's role gate, derived through a deny
list. It is now **the proxy, failing closed**. The owner's admin account is a
different account; its password is still never published.

#### FR3, amended — writes: refused unless kept

The proxy inverts. **Every `POST`, `PUT`, `PATCH` and `DELETE` under `/api/` is
refused unless it matches a kept route.** Today's `keep` rows carry over unchanged,
plus the two public routes a session needs:

| Kept                                                                | Why                                     |
| ------------------------------------------------------------------- | --------------------------------------- |
| `POST /equipments/:id/orders/:alias`                                | The demo — the 3D app's ghost included. |
| `POST /zones/:id/orders/:key`                                       | All lights off, all shutters closed.    |
| `POST /modes/:id/activate` · `/deactivate` · `/apply-to-zone/:zone` | Day, evening, night.                    |
| `POST`/`DELETE /equipments/:id/timed-action`                        | "Close the gate in five minutes".       |
| `PUT /me/preferences`                                               | Language and theme.                     |
| `POST /auth/login` · `/auth/refresh` · `/auth/logout`               | Getting, keeping and ending a session.  |

Everything else is refused, whatever the core would allow an admin: every
configuration form, self-update, plugin install, backup restore, user management,
`/auth/setup`, MFA, tokens, push subscriptions. A route the core adds tomorrow is
refused until this table names it — the reverse of today, where a new write route is
allowed until someone classifies it.

**The refusal speaks.** A 403 with `{"error": "Démo en lecture seule — read-only
demo"}`. The product UI shows a failed request's `error` field as its message
(`ui/src/api/client.ts`), so saving a form says why rather than "HTTP 403".

`scripts/deny-list.txt` becomes `scripts/write-allowlist.txt`. It holds only the
kept rows, each with its reason; the `deny` rows go, since there is nothing left to
deny one by one.

#### FR3b — reads: shown, except what is private

An admin can read things a visitor must not. The proxy refuses these reads (every
method) with the same 403:

| Refused                                                                     | Why                                                                                                              |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `/api/v1/backup*`                                                           | The whole database, password hashes included.                                                                    |
| `/api/v1/users*`                                                            | The owner's account.                                                                                             |
| `/api/v1/audit*`                                                            | Each entry stores the actor's IP: one visitor would read the others'.                                            |
| `/api/v1/me/tokens*`                                                        | Nothing to list, and nothing a visitor needs.                                                                    |
| `/api/v1/mqtt-brokers*` · `/mqtt-publishers*` · `/notification-publishers*` | They carry passwords and bot tokens in clear. None is configured; refused so that stays harmless if one ever is. |

Everything else is shown: devices, integrations (the core masks `password`-type
settings; the simulator has none), plugins and the store, the calendar, recipes,
modes, energy, logs and settings.

**What the proxy cannot filter: the WebSocket.** An admin session may subscribe to
the `logs` and `mqtt-publishers` topics. The second is empty here. The first streams
what the Logs page shows anyway: the engine's log, with pino's redaction of
passwords, tokens and secrets. Accepted, on one condition that the walk checks: no
client IP in the log. If there is one, the logs are refused too and this paragraph
says so.

#### FR5, amended — an admin door the public never sees

Every script call goes through the proxy today (`scripts/lib/sowel-api.sh`, on
`PUBLIC_ORIGIN`). A proxy that refuses every write would refuse the reset's own work:
the restore, the guest's creation, the arbiter's enrolment. So the proxy gets a
**second server, on a port published on `127.0.0.1` only** (`ADMIN_PORT`, default
8081), which proxies to Sowel with no write gate. The scripts' admin calls use it
(`ADMIN_ORIGIN`); the guest checks keep using the public origin, because what they
test is the public door.

On the host this door is reachable only locally, or through an SSH tunnel for the
owner. The owner logging in on the public site is read-only like everyone else, and
that is fine: the admin password never needs to be typed on a public page.

#### FR6, amended — what the reset proves

On top of today's checks, as the guest on the public origin:

- the session reports the `admin` role;
- a configuration write outside the table is refused with the demo message (e.g.
  renaming a zone);
- `GET /api/v1/backup`, `/users` and `/audit` are refused;
- `GET /api/v1/settings` and `/api/v1/integrations` succeed — the point of the change.

And, on the admin door, the reset's own writes succeed, which it proves by running.

#### FR7, amended — the drift that is left is in the reads

Writes can no longer drift: a new route is refused. Reads can: a new admin-only
`GET` in the core would be shown by default. `scripts/check-deny-list.sh` becomes
`check-admin-reads.sh`. It reads the core's admin-gated path prefixes (`pathIs` /
`pathIsUnder` followed by `requireAdmin`, in `src/api/routes/`) and fails on one that
FR3b's table has not classified as shown or refused. The check of
`STANDARD_WRITE_ALLOWLIST` goes: the guest is no longer `standard`.

A page that reads through a `POST` would break under FR3. The only such route found
in the core today is `POST /system/version/check`, a manual update check, which is
right to refuse. The walk clicks through every page to find any other.

#### FR8, amended

"Admin-only surfaces are the core's own gate, and the guest is not admin" becomes:
self-update, plugin management, backup restore and user management are writes, and
the proxy refuses them. The Docker socket, `.env` and "no publisher configured" are
unchanged.

#### What the visitor will see, honestly

- **The forms still look editable.** A visitor changes a value, saves, and reads
  "Démo en lecture seule". It is not a read-only UI; that would be the core's
  `viewer` role.
- **Admin prompts appear**: an update available, a plugin update. Acting on them
  gets the same message.

#### Rejected

- **A `viewer` role in the core, now.** It is the right product answer, but a real
  project, and it would block the demo on the product. It may become an ordinary
  core issue, argued on its own merits.
- **Keeping `standard` and widening the deny list.** A deny list fails open: every
  new core route is allowed until someone notices.
- **Deciding the role in the proxy from the JWT.** nginx would need njs to read the
  token. The admin door is simpler and needs nothing.

#### Acceptance criteria

- [~] AC-A1 — As an admin on the public door, every page of the admin navigation
  opens and shows its data; MQTT, notifications and backup show empty states.
  As the guest: waiting on the role (see "Walked").
- [x] AC-A2 — Saving a configuration form shows "Démo en lecture seule", and
      nothing changes — through the vignette's toast where the page is silent.
- [x] AC-A3 — Ordering a light and the bathroom walk still work (checked by the
      reset); modes and timed actions are on the unchanged allowlist.
- [x] AC-A4 — `GET /api/v1/backup`, `/users` and `/audit` are refused, and so are
      `/api/v1/%62ackup` and `/API/v1/users`.
- [x] AC-A5 — The reset runs end to end through the admin door; compose publishes
      it on 127.0.0.1 only, and `check-compose.sh` refuses anything else.
- [x] AC-A6 — `check-admin-reads.sh` fails when an admin-gated path is unclassified
      (tried by removing `/api/v1/audit` from the list).
- [x] AC-A7 — No client IP in the logs: account names only, which the public door
      makes worthless (every account is read-only there).

#### Walked, on the local showroom (2026-09-27)

- **The guest's role is not flipped yet.** Creating the guest as `admin` in
  `reset.sh` was refused to the agent by its own safety classifier ("permission
  grant"), so that one line waits for the owner. Everything else is in place and
  was exercised with the owner's admin account on the public door, which the
  amendment makes read-only too. Until the line changes, four checks of the reset
  fail on purpose: the role, and settings, integrations and logs being readable.
- **Settings are shown, and carried a secret.** `GET /api/v1/settings` returned a
  `history.influx.token` — a legacy key the core no longer reads, restored from the
  demo fixture, and already public in the core's documentation fixture. The
  simulator's fixture build now drops `history.influx.*`; the reset checks key by
  key that the settings a visitor reads hold no secret. One key is accepted by name:
  `push.vapidPrivateKey` signs notifications to this server's subscribers, and there
  are none (the proxy refuses subscriptions, the reset wipes them). Refusing
  settings instead was tried first: every page reads them, and the settings page —
  the arbiter's configuration with it — came up empty.
- **Some pages swallow a refusal.** The settings page saved, failed and said
  nothing. The vignette's script, injected in every page, now catches a 403 carrying
  "lecture seule" and says so in a toast, the same on every page.
- **A path in capitals missed `/api/`.** `/API/v1/users` fell through to the
  product-UI location and got the SPA page — harmless, since the core's router is
  case-sensitive, but ungated. The UI locations carry the same gate now.
- **The core rate-limits by address, and behind the proxy every visitor has the
  proxy's.** `@fastify/rate-limit`, 300 requests a minute, keyed on the socket
  address, with no `trustProxy`: all visitors together share one budget. One
  person reloading page after page reached it in the walk. It cannot be fixed in
  this repository; it is a product issue — the owner's own instance behind its
  Cloudflare tunnel has the same shape — and it blocks the public opening, not
  this amendment.
