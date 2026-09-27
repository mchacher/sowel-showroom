#!/usr/bin/env bash
# Talking to Sowel from a script, without repeating curl's sharp edges.
#
# Sourced, never run.
#
# **Everything goes through the proxy.** Sowel's own port is not published. The
# proxy has two doors (spec 001, amended 2026-09-27):
#
#   - the public one, `$PUBLIC_ORIGIN`, where every visitor arrives and every write
#     not on the allowlist is refused — the default here, so the checks exercise
#     the path a visitor uses, and a broken proxy fails the reset instead of
#     waiting for a visitor to find it;
#   - the admin door, `$ADMIN_ORIGIN`, on the loopback, with no write gate. Prefix a
#     call with `admin` to use it: `admin api_ok POST /api/v1/users ...`. Only the
#     reset's own writes need it.

# shellcheck shell=bash

: "${PUBLIC_ORIGIN:?PUBLIC_ORIGIN must be set}"
ADMIN_ORIGIN="${ADMIN_ORIGIN:-http://127.0.0.1:${ADMIN_PORT:-8081}}"

step() { printf '\n▸ %s\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }
note() { printf '  · %s\n' "$1"; }
die() {
  printf '\n✗ %s\n' "$1" >&2
  exit 1
}

API_BODY=/tmp/showroom-api-body

# api <METHOD> <path> [json-body] [bearer-token]
# Prints the HTTP status; leaves the response body in $API_BODY.
api() {
  local method="$1" path="$2" body="${3:-}" token="${4:-}"
  local args=(-sS -X "$method" -o "$API_BODY" -w '%{http_code}' --max-time 30)
  [ -n "$token" ] && args+=(-H "Authorization: Bearer $token")
  [ -n "$body" ] && args+=(-H "Content-Type: application/json" -d "$body")
  curl "${args[@]}" "${API_ORIGIN:-$PUBLIC_ORIGIN}${path}" 2>/dev/null || echo 000
}

# admin <command...> — runs one api/api_ok/login/wait_for_health call through the
# admin door. The assignment lasts for that call only.
admin() {
  API_ORIGIN="$ADMIN_ORIGIN" "$@"
}

# api_ok <METHOD> <path> [json-body] [token] — dies unless the status is 2xx.
api_ok() {
  local code
  code=$(api "$@")
  case "$code" in
    2*) return 0 ;;
    *)
      die "$1 $2 → HTTP $code
   $(head -c 300 "$API_BODY" 2>/dev/null)"
      ;;
  esac
}

# json <jq-ish path> — reads one field out of the last response, without jq.
json() {
  python3 -c "
import json, sys
try:
    d = json.load(open('$API_BODY'))
except Exception:
    sys.exit(1)
for k in '''$1'''.split('.'):
    if k == '': continue
    d = d[int(k)] if isinstance(d, list) else d.get(k)
    if d is None: break
print('' if d is None else d)
" 2>/dev/null || true
}

wait_for_health() {
  local tries="${1:-60}" i
  for ((i = 1; i <= tries; i++)); do
    if [ "$(api GET /api/v1/health)" = "200" ]; then
      return 0
    fi
    sleep 2
  done
  die "Sowel did not become healthy in $((tries * 2))s. docker compose logs sowel"
}

# json_body KEY=VALUE ... — builds a JSON object from its arguments.
#
# Never assemble JSON with braces in the shell: `{"a":1,"b":2}` contains a comma,
# so bash brace-expands it and the braces vanish. That is not a hypothetical — it
# is what this script did on its first run.
#
# Values travel as argv, which bash hands over untouched, so a password with a
# quote or a space in it is simply not a problem. An empty value is omitted rather
# than sent as "".
json_body() {
  python3 -c '
import json, sys

out = {}
for pair in sys.argv[1:]:
    key, _, value = pair.partition("=")
    if value != "":
        out[key] = value
print(json.dumps(out))
' "$@"
}

login() {
  local username="$1" password="$2"
  api_ok POST /api/v1/auth/login "$(json_body "username=$username" "password=$password")"
  json accessToken
}
