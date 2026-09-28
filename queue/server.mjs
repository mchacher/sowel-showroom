// The queue service (spec 005). Node 24, no dependency.
//
//   GET  /queue/stream         server-sent events: the queue and the journal, per visitor
//   POST /queue/journey        {"journey": "<id>"}: queue a journey (the window runs it)
//   *    /api/...              a visitor's order, sent here by the proxy instead of Sowel
//
// The visitor is the `showroom_visitor` cookie the window sets. What runs when is
// queue.mjs; this file is the plumbing: HTTP, Sowel's API and its activity feed.

import http from "node:http";
import { createQueue } from "./queue.mjs";

const PORT = Number(process.env.PORT ?? 8090);
const SOWEL = process.env.SOWEL_URL ?? "http://sowel:3000";
const GUEST = { username: process.env.GUEST_USERNAME, password: process.env.GUEST_PASSWORD };
const JOURNAL_SENT = 40;

const log = (msg, extra = {}) =>
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), msg, ...extra }) + "\n");

// ── Sowel: the guest's session, names for the journal, the activity feed ─────
let token = null;
let tokenAt = 0;
const names = { equipments: new Map(), zones: new Map(), modes: new Map() };

async function login() {
  if (token && Date.now() - tokenAt < 10 * 60_000) return token;
  const res = await fetch(`${SOWEL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(GUEST),
  });
  if (!res.ok) throw new Error(`login → ${res.status}`);
  token = (await res.json()).accessToken;
  tokenAt = Date.now();
  return token;
}

async function get(path) {
  const res = await fetch(`${SOWEL}${path}`, {
    headers: { Authorization: `Bearer ${await login()}` },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status}`);
  return res.json();
}

async function refreshNames() {
  try {
    const [equipments, zones, modes] = await Promise.all([
      get("/api/v1/equipments"),
      get("/api/v1/zones"),
      get("/api/v1/modes"),
    ]);
    names.equipments = new Map(equipments.map((e) => [e.id, { name: e.name, zoneId: e.zoneId }]));
    const flat = (list) => list.flatMap((z) => [z, ...flat(z.children ?? [])]);
    names.zones = new Map(flat(zones).map((z) => [z.id, z.name]));
    names.modes = new Map(modes.map((m) => [m.id, m.name]));
  } catch (err) {
    log("names not refreshed", { err: String(err) });
  }
}

const KEPT = new Set(["motion.detected", "order.executed", "mode.activated", "mode.deactivated"]);

function followActivity() {
  const connect = async () => {
    let ws;
    try {
      ws = new WebSocket(`${SOWEL.replace(/^http/, "ws")}/ws`, [`bearer.${await login()}`]);
    } catch (err) {
      log("activity feed: cannot connect", { err: String(err) });
      return setTimeout(connect, 5_000);
    }
    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ type: "subscribe", topics: ["activity"] }));
      log("activity feed: connected");
    });
    ws.addEventListener("message", (event) => {
      let data;
      try {
        data = JSON.parse(String(event.data));
      } catch {
        return;
      }
      for (const e of Array.isArray(data) ? data : [data]) {
        const params = e?.item?.message?.params ?? {};
        // A simulation order is the demo's plumbing — a ghost's move carries the
        // visitor's id — never a thing that happened in the house.
        if (String(params.alias ?? "").startsWith("sim.")) continue;
        if (e?.type === "activity.added" && KEPT.has(e.item?.message?.template)) {
          // The room, by name: "Lumière" alone says nothing in a house with twelve.
          queue.activity({ ...e.item, zoneName: names.zones.get(e.item.zoneId) ?? null });
          broadcast();
        }
      }
    });
    ws.addEventListener("close", () => {
      token = null;
      setTimeout(connect, 3_000);
    });
    ws.addEventListener("error", () => {});
  };
  void connect();
}

