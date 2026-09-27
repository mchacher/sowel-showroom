#!/usr/bin/env bash
# The six things that can silently be wrong (spec 001, FR6).
#
# Run by `reset.sh` and runnable on its own — `scripts/verify-showroom.sh` is how
# you answer "is the demo actually fine?" without opening a browser.
#
# Every check exists because something was once quietly broken:
#
#   integrations   the plugin can fail to load and the instance still answers 200
#   devices        a fixture can restore with bindings pointing at nothing
#   equipments     an equipment with no binding reads `offline` and looks like a
#                  hardware problem
#   recipes        phase 1 came up with twenty-one instances pointing at nothing,
#                  because the packages could not be downloaded, and said so nowhere
#   arbiter        three energy profiles restored as three nulls, because the core
#                  reads its column list from the first row (mchacher/sowel#939)
#   the guest      a deny list asserted in a config file and never exercised is a
#                  comment
#   framing        the vignette frames the 3D app inside Sowel: the 3D must be
#                  framable by this origin and no other, and Sowel itself by none
#   history        the showroom accrued none for weeks and every check was green:
#                  the plugin's points were refused by InfluxDB and nothing looked
#                  (spec 003, FR5)
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

[ -f .env ] || { echo "✗ No .env." >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a

# shellcheck source=scripts/lib/sowel-api.sh
. scripts/lib/sowel-api.sh

: "${ADMIN_USERNAME:?}" "${ADMIN_PASSWORD:?}" "${GUEST_USERNAME:?}" "${GUEST_PASSWORD:?}"

failures=0
fail() {
  printf '  ✗ %s\n' "$1" >&2
  failures=$((failures + 1))
}

token=$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")

# ── integrations ──────────────────────────────────────────────────────────────
api_ok GET /api/v1/health "" "$token"
summary=$(python3 -c "
import json
d = json.load(open('$API_BODY'))
ints = d.get('integrations', {})
bad = [k for k, v in ints.items() if v.get('status') != 'connected']
dev = d.get('devices', {})
print(len(ints), ','.join(bad) or '-', dev.get('total', 0), dev.get('offline', 0))
")
read -r n_int bad_int n_dev n_offline <<<"$summary"
[ "$n_int" -ge 1 ] || fail "no integration at all — the simulator did not load"
[ "$bad_int" = "-" ] || fail "integration(s) not connected: $bad_int"
[ "$bad_int" = "-" ] && [ "$n_int" -ge 1 ] && ok "$n_int integration(s), all connected"

# ── devices ───────────────────────────────────────────────────────────────────
[ "$n_dev" -ge 80 ] || fail "$n_dev devices — the fixture expects about ninety"
# The PV inverter is legitimately offline at night (simulator spec 001, FR12).
[ "$n_offline" -le 1 ] || fail "$n_offline devices offline (one is normal: the inverter, at night)"
{ [ "$n_dev" -ge 80 ] && [ "$n_offline" -le 1 ]; } && ok "$n_dev devices, $n_offline offline"

# ── equipments ────────────────────────────────────────────────────────────────
api_ok GET /api/v1/equipments "" "$token"
eq=$(python3 -c "
import json
d = json.load(open('$API_BODY'))
# The PV inverter reports offline between sunset and sunrise, on purpose
# (simulator spec 001, FR12), and the equipment it backs reports offline with it.
# That is the house being honest about the dark, not a broken demo.
NIGHT_OK = {'energy_production_meter'}
bad = [e['name'] for e in d if e.get('status') != 'online' and e.get('type') not in NIGHT_OK]
excused = [e['name'] for e in d if e.get('status') != 'online' and e.get('type') in NIGHT_OK]
nobind = [e['name'] for e in d if not e.get('dataBindings')]
print(len(d), len(bad), len(nobind), len(excused), '|', ', '.join((bad + nobind)[:4]))
")
read -r n_eq n_bad n_nobind n_excused _ names <<<"$eq"
[ "$n_excused" -eq 0 ] || note "$n_excused production meter(s) offline — the inverter, at night"
[ "$n_bad" -eq 0 ] || fail "$n_bad equipment(s) not online: $names"
[ "$n_nobind" -eq 0 ] || fail "$n_nobind equipment(s) with no data binding: $names"
{ [ "$n_bad" -eq 0 ] && [ "$n_nobind" -eq 0 ]; } && ok "$n_eq equipments, all online and bound"

# ── recipes ───────────────────────────────────────────────────────────────────
# An instance carries no "is it running" field, so the real question is asked of the
# other end: a recipe whose package failed to load is absent from the definitions.
# Twenty-one instances against zero definitions is precisely the phase 1 failure,
# and the first version of this check could not see it — `i.get('running', True)`
# is true whenever the field does not exist, so it passed on a house where nothing
# automated anything.
api_ok GET /api/v1/recipes "" "$token"
cp "$API_BODY" /tmp/showroom-recipes.json
api_ok GET /api/v1/recipe-instances "" "$token"
rec=$(python3 -c "
import json
definitions = {r.get('id') for r in json.load(open('/tmp/showroom-recipes.json'))}
instances = json.load(open('$API_BODY'))
enabled = [i for i in instances if i.get('enabled')]
missing = sorted({i.get('recipeId') for i in enabled if i.get('recipeId') not in definitions})
print(len(instances), len(enabled), len(definitions), ','.join(missing) or '-')
")
read -r n_rec n_enabled n_def missing <<<"$rec"
[ "$n_enabled" -ge 1 ] || fail "no enabled recipe instance — the house cannot automate anything"
[ "$n_def" -ge 1 ] || fail "no recipe definition loaded — every instance points at nothing"
[ "$missing" = "-" ] || fail "package(s) not loaded, so their instances do nothing: $missing"
{ [ "$n_enabled" -ge 1 ] && [ "$missing" = "-" ] && [ "$n_def" -ge 1 ]; } &&
  ok "$n_enabled of $n_rec instance(s) enabled, all $n_def definition(s) loaded"

# ── the arbiter ───────────────────────────────────────────────────────────────
api_ok GET /api/v1/energy/arbiter "" "$token"
arb=$(python3 -c "
import json
d = json.load(open('$API_BODY'))
print(str(d.get('enabled')).lower(), len(d.get('loads') or []))
")
read -r arb_enabled n_loads <<<"$arb"
[ "$arb_enabled" = "true" ] || fail "the capacity arbiter is not enabled"
[ "$n_loads" -ge 2 ] || fail "$n_loads flexible load(s) enrolled — the arbiter has no contest"
{ [ "$arb_enabled" = "true" ] && [ "$n_loads" -ge 2 ]; } &&
  ok "arbiter enabled, $n_loads flexible load(s) enrolled"

# ── the guest, through the proxy ───────────────────────────────────────────────
guest=$(login "$GUEST_USERNAME" "$GUEST_PASSWORD") || fail "the guest cannot log in"
if [ -n "${guest:-}" ]; then
  # It can act: order the first light it finds.
  api_ok GET /api/v1/equipments "" "$guest"
  lamp=$(python3 -c "
import json
d = json.load(open('$API_BODY'))
for e in d:
    if e.get('type') == 'light_onoff' and any(b.get('alias') == 'state' for b in e.get('orderBindings', [])):
        print(e['id']); break
")
  if [ -z "$lamp" ]; then
    fail "no orderable light for the guest to try"
  else
    code=$(api POST "/api/v1/equipments/$lamp/orders/state" '{"value":true}' "$guest")
    [ "${code:0:1}" = "2" ] || fail "the guest cannot order a light (HTTP $code)"
    [ "${code:0:1}" = "2" ] && ok "the guest can order a light"
  fi

  # And it cannot end the demo: the deny list, exercised rather than asserted.
  code=$(api PUT /api/v1/me/password '{"currentPassword":"x","newPassword":"y"}' "$guest")
  [ "$code" = "403" ] || fail "the proxy let the guest reach its own password (HTTP $code, expected 403)"
  [ "$code" = "403" ] && ok "the guest is refused its own password (403 at the proxy)"

  code=$(api POST /api/v1/me/mfa/totp/setup '{}' "$guest")
  [ "$code" = "403" ] || fail "the proxy let the guest enrol MFA (HTTP $code, expected 403)"
  [ "$code" = "403" ] && ok "the guest is refused MFA enrolment"

  # The neighbouring route must still reach Sowel, or the deny list is too blunt —
  # `PUT /me` is denied and `PUT /me/preferences` is kept, one path apart. What is
  # under test is the proxy, not the endpoint's schema, so anything other than 403
  # passes: a 400 means Sowel answered, which is the whole question.
  code=$(api PUT /api/v1/me/preferences '{"preferences":{"language":"en"}}' "$guest")
  [ "$code" != "403" ] || fail "the deny list also caught /me/preferences, one path away"
  [ "$code" != "403" ] && ok "/me/preferences still reaches Sowel (HTTP $code)"
fi

# ── framing ───────────────────────────────────────────────────────────────────
# The vignette puts the 3D app in an iframe inside the Sowel UI. That needs the 3D
# framable by this origin, and nothing more: Sowel keeps refusing every frame, as
# it ships, and neither may be framed by another site — on a public host that
# would be a clickjacking invitation. The script itself must reach the UI too, or
# the vignette silently never appears.
headers_of() {
  curl -sS -D- -o /dev/null --max-time 10 -H 'Cookie: showroom=entered' "${PUBLIC_ORIGIN}$1" | tr -d '\r'
}
# Stripped by prefix, not split on ": " — Sowel's policy itself contains `data: blob:`.
frame_ancestors() {
  sed -n 's/^[Cc]ontent-[Ss]ecurity-[Pp]olicy: //p' | tr ';' '\n' | sed -n 's/^ *frame-ancestors //p'
}
ui_fa=$(headers_of /dashboard | frame_ancestors)
house_fa=$(headers_of /maison/ | frame_ancestors)
injected=$(curl -sS --max-time 10 -H 'Cookie: showroom=entered' "${PUBLIC_ORIGIN}/dashboard" |
  grep -c 'src="/showroom-ui/mini-house.js"' || true)
script=$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "${PUBLIC_ORIGIN}/showroom-ui/mini-house.js")
if [ "$ui_fa" = "'none'" ] && [ "$house_fa" = "'self'" ] && [ "$injected" = "1" ] && [ "$script" = "200" ]; then
  ok "3D framable by this origin only, Sowel by none, vignette injected"
else
  fail "framing: Sowel frame-ancestors=${ui_fa:-none} (want 'none'), 3D=${house_fa:-none} (want 'self'), vignette injected=$injected, script HTTP $script"
fi

# ── history ───────────────────────────────────────────────────────────────────
# As a guest, through the public API: what a visitor's Energy page would show.
guest=$(login "$GUEST_USERNAME" "$GUEST_PASSWORD")
energy_days=$(for weeks_back in 0 1 2 3 4 5; do
  day=$(python3 -c "import datetime as d;print((d.date.today()-d.timedelta(weeks=$weeks_back)).isoformat())")
  api_ok GET "/api/v1/energy/history?period=week&date=$day" "" "$guest" >/dev/null
  python3 -c "
import json, datetime as d
now = d.datetime.now(d.timezone.utc)
for p in json.load(open('$API_BODY')).get('points', []):
    t = d.datetime.fromisoformat(p['time'].replace('Z', '+00:00'))
    if now - d.timedelta(days=30) <= t < now - d.timedelta(days=1) and (p.get('hp', 0) + p.get('hc', 0)) > 0:
        print(t.date())
"
done | sort -u | wc -l | tr -d ' ')
[ "$energy_days" -ge 28 ] && ok "energy history on $energy_days of the last 29 whole days" ||
  fail "energy history on $energy_days of the last 29 whole days — a visitor's month view is empty"

api_ok GET /api/v1/equipments "" "$guest" >/dev/null
probe=$(python3 -c "
import json
for e in json.load(open('$API_BODY')):
    for b in e.get('dataBindings', []):
        if b.get('category') == 'temperature' and b.get('alias') == 'temperature':
            print(e['id'], e['name'].replace(' ', '_')); raise SystemExit
")
read -r probe_id probe_name <<<"$probe"
since=$(python3 -c "import datetime as d;print((d.datetime.now(d.timezone.utc)-d.timedelta(days=7)).strftime('%Y-%m-%dT%H:%M:%SZ'))")
api_ok GET "/api/v1/history/$probe_id/temperature?from=$since&aggregation=1h" "" "$guest" >/dev/null
hours=$(python3 -c "import json;print(len(json.load(open('$API_BODY')).get('points', [])))")
[ "$hours" -ge 150 ] && ok "$hours hours of temperature over the last week (${probe_name//_/ })" ||
  fail "$hours hours of temperature over the last week (${probe_name//_/ }) — expected about 168"

if [ "${ARBITER_BURNED_IN:-0}" = "1" ]; then
  api_ok GET /api/v1/energy/arbiter/metrics "" "$guest" >/dev/null
  arbiter_days=$(python3 -c "
import json
print(sum(1 for d in json.load(open('$API_BODY')).get('home', [])[-7:] if d.get('samples', 0) > 200))
")
  [ "$arbiter_days" -ge 6 ] && ok "the arbiter has $arbiter_days full days of its own in the last seven" ||
    fail "the arbiter has $arbiter_days full days in the last seven — its history is not the week FR4 promises"
else
  note "arbiter history not checked: burn-in not declared done (ARBITER_BURNED_IN=1 in .env)"
fi

if [ "$failures" -gt 0 ]; then
  printf '\n✗ %d check(s) failed. The demo would come up broken.\n' "$failures" >&2
  exit 1
fi
printf '\n  ✓ all checks passed\n'
