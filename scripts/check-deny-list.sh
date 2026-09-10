#!/usr/bin/env bash
# Fails when the Sowel core lets a `standard` user write a route that
# `scripts/deny-list.txt` has not classified (spec 001, FR7).
#
# The core's allowlist will grow, and every new entry is a new thing a visitor can
# do — sometimes exactly what we want, sometimes a password change. This check is
# what makes that a decision instead of a discovery. A route nobody has thought
# about is caught here rather than by a visitor.
#
# Needs the core as a sibling checkout; skips with a warning when it is absent, so
# a contributor without it is not blocked (CI has both).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

CORE="${SOWEL_CORE_DIR:-../sowel}"
MIDDLEWARE="$CORE/src/auth/auth-middleware.ts"
DENY_LIST="scripts/deny-list.txt"

if [ ! -f "$MIDDLEWARE" ]; then
  echo "⚠ $MIDDLEWARE not found — skipping. Clone mchacher/sowel as a sibling," >&2
  echo "  or set SOWEL_CORE_DIR, to run this check locally. CI runs it." >&2
  exit 0
fi

# The allowlist entries, as `METHOD<TAB>regex`. The block is delimited by the
# const and its closing bracket, so an entry added anywhere inside is seen.
# `\/` in a JavaScript regex literal is just `/`, so it is unescaped here: the
# two sides have to be comparable as plain strings, and the deny list is written
# the way a human reads a path.
core_routes=$(
  awk '/^const STANDARD_WRITE_ALLOWLIST/,/^\];/' "$MIDDLEWARE" \
    | sed -n 's|.*method: "\([A-Z]*\)".*re: /\^\(.*\)\$/.*|\1\t^\2$|p' \
    | sed 's|\\/|/|g'
)

if [ -z "$core_routes" ]; then
  echo "❌ Parsed no routes out of $MIDDLEWARE — the allowlist's shape changed." >&2
  echo "   Read it and update this script; do not widen the regex to make it pass." >&2
  exit 1
fi

# What this repository has classified, as `METHOD<TAB>regex`, with the nginx
# matcher dropped: `= /path` becomes `^/path$` so the two sides compare.
classified=$(
  grep -vE '^\s*(#|$)' "$DENY_LIST" \
    | awk '{
        method = $2
        if ($3 == "=") { route = "^" $4 "$" } else { route = $4 }
        print method "\t" route
      }'
)

missing=0
while IFS=$'\t' read -r method route; do
  [ -n "$method" ] || continue
  if ! printf '%s\n' "$classified" | grep -qxF "$method	$route"; then
    if [ "$missing" -eq 0 ]; then
      echo "❌ The core allows a standard user to write routes this repository has" >&2
      echo "   not classified. Add each to $DENY_LIST as keep or deny, with a" >&2
      echo "   reason, and regenerate the proxy config:" >&2
      echo >&2
    fi
    printf '     %-7s %s\n' "$method" "$route" >&2
    missing=$((missing + 1))
  fi
done <<< "$core_routes"

if [ "$missing" -gt 0 ]; then
  echo >&2
  echo "   $missing unclassified route(s). A visitor should not be the one to find out" >&2
  echo "   what they do." >&2
  exit 1
fi

core_count=$(printf '%s\n' "$core_routes" | grep -c . || true)
kept=$(grep -cE '^keep ' "$DENY_LIST" || true)
denied=$(grep -cE '^deny ' "$DENY_LIST" || true)
echo "✓ all $core_count standard-write route(s) classified — $kept kept, $denied denied"