// ── What an order is, for the journal and for "Suivre" ──────────────────────
function describe(method, path, body) {
  const value = body && typeof body === "object" ? body.value : undefined;
  let m = path.match(/^\/api\/v1\/equipments\/([^/]+)\/orders\/([^/?]+)/);
  if (m) {
    const e = names.equipments.get(m[1]);
    return { type: "order", equipment: e?.name ?? "un équipement", zoneId: e?.zoneId ?? null, zoneName: names.zones.get(e?.zoneId) ?? null, alias: decodeURIComponent(m[2]), value };
  }
  m = path.match(/^\/api\/v1\/zones\/([^/]+)\/orders\/([^/?]+)/);
  if (m) return { type: "zone-order", zone: names.zones.get(m[1]) ?? "une pièce", zoneId: m[1], zoneName: names.zones.get(m[1]) ?? null, key: m[2], value };
  m = path.match(/^\/api\/v1\/modes\/([^/]+)\/(activate|deactivate|apply-to-zone)(?:\/([^/?]+))?/);
  if (m) return { type: "mode", mode: names.modes.get(m[1]) ?? "un mode", action: m[2], zoneId: m[3] ?? null };
  m = path.match(/^\/api\/v1\/equipments\/([^/]+)\/timed-action/);
  if (m) {
    const e = names.equipments.get(m[1]);
    return { type: "timed-action", equipment: e?.name ?? "un équipement", zoneId: e?.zoneId ?? null, zoneName: names.zones.get(e?.zoneId) ?? null, cancel: method === "DELETE" };
  }
  return { type: "other" };
}

async function forward(request) {
  const res = await fetch(`${SOWEL}${request.path}`, {
    method: request.method,
    headers: request.headers,
    body: request.body || undefined,
  });
  return res.ok;
}

// ── The queue, and everyone watching it ─────────────────────────────────────
const queue = createQueue({ forward });
const streams = new Set(); // { id, res }

function broadcast() {
  const now = Date.now();
  for (const s of streams) {
    const view = queue.view(s.id, now);
    view.journal = view.journal.slice(0, JOURNAL_SENT);
    s.res.write(`event: state\ndata: ${JSON.stringify(view)}\n\n`);
  }
}

setInterval(async () => {
  if (await queue.tick(Date.now())) broadcast();
}, 250);
setInterval(broadcast, 5_000);

function visitorOf(req) {
  const cookie = /(?:^|;\s*)showroom_visitor=([a-z0-9]{1,24})(?:;|$)/.exec(req.headers.cookie ?? "");
  if (cookie) return cookie[1];
  const ip = String(req.headers["x-real-ip"] ?? req.socket.remoteAddress ?? "unknown");
  return `anon-${ip.replace(/[^0-9a-f.:]/gi, "")}`;
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 16_384) req.destroy();
    });
    req.on("end", () => resolve(body));
  });
}

function json(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

const PENDING = {
  error: "Une action à toi est déjà dans la file : attends ton tour. — One of your actions is already queued.",
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://queue");
  const id = visitorOf(req);

  if (req.method === "GET" && url.pathname === "/queue/stream") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });
    const stream = { id, res };
    streams.add(stream);
    queue.connect(id, Date.now());
    broadcast();
    const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
    req.on("close", () => {
      clearInterval(ping);
      streams.delete(stream);
      queue.disconnect(id, Date.now());
    });
    return;
  }

  if (req.method === "POST" && url.pathname === "/queue/journey") {
    let journey;
    try {
      journey = JSON.parse(await readBody(req)).journey;
    } catch {
      return json(res, 400, { error: "bad body" });
    }
    const result = queue.enqueue(id, "journey", { journey }, Date.now());
    if (!result.ok) return json(res, result.reason === "pending" ? 409 : 400, result.reason === "pending" ? PENDING : { error: "unknown journey" });
    broadcast();
    return json(res, 200, { success: true, queued: result.position });
  }

  if (url.pathname.startsWith("/api/")) {
    const raw = await readBody(req);
    const request = {
      method: req.method,
      path: url.pathname + url.search,
      headers: {
        ...(req.headers.authorization ? { Authorization: req.headers.authorization } : {}),
        ...(raw ? { "Content-Type": "application/json" } : {}),
      },
      body: raw,
    };
    // A ghost is the visitor's own presence, not an action on the house, and the
    // holder of the running journey acts during it: both go straight through.
    if (/\/orders\/sim\.ghost$/.test(url.pathname) || queue.holds(id)) {
      const upstream = await fetch(`${SOWEL}${request.path}`, {
        method: request.method,
        headers: request.headers,
        body: raw || undefined,
      }).catch(() => null);
      if (!upstream) return json(res, 502, { error: "Sowel unreachable" });
      res.writeHead(upstream.status, { "Content-Type": upstream.headers.get("content-type") ?? "application/json" });
      return res.end(await upstream.text());
    }
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      /* forwarded as is; Sowel will say */
    }
    const result = queue.enqueue(id, "order", describe(req.method, url.pathname, body), Date.now(), request);
    if (!result.ok) return json(res, 409, PENDING);
    broadcast();
    return json(res, 200, { success: true, queued: result.position });
  }

  json(res, 404, { error: "not found" });
});

server.listen(PORT, () => log("queue listening", { port: PORT }));
void refreshNames();
setInterval(refreshNames, 60_000);
followActivity();
