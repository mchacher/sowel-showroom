#!/usr/bin/env bash
# Fails when the Sowel core keeps a path to administrators that
# `scripts/admin-reads.txt` has not classified (spec 001, FR7, amended 2026-09-27).
#
# The guest is an admin, read-only at the proxy. Writes cannot drift: the proxy
# refuses every write its allowlist does not name. Reads can — a new admin-only
# GET in the core would be shown to every visitor by default, and it is admin-only
# precisely because it may be private. This check is what makes that a decision
# instead of a leak.
#
# Needs the core as a sibling checkout; skips with a warning when it is absent, so
# a contributor without it is not blocked (CI has both).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CORE="${SOWEL_CORE_DIR:-../sowel}"
ROUTES="$CORE/src/api/routes"
READS="scripts/admin-reads.txt"

if [ ! -d "$ROUTES" ]; then
  echo "⚠ $ROUTES not found — skipping. Clone mchacher/sowel as a sibling," >&2
  echo "  or set SOWEL_CORE_DIR, to run this check locally. CI runs it." >&2
  exit 0
fi

# The core gates a path to administrators in two ways, and both are read here:
#
#   - a hook: `pathIs(request, "/x")` or `pathIsUnder(request, "/x")`, followed
#     within a few lines by `requireAdmin(` — every method under that path;
#   - a handler: `requireAdmin(` inside a route — the path is the route's own, the
#     nearest `app.<method>(... "/api/v1/..."` above it.
#
# Printed as `METHOD<TAB>path`, METHOD being `*` for a hook.
gated=$(
  python3 - "$ROUTES" <<'PY'
import pathlib, re, sys

route = re.compile(r'app\.(get|post|put|patch|delete)\b')
literal = re.compile(r'"(/api/v1/[^"]+)"')
out = set()
for f in sorted(pathlib.Path(sys.argv[1]).glob("*.ts")):
    if f.name.endswith(".test.ts"):
        continue
    lines = f.read_text().splitlines()
    for i, line in enumerate(lines):
        if "requireAdmin(" not in line or "import" in line:
            continue
        window = "\n".join(lines[max(0, i - 3) : i + 1])
        hook = re.findall(r'pathIs(?:Under)?\(request,\s*"([^"]+)"\)', window)
        if hook:
            out.add(("*", hook[-1]))
            continue
        # A handler: walk up to the route that opens it. The path is the first
        # literal after `app.get` — on the same line, or after a multi-line type
        # parameter (`app.get<{ ... }>("/api/v1/audit", ...)`).
        for j in range(i, -1, -1):
            m = route.search(lines[j])
            if not m:
                continue
            for k in range(j, i + 1):
                p = literal.search(lines[k])
                if p:
                    out.add((m.group(1).upper(), p.group(1)))
                    break
            break
for method, path in sorted(out):
    print(f"{method}\t{path}")
PY
)

if [ -z "$gated" ]; then
  echo "❌ Found no admin-gated path under $ROUTES — the core's shape changed." >&2
  echo "   Read it and update this script; do not loosen it to make it pass." >&2
  exit 1
fi

# A path is classified when a prefix of admin-reads.txt covers it: the prefix
# itself, or anything below it. `:param` segments are compared as they are.
classified=$(grep -E '^(refuse|show) ' "$READS" | awk '{ print $2 }')
covered() {
  local path="$1" prefix
  while read -r prefix; do
    [ -n "$prefix" ] || continue
    case "$path" in "$prefix" | "$prefix"/*) return 0 ;; esac
  done <<< "$classified"
  return 1
}

missing=0
count=0
while IFS=$'\t' read -r method path; do
  [ -n "$path" ] || continue
  count=$((count + 1))
  # A write-only gate needs no classification: the proxy refuses every write it
  # does not name, whoever the core lets through.
  case "$method" in POST | PUT | PATCH | DELETE) continue ;; esac
  if ! covered "$path"; then
    if [ "$missing" -eq 0 ]; then
      echo "❌ The core keeps paths to administrators that $READS does not classify." >&2
      echo "   The guest is an admin: each is shown to every visitor until it is." >&2
      echo "   Add each as refuse or show, with a reason, and regenerate the proxy:" >&2
      echo >&2
    fi
    printf '     %-3s %s\n' "$method" "$path" >&2
    missing=$((missing + 1))
  fi
done <<< "$gated"

if [ "$missing" -gt 0 ]; then
  echo >&2
  echo "   $missing unclassified path(s). A visitor should not be the one to find out" >&2
  echo "   what they show." >&2
  exit 1
fi

refused=$(grep -cE '^refuse ' "$READS" || true)
shown=$(grep -cE '^show ' "$READS" || true)
echo "✓ all $count admin-gated path(s) classified — $refused refused, $shown shown"
