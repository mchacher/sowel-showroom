# Specs index — sowel-showroom

Every feature ever specified in this repository, one row each, newest last. A
CI check (`scripts/check-specs-index.sh`) fails a pull request that creates a
`specs/NNN-name/` folder without its row here.

This index covers the **infrastructure** specs only. The seven cross-repository
phases, and the decisions behind the whole project, are in
[docs/project-map.md](project-map.md) — read that first.

Status: 📝 Draft · 🚧 In progress · ✅ Shipped

| #   | Title | Status | Summary |
| --- | ----- | ------ | ------- |

_No spec yet. The compose stack, the proxy and the reset script are phase 2 of
the project map; write them with the `showroom-feature` skill, which creates the
folder and the row together._

## How to use this index after context loss

1. Read [docs/project-map.md](project-map.md) — decisions, contract, phases.
2. Scan this table for a spec that already covers what you are about to do.
3. Open `specs/NNN-name/spec.md` for the requirements, `architecture.md` for the
   shape, `plan.md` for the steps and the test plan.
