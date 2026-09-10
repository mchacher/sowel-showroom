#!/usr/bin/env bash
# Refuses a value in `.env.example` for any key whose name says it is a secret.
#
# The template is committed **because** it has no values (CLAUDE.md: "Guest and
# admin passwords, tokens and hostnames live in .env (ignored) with an
# .env.example committed"). Gitleaks alone is not enough here: it reads an empty
# `TOKEN=` followed by the next key as a finding, so the template is allowlisted
# for that rule — which means this check is what actually holds the line.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

TEMPLATE=".env.example"
[ -f "$TEMPLATE" ] || { echo "⚠ no $TEMPLATE yet."; exit 0; }

bad=0
while IFS= read -r line; do
  case "$line" in \#*|"") continue ;; esac
  key="${line%%=*}"
  value="${line#*=}"
  case "$key" in
    *PASSWORD*|*TOKEN*|*SECRET*|*_KEY|*APIKEY*|*CREDENTIAL*)
      if [ -n "$value" ]; then
        echo "❌ $TEMPLATE sets $key. Secrets belong in .env, which is ignored." >&2
        bad=$((bad + 1))
      fi
      ;;
  esac
done < "$TEMPLATE"

[ "$bad" -eq 0 ] || exit 1
echo "✓ $TEMPLATE carries no secret value"
