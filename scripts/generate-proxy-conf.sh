#!/usr/bin/env bash
# Generates `proxy/nginx.conf` from `scripts/write-allowlist.txt` and
# `scripts/admin-reads.txt` (spec 001, FR3 and FR3b, amended 2026-09-27).
#
# The two lists are the data; this is the only thing that turns them into config.
# Run with `--check` to fail when the committed file has drifted from the data,
# which is what `npm run validate` does: a list and a proxy config that disagree
# would be a security rule that exists only on paper.
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

ALLOWLIST="scripts/write-allowlist.txt"
READS="scripts/admin-reads.txt"
OUT="proxy/nginx.conf"
MODE="${1:-write}"

allow_map_entries() {
  grep -E '^(POST|PUT|PATCH|DELETE) ' "$ALLOWLIST" | while read -r method matcher route comment; do
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

refused_read_entries() {
  grep -E '^refuse ' "$READS" | while read -r _ prefix comment; do
    reason="${comment#\# }"
    # The prefix and anything below it, never a sibling that merely starts the
    # same way. Case-insensitive, so a case the router would ignore cannot pass.
    printf '  %-58s 1;  # %s\n' "\"~*^${prefix}(/|\$)\"" "$reason"
  done
}

generate() {
  cat <<'HEADER'
# ============================================================
# GENERATED — do not edit.
#
# Written by `scripts/generate-proxy-conf.sh` from `scripts/write-allowlist.txt`
# and `scripts/admin-reads.txt`, which is where the reasons live. Edit those and
# re-run; `npm run validate` fails when this one has drifted from them.
#
# What this does, in order of how much it matters:
#
#   1. The guest is an admin, read-only here: every write under /api/ is refused
#      unless the write allowlist names it, and so are the few reads that are
#      private (the backup, the users, the audit log). A route the core adds
#      tomorrow is refused until someone names it.
#   2. Rate-limits mutations per IP, so a script cannot drive the house.
#   3. Serves the landing page, and proxies everything else to Sowel.
#
# Sowel's port is not published on the host. The public server below is the way
# in for everyone; the admin server at the end listens on a port published on the
# loopback only, for the reset's own work.
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

# What a visitor may write. Generated from scripts/write-allowlist.txt.
map "$request_method:$uri" $write_allowed {
  default 0;
HEADER
  allow_map_entries
  cat <<'MIDDLE'
}

# What a visitor may not read. Generated from scripts/admin-reads.txt.
map $uri $read_refused {
  default 0;
MIDDLE
  refused_read_entries
  cat <<'FOOTER'
}

map $request_method $is_write {
  default 0;
  POST    1;
  PUT     1;
  PATCH   1;
  DELETE  1;
}

# Refused: a write not on the allowlist, or a private read, whatever the method.
map "$is_write:$write_allowed:$read_refused" $refused {
  default    1;
  "0:0:0"    0;
  "1:1:0"    0;
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
    # The API is under /api/, but a path the location match treats differently
    # (`/API/v1/users`) lands here: the same gate, so nothing reaches Sowel ungated.
    default_type application/json;
    if ($refused) {
      return 403 '{"error":"Démo en lecture seule — read-only demo"}';
    }
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    # Same vignette as in `location /` below.
    # The 3D house, floating over the product UI: a vignette showing the house as
    # it reacts (landing/showroom-ui/mini-house.js). Injected as a same-origin
    # script, which the UI's CSP allows where it allows no inline one; the image
    # stays the published one, and so do its headers — Sowel itself is never framed,
    # only the 3D app inside it.
    proxy_set_header Accept-Encoding "";
    sub_filter_once on;
    sub_filter '</body>' '<script src="/showroom-ui/mini-house.js"></script></body>';
  }

  # The page's own assets, and the guest credentials the reset writes.
  location /showroom/ {
    root /usr/share/nginx/html;
    add_header Cache-Control "no-store";
  }

  # --- The service worker the image ships, replaced by one that does nothing --
  # The PWA's worker is registered at scope "/" with `navigateFallback:
  # "/index.html"`, which means it answers *every* navigation on this origin from
  # the cached Sowel shell. /maison/ therefore never reached nginx: the browser
  # served the Sowel interface, whose router does not know that path and sent the
  # visitor to /login. Proven with a real browser — asking for /maison/ landed on
  # /dashboard, and nothing in the access log, because the network was never asked.
  #
  # `no-store` matters: a worker script the browser is allowed to cache is a worker
  # that cannot be replaced.
  location = /sw.js {
    root /usr/share/nginx/html;
    try_files /sw.js =404;
    add_header Cache-Control "no-store" always;
    add_header Service-Worker-Allowed "/" always;
  }

  # --- What the proxy adds to the product UI ----------------------------
  # The vignette's script. `no-cache` rather than `no-store`: every page of the
  # interface loads it, and a revalidation is enough to pick up a new version.
  location /showroom-ui/ {
    root /usr/share/nginx/html;
    add_header Cache-Control "no-cache";
  }

  # --- The 3D house ------------------------------------------------------
  # Served from this origin on purpose: the landing page's session lives in
  # localStorage, which is per-origin, so putting the app anywhere else would mean
  # a second login. A static build, so no upstream and no API of its own — it talks
  # to Sowel through /api and /ws above, like any other client.
  location /maison/ {
    alias /usr/share/nginx/house3d/;
    try_files $uri $uri/ /maison/index.html;
    # Framed by the vignette over the Sowel UI, on this origin; by no other site.
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Content-Security-Policy "frame-ancestors 'self'" always;
    # Revalidated on every load: a browser holding yesterday's page keeps loading
    # yesterday's bundle, and a fix that does not show is reported as not done.
    # Cheap — an unchanged file answers 304 on its ETag.
    add_header Cache-Control "no-cache" always;
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
    # A read-only demo says so. The product UI shows a failed request's `error`
    # field as its message, so saving a form reads "Démo en lecture seule" rather
    # than "HTTP 403".
    default_type application/json;
    if ($refused) {
      return 403 '{"error":"Démo en lecture seule — read-only demo"}';
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
    # The API is under /api/, but a path the location match treats differently
    # (`/API/v1/users`) lands here: the same gate, so nothing reaches Sowel ungated.
    default_type application/json;
    if ($refused) {
      return 403 '{"error":"Démo en lecture seule — read-only demo"}';
    }
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    # The 3D house, floating over the product UI: a vignette showing the house as
    # it reacts (landing/showroom-ui/mini-house.js). Injected as a same-origin
    # script, which the UI's CSP allows where it allows no inline one; the image
    # stays the published one, and so do its headers — Sowel itself is never framed,
    # only the 3D app inside it.
    proxy_set_header Accept-Encoding "";
    sub_filter_once on;
    sub_filter '</body>' '<script src="/showroom-ui/mini-house.js"></script></body>';
  }
}

# ============================================================
# The admin door (spec 001, FR5, amended 2026-09-27).
#
# The public server refuses every write it does not name, which would refuse the
# reset's own work too: the restore, the guest's creation. This server does not
# gate: compose publishes its port on 127.0.0.1 only, so it is reachable from the
# host — the scripts, or the owner through an SSH tunnel — and from nowhere else.
# No landing page, no vignette, no rate limit: it is Sowel, as it is.
# ============================================================
server {
  listen 8081;
  server_name _;
  access_log /var/log/nginx/access.log combined;
  absolute_redirect off;

  # The restore carries thirty days of history (spec 003): megabytes, and as long
  # as the core's restore takes.
  client_max_body_size 64m;

  location /ws {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $http_host;
    proxy_read_timeout 3600s;
  }

  location / {
    proxy_pass http://sowel;
    proxy_http_version 1.1;
    proxy_set_header Host $http_host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Connection "";
    proxy_read_timeout 900s;
    proxy_send_timeout 900s;
  }
}
FOOTER
}

if [ "$MODE" = "--check" ]; then
  if ! diff -u "$OUT" <(generate) > /tmp/proxy-conf.diff 2>&1; then
    echo "❌ $OUT has drifted from $ALLOWLIST / $READS. Run scripts/generate-proxy-conf.sh:" >&2
    head -40 /tmp/proxy-conf.diff >&2
    exit 1
  fi
  echo "✓ $OUT matches $ALLOWLIST and $READS"
else
  generate > "$OUT"
  echo "✓ wrote $OUT from $ALLOWLIST and $READS"
fi
