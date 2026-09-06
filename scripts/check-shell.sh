#!/usr/bin/env bash
# Runs shellcheck on every script of this repo (or on the files given).
# Skips with a hint when shellcheck is not installed locally; CI installs it.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

if ! command -v shellcheck >/dev/null 2>&1; then
  echo "shellcheck not installed — skipping (brew install shellcheck). CI runs it." >&2
  exit 0
fi

if [ "$#" -gt 0 ]; then
  files=("$@")
else
  files=(scripts/*.sh)
fi

shellcheck --severity=warning "${files[@]}"
echo "shellcheck: ${#files[@]} file(s) clean"
