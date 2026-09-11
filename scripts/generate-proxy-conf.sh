#!/usr/bin/env bash
# Generates `proxy/nginx.conf` from `scripts/deny-list.txt` (spec 001, FR3).
#
# The deny list is the data; this is the only thing that turns it into config. Run
# with `--check` to fail when the committed file has drifted from the data, which
# is what `npm run validate` does: a deny list and a proxy config that disagree
# would be a security rule that exists only on paper.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

DENY_LIST="scripts/deny-list.txt"
OUT="proxy/nginx.conf"
MODE="${1:-write}"

deny_map_entries() {
  grep -E '^deny ' "$DENY_LIST" | while read -r _ method matcher route comment; do
    reason="${comment#\# }"
    if [ "$matcher" = "=" ]; then
      key="\"$method:$route\""
    else
      # The route already carries its own anchors; the method is prefixed inside
      # them, so the leading `^` moves rather than doubling.
      key="\"~^$method:${route#^}\""
    fi
    printf '  %-58s 1;  # %s\n' "$key" "$reason"
  done
}

generate() {
  cat <<'HEADER'
# ============================================================
# GENERATED — do not edit.
#
# Written by `scripts/generate-proxy-conf.sh` from `scripts/deny-list.txt`, which
# is where the reasons live. Edit that file and re-run; `npm run validate` fails
# when this one has drifted from it.
#
# What this does, in order of how much it matters:
#
#   1. Refuses the handful of requests that would end the demo for everyone else
#      — a password change, an MFA enrolment — even though the core's role gate
#      allows them for a `standard` user. The guest account is shared, which the
#      core has no way to know.
#   2. Rate-limits mutations per IP, so a script cannot drive the house.
#   3. Serves the landing page, and proxies everything else to Sowel.
#
# Sowel's port is not published on the host, so this is the only way in.
# ============================================================

# Only mutations are counted. An empty key is not counted at all by nginx, which
# is the documented way to exempt reads without a second zone.
map $request_method $mutation_key {
  default "";
  POST    $binary_remote_addr;
  PUT     $binary_remote_addr;
  PATCH   $binary_remote_addr;
  DELETE  $binary_remote_addr;
}

# 30 a minute is one every two seconds sustained.
limit_req_zone $mutation_key zone=mutations:10m rate=30r/m;
limit_req_status 429;

# Where `/` goes.
#
# The landing page and the product UI both want to be the root, and the UI is a
# stock image whose assets are absolute — it cannot be moved under a subpath. So
# the root is routed on a cookie the landing page sets once it has a session:
# a first visit sees the page, every visit after goes straight in, and clearing
# cookies brings the page back. `try_files` with a named location is the
# documented way to branch; `proxy_pass` inside an `if` is not.
map $cookie_showroom $root_target {
  default  "@landing";
  "entered" "@app";
}

# What a visitor may not do. Generated from scripts/deny-list.txt.
map "$request_method:$uri" $denied {
  default 0;
HEADER
  deny_map_entries
  cat <<'FOOTER'
}

# `$host` drops the port, and the core's WebSocket allows an Origin when its host
# matches the Host header it was reached on — so `Host: localhost` against
# `Origin: http://localhost:8080` is not the same origin and the socket is refused
# with "Origin not allowed", after a successful 101. `$http_host` is what the
# browser actually sent, port and all.
upstream sowel {
  server sowel:3000;
  keepalive 16;
}

server {
  listen 80;
  server_name _;

  # A visitor's own doing is their business; the access log is not a visitor log.
  access_log /var/log/nginx/access.log combined;
  client_max_body_size 2m;

  # Every redirect this server issues is built from `$host`, which drops the port —
  # so `/maison` sent a browser to `http://localhost/maison/`, a host that is not
  # this one. Relative redirects carry no host at all and are therefore always
  # right, whatever port, tunnel or domain the visitor arrived through.
  absolute_redirect off;

  # --- The root, and the landing page -------------------------------------
  # Served from the proxy so the page works before Sowel is up, which is exactly
  # when somebody arrives during a reset.
  location = / {
    try_files /does-not-exist $root_target;
  }

  location @landing {
    root /usr/share/nginx/html;
    try_files /index.html =404;
    add_header Cache-Control "no-store";
  }

  location @app {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
  }

  # The page's own assets, and the guest credentials the reset writes.
  location /showroom/ {
    root /usr/share/nginx/html;
    add_header Cache-Control "no-store";
  }

  # --- The 3D house ------------------------------------------------------
  # Served from this origin on purpose: the landing page's session lives in
  # localStorage, which is per-origin, so putting the app anywhere else would mean
  # a second login. A static build, so no upstream and no API of its own — it talks
  # to Sowel through /api and /ws above, like any other client.
  location /maison/ {
    alias /usr/share/nginx/house3d/;
    try_files $uri $uri/ /maison/index.html;
  }
  location = /maison {
    return 302 /maison/;
  }

  # An explicit way back to the page, for a visitor who wants to start over.
  location = /bienvenue {
    root /usr/share/nginx/html;
    try_files /index.html =404;
    add_header Cache-Control "no-store";
  }

  # Logging out clears the tokens and leaves the cookie, and the cookie is what
  # routes `/` to the product UI — so a visitor who signs out lands on Sowel's
  # login screen, on a shared account whose password they were never given, with
  # no way back but a URL nobody told them about. Clearing the cookie with the
  # session sends them to the landing page instead, which logs them straight back
  # in. An exact-match location outranks the `/api/` prefix below; everything else
  # about the request is proxied identically.
  location = /api/v1/auth/logout {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    add_header Set-Cookie "showroom=; path=/; max-age=0; samesite=lax" always;
  }

  # --- The API -----------------------------------------------------------
  location /api/ {
    if ($denied) {
      return 403;
    }
    # `delay=6` over a burst of 12: the first six actions go straight through, the
    # next six are held back to the sustained rate, and only past that does a
    # caller get a 429.
    #
    # The first attempt used `burst=5 nodelay`, which refused everything past the
    # fifth — measured: thirty-five quick mutations gave five accepted and thirty
    # rejected. Correct by the spec's numbers and wrong for a visitor, who clicks
    # a lamp, a shutter and a mode in four seconds and would be told no. Delaying
    # makes the house feel momentarily slow; refusing makes it feel broken. A
    # script still gets throttled, which is the only thing this is for.
    limit_req zone=mutations burst=12 delay=6;

    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_read_timeout 60s;
  }

  # --- The WebSocket -----------------------------------------------------
  # One connection per visitor, carrying the whole live house. Never rate-limited:
  # throttling it would break the thing the demo is for.
  location = /ws {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 3600s;
    proxy_send_timeout 3600s;
  }

  # --- The product UI ----------------------------------------------------
  location / {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
  }
}
FOOTER
}

if [ "$MODE" = "--check" ]; then
  if ! diff -u "$OUT" <(generate) > /tmp/proxy-conf.diff 2>&1; then
    echo "❌ $OUT has drifted from $DENY_LIST. Run scripts/generate-proxy-conf.sh:" >&2
    head -40 /tmp/proxy-conf.diff >&2
    exit 1
  fi
  echo "✓ $OUT matches $DENY_LIST"
else
  generate > "$OUT"
  echo "✓ wrote $OUT from $DENY_LIST"
fi
