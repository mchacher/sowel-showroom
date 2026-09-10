#!/usr/bin/env bash
# Puts the showroom back to the house every visitor should find (spec 001, FR5).
#
#   scripts/reset.sh
#
# This is the contract: one command from zero, no hand steps. Run nightly in
# production, and run it locally whenever the demo has been poked into a state
# nobody wants.
#
# **It wipes SQLite and keeps InfluxDB.** The house starts fresh; the history
# accrues from launch day. That is a decision (docs/project-map.md), not an
# accident of implementation.
#
# **It verifies rather than hopes.** Phase 1 came up with twenty-one recipe
# instances pointing at nothing, because the packages could not be downloaded, and
# said so nowhere. Six checks at the end, and a non-zero exit naming the one that
# failed — including logging in as the guest, ordering a light, and being refused a
# password change, which is the deny list tested rather than asserted.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

[ -f .env ] || {
  echo "✗ No .env. Copy .env.example and fill it in." >&2
  exit 1
}
set -a
# shellcheck disable=SC1091
. ./.env
set +a

: "${PUBLIC_ORIGIN:?}" "${ADMIN_USERNAME:?}" "${ADMIN_PASSWORD:?}"
: "${GUEST_USERNAME:?}" "${GUEST_PASSWORD:?}" "${SIMULATOR_VERSION:?}"

# shellcheck source=scripts/lib/sowel-api.sh
. scripts/lib/sowel-api.sh

FIXTURE_CACHE=".cache/demo-fr-${SIMULATOR_VERSION}.zip"
FIXTURE_URL="https://raw.githubusercontent.com/mchacher/sowel-plugin-simulator/v${SIMULATOR_VERSION}/docs/fixtures/demo-fr.zip"

trap 'printf "\n✗ reset failed. The instance is mid-way: run this again, or docker compose logs sowel\n" >&2' ERR

# ── 1. The fixture ────────────────────────────────────────────────────────────
step "Fetching the demo fixture for simulator v${SIMULATOR_VERSION}"
mkdir -p "$(dirname "$FIXTURE_CACHE")"
if [ -f "$FIXTURE_CACHE" ]; then
  note "cached: $FIXTURE_CACHE"
else
  curl -fsSL "$FIXTURE_URL" -o "$FIXTURE_CACHE" ||
    die "could not fetch $FIXTURE_URL
   Is v${SIMULATOR_VERSION} released, and does it carry docs/fixtures/demo-fr.zip?"
  note "downloaded from the v${SIMULATOR_VERSION} tag"
fi
ok "$(wc -c <"$FIXTURE_CACHE" | tr -d ' ') bytes"

# ── 2. Wipe SQLite, keep InfluxDB ─────────────────────────────────────────────
step "Wiping the house (SQLite and the plugins), keeping the history (InfluxDB)"
docker compose stop sowel >/dev/null
# A throwaway container on the same volumes: the image's own shell, no socket, and
# nothing that outlives the command.
docker compose run --rm --no-deps --entrypoint sh sowel \
  -c 'rm -rf /app/data/* /app/data/.[!.]* /app/plugins/* 2>/dev/null; exit 0' >/dev/null
ok "wiped"

step "Starting Sowel"
docker compose up -d sowel >/dev/null
wait_for_health
ok "healthy"

# ── 3. The admin, then the fixture ────────────────────────────────────────────
step "Creating the administrator"
api_ok POST /api/v1/auth/setup "$(json_body \
    "username=$ADMIN_USERNAME" "password=$ADMIN_PASSWORD" \
    "displayName=${ADMIN_DISPLAY_NAME:-Showroom Admin}")"
ok "$ADMIN_USERNAME"

step "Restoring the demo fixture"
token=$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
code=$(curl -sS -X POST -o "$API_BODY" -w '%{http_code}' --max-time 120 \
  -H "Authorization: Bearer $token" -F "file=@${FIXTURE_CACHE}" \
  "${PUBLIC_ORIGIN}/api/v1/backup" 2>/dev/null || echo 000)
[ "${code:0:1}" = "2" ] || die "restore → HTTP $code
   $(head -c 300 "$API_BODY")"
ok "restored"

