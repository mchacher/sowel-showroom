# CLAUDE.md

Guidance for Claude Code (and any AI agent) working on `sowel-showroom`. First file to read. Same method as the Sowel core: spec with gates, feature branch, review, PR, explicit merge approval.

## What this is

**Infrastructure only** for the public Sowel demo: the compose stack, the reverse proxy (guest login, deny list, quotas), the nightly reset, the demo fixture, the hosting notes, and the project map that ties the three repositories together.

| Repository               | Nature       |
| ------------------------ | ------------ |
| `sowel-plugin-simulator` | Sowel plugin |
| `sowel-house-3d`         | Application  |
| `sowel-showroom`         | This — infra |

The core (`mchacher/sowel`) stays **stock**: the showroom runs the published image. Anything the demo needs that the product does not offer is done in the plugin, the proxy or the 3D app, or becomes an ordinary product issue argued on its own merits.

## Where to find context

| You want to know...                          | Read this                                                                                      |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The decisions, the contract, the phases      | [docs/project-map.md](docs/project-map.md) — the decision table is not reopened by phase specs |
| Sowel's generic deployment guide             | `mchacher/sowel`: `docs/technical/deployment.md`                                               |
| The role gate the guest account relies on    | `mchacher/sowel`: spec 131, `docs/technical/api-reference.md`                                  |
| The anonymised fixture the demo derives from | `mchacher/sowel`: `docs/fixtures/README.md`, `scripts/doc/build-fixtures.py`                   |
| Feature history in this repo                 | `specs/NNN-name/{spec,architecture,plan}.md`                                                   |

The core repo is expected as a sibling directory (`../sowel`).

## Non-negotiable rules

- **Never mount the Docker socket.** `scripts/check-compose.sh` refuses it. A container with the socket is root on the host, and this host faces the internet.
- **Never commit a credential.** Guest and admin passwords, tokens and hostnames live in `.env` (ignored) with an `.env.example` committed. Gitleaks runs on commit and in CI.
- **Installation-specific details** (the VM, its IP, SSH) go in the private `sowel-ops` repo, never here.
- **The reset wipes SQLite and keeps InfluxDB.** History accrues from launch day; that is the decision, not an accident.
- **Reset from zero must be one command.** `scripts/reset.sh` is the contract; if it needs a hand step, it is not done.
- Scripts: bash, `set -euo pipefail`, shellcheck-clean at `--severity=warning`, a header comment saying what and why.
- The demo fixture is **generated** from the core's anonymised fixture, never edited by hand.

## Tech

Bash, Docker Compose, a reverse proxy (Caddy or nginx — decided in the phase 2 spec), Python 3 for the fixture build (same as the core's). Prettier for Markdown/YAML/JSON.

```bash
npm install
npm run validate        # format:check, shellcheck, compose validation, specs completeness — what CI runs
```

## Git workflow

- Feature branches: `feat/`, `fix/`, `refactor/`, `docs/`. Main is protected (PR required, linear history, CI green).
- Conventional commits. Scopes: `compose`, `proxy`, `reset`, `fixture`, `docs`, `ci`.
- **Never merge a PR without explicit user approval** ("oui", "merge", "go").
- Every new `specs/NNN-name/` folder needs `spec.md`, `architecture.md`, `plan.md` (CI gate).
- No version tags here: the showroom pins the versions of the core image, the plugin and the 3D app in its compose.

## Skills

| Skill              | When                                                   |
| ------------------ | ------------------------------------------------------ |
| `showroom-feature` | Implementing a phase: spec, branch, scripts, docs, PR. |

## Answering the user

Short and ordered. One or two lines for the what, one bullet per finding or decision. French or English, whichever the user uses.
