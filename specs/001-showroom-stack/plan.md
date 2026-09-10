# Spec 001 — Implementation plan

Branch: `feat/showroom-stack`. Scopes: `compose`, `proxy`, `reset`, `docs`, `ci`.

## Steps

- [ ] **S1 — `.env.example` and `compose.yml`**: sowel (pinned image), influxdb,
      nginx. Sowel's port unpublished, no Docker socket, named volumes so the
      reset can wipe one and keep the other.
- [ ] **S2 — `scripts/deny-list.txt`** and **`scripts/check-deny-list.sh`**: the
      classification as data, and the check that the core's allowlist has not grown
      past it. Wired into `npm run validate`.
- [ ] **S3 — `proxy/nginx.conf`**: the deny locations generated from the data, the
      `limit_req` zone, the WebSocket upgrade, the landing page, the upstream.
- [ ] **S4 — `scripts/lib/sowel-api.sh`**: login, wait-for-health, a curl wrapper
      that fails on a non-2xx and says what it asked for.
- [ ] **S5 — `scripts/reset.sh`**: the eight steps, with a trap naming the one that
      failed.
- [ ] **S6 — the verification**: FR6's six checks, including ordering a light as the
      guest and being refused a password change.
- [ ] **S7 — `landing/index.html`**: two sentences, the automatic login, the product
      UI, a labelled place for the 3D app, and the nightly-reset notice.
- [ ] **S8 — `docs/operations.md`**: for a human at 3 a.m. who wrote none of this.
- [ ] **S9 — the whole thing, from a clean checkout**, twice, and with a
      deliberately broken fixture to prove the verification bites.

## Test plan

Bash, so the tests are the script's own assertions plus a scripted walk. No test
framework in this repository and no reason to add one.

| What                 | Scenario                                   | Expected                                                               |
| -------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `check-deny-list.sh` | The core's allowlist as it stands          | Passes                                                                 |
| `check-deny-list.sh` | A route added to a copy of the core's file | Fails, naming it — **AC8**                                             |
| `check-compose.sh`   | The compose as written                     | Passes, and still refuses a socket mount                               |
| nginx config         | `nginx -t` inside the image                | Valid                                                                  |
| `reset.sh`           | Clean checkout, first run                  | A living house, no hand steps — **AC1**                                |
| `reset.sh`           | Second run                                 | Same state, not a second house — **AC2**                               |
| `reset.sh`           | Fixture with a recipe package removed      | Exits non-zero, names the package — **AC7**                            |
| proxy                | `PUT /api/v1/me/password` as the guest     | 403 from nginx; the same request inside the network succeeds — **AC5** |
| proxy                | `PUT /api/v1/me/preferences` as the guest  | 200 — the neighbouring route is not caught                             |
| proxy                | `POST /equipments/:id/orders/state`        | 200, and the lamp changes — **AC4**                                    |
| proxy                | `POST /modes/:id/activate`                 | 200 — core #912 reaching a visitor                                     |
| proxy                | 31 mutations in a minute                   | The last is 429 — **AC6**                                              |
| landing page         | Opened on a reset instance                 | Logged in, nothing typed — **AC3**                                     |
| repository           | `npm run validate`, gitleaks               | Green, no credential — **AC9**                                         |

## The gate

A browser opened on `http://localhost:8080`, on a machine that has never run this
before, lands in a house where the lights are on a schedule, somebody is in the
kitchen, and clicking a shutter closes it. Without logging in, and without being
able to break it for the next visitor.