# ── 3b. Packages the instance cannot fetch for itself ─────────────────────────
# The fixture registers the simulator and ten recipe packages in the `plugins`
# table; a fresh instance downloads whatever is missing on startup (core spec 058),
# which is the normal path. Two situations need a hand:
#
#   - the registry does not carry the plugin yet (mchacher/sowel#940 pending);
#   - the host cannot reach GitHub — a corporate proxy intercepting TLS is enough,
#     and phase 1 hit exactly that.
#
# `SIMULATOR_TARBALL` and `PACKAGES_DIR` are that hand. The script says which path
# it took, because "it worked on my machine" usually means the other one.
if [ -n "${SIMULATOR_TARBALL:-}" ] || [ -n "${PACKAGES_DIR:-}" ]; then
  step "Side-loading packages the instance cannot fetch"
  if [ -n "${SIMULATOR_TARBALL:-}" ]; then
    [ -f "$SIMULATOR_TARBALL" ] || die "SIMULATOR_TARBALL=$SIMULATOR_TARBALL does not exist"
    tmp=$(mktemp -d)
    tar xzf "$SIMULATOR_TARBALL" -C "$tmp"
    docker compose exec -T sowel sh -c 'mkdir -p /app/plugins/simulator'
    docker compose cp "$tmp/manifest.json" sowel:/app/plugins/simulator/manifest.json >/dev/null
    docker compose cp "$tmp/package.json" sowel:/app/plugins/simulator/package.json >/dev/null
    docker compose cp "$tmp/dist" sowel:/app/plugins/simulator/dist >/dev/null
    rm -rf "$tmp"
    note "simulator from $SIMULATOR_TARBALL"
  fi
  if [ -n "${PACKAGES_DIR:-}" ]; then
    [ -d "$PACKAGES_DIR" ] || die "PACKAGES_DIR=$PACKAGES_DIR is not a directory"
    count=0
    # `"$EMPTY"/*/` expands to `/*/` and walks the filesystem root, so the guard
    # above is load-bearing rather than defensive tidiness.
    for dir in "$PACKAGES_DIR"/*/; do
      [ -f "$dir/manifest.json" ] || continue
      id=$(python3 -c "import json;print(json.load(open('$dir/manifest.json'))['id'])")
      docker compose exec -T sowel sh -c "rm -rf /app/plugins/$id && mkdir -p /app/plugins/$id"
      docker compose cp "$dir/manifest.json" "sowel:/app/plugins/$id/manifest.json" >/dev/null
      docker compose cp "$dir/package.json" "sowel:/app/plugins/$id/package.json" >/dev/null
      docker compose cp "$dir/dist" "sowel:/app/plugins/$id/dist" >/dev/null
      count=$((count + 1))
    done
    [ "$count" -gt 0 ] || die "PACKAGES_DIR=$PACKAGES_DIR holds no package
   Each package is a subdirectory with a manifest.json, a package.json and dist/.
   Side-loading nothing is how an instance comes up with recipe instances that
   point at packages it does not have."
    note "$count package(s) from $PACKAGES_DIR"
  fi
  ok "side-loaded"
else
  note "no side-load configured: the instance downloads its packages itself (spec 058)"
fi

# The restore replaces every table, users included — the fixture carries none, by
# design — so the instance is back at first run and the wizard runs again. That is
# the core's contract for a backup, not a quirk of this script.
step "Restarting after the restore"
docker compose restart sowel >/dev/null
wait_for_health
ok "healthy"

step "Creating the administrator again (the restore replaced the users table)"
api_ok POST /api/v1/auth/setup "$(json_body \
    "username=$ADMIN_USERNAME" "password=$ADMIN_PASSWORD" \
    "displayName=${ADMIN_DISPLAY_NAME:-Showroom Admin}")"
token=$(login "$ADMIN_USERNAME" "$ADMIN_PASSWORD")
ok "$ADMIN_USERNAME"

# ── 4. The guest ──────────────────────────────────────────────────────────────
step "Creating the guest every visitor is"
api_ok POST /api/v1/users "$(json_body \
    "username=$GUEST_USERNAME" "password=$GUEST_PASSWORD" \
    "displayName=${GUEST_DISPLAY_NAME:-Visiteur}" "role=standard")" "$token"
ok "$GUEST_USERNAME (standard)"

step "Handing the guest credentials to the landing page"
mkdir -p landing/showroom
python3 -c '
import json, sys
json.dump({"username": sys.argv[1], "password": sys.argv[2], "simulatorVersion": sys.argv[3]},
          open("landing/showroom/config.json", "w"), indent=2)
' "$GUEST_USERNAME" "$GUEST_PASSWORD" "$SIMULATOR_VERSION"
ok "landing/showroom/config.json (git-ignored: public by design, committed never)"

# ── 5. Verify, and fail loudly ────────────────────────────────────────────────
step "Verifying — the six things that can silently be wrong"
bash scripts/verify-showroom.sh

printf '\n✓ The showroom is ready: %s\n\n' "$PUBLIC_ORIGIN"
trap - ERR
