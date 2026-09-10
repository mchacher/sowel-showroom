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

if [ "$failures" -gt 0 ]; then
  printf '\n✗ %d check(s) failed. The demo would come up broken.\n' "$failures" >&2
  exit 1
fi
printf '\n  ✓ all checks passed\n'
