// The live demo, floating over the Sowel interface (spec 005).
//
// The proxy loads this file into every page of the interface (nginx.conf, the
// `sub_filter` in the UI locations). A file rather than inline code because the
// interface's CSP allows scripts from this origin and none inline; the styles are a
// <style> element, which its `style-src 'unsafe-inline'` allows.
//
// What it is: the floating window of spec 004 — dragged by its bar, resized from its
// top-left corner, reduced to a pill, opened full screen — now holding the demo:
//
//   - the 3D house (`/maison/?mini=1`), with a journal over it: every action a visitor
//     queued, and what Sowel did about it (FR4);
//   - a strip below: the action running now, the visitor's own place in the queue,
//     "Suivre", and the actions to add (FR2, FR3). Unfolded, the whole queue.
//
// Everything a visitor does goes through the queue service (queue/server.mjs), clicks
// in Sowel included — the proxy sends them there. This script follows the queue over
// server-sent events: when an action starts, every visitor's 3D walks its figure, and
// with "Suivre" on, Sowel opens its room and points at what changed (FR5).
//
// Reduced, the iframe is removed rather than hidden: a WebGL scene rendering at sixty
// frames a second behind a pill is a phone's battery for nothing.
(() => {
  if (window.top !== window.self) return;

  const KEY = "showroom_mini";
  const MIN_W = 300;
  const MIN_H = 360;
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const write = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {
      /* it holds for this page */
    }
  };

  const lang =
    read("sowel_language") === "en" || (!read("sowel_language") && !/^fr/i.test(navigator.language))
      ? "en"
      : "fr";
  const T = {
    fr: {
      title: "Maison 3D",
      full: "Plein écran",
      back: "Revenir en vignette (Échap)",
      reduce: "Réduire",
      open: "Afficher la maison en 3D",
      visitors: (n) => (n > 1 ? `${n} visiteurs` : "1 visiteur"),
      running: "En cours",
      idle: "Personne n'agit : choisis une action.",
      mine: "Toi",
      yourTurn: (pos, eta) => `Ton action : ${pos === 1 ? "la prochaine" : `${pos}e`} · ~${eta} s`,
      yourRunning: "C'est ton tour : regarde la maison.",
      choose: "Choisis une action :",
      follow: "Suivre",
      followOn: "Sowel suit l'action en cours",
      followOff: "Sowel ne suit pas",
      queue: "File d'attente",
      showQueue: "Voir la file",
      hideQueue: "Replier",
      journal: "Journal",
      noJournal: "Rien encore : la maison attend.",
      readOnly:
        "Démo en lecture seule : tu peux tout regarder, piloter la maison et changer de mode, mais pas modifier la configuration.",
      queued: (n) => `Ton action est dans la file (${n === 1 ? "la prochaine" : `${n}e`}) : regarde la maison.`,
      presence: "mouvement",
      mode: (name, on) => `mode ${name} ${on ? "activé" : "désactivé"}`,
      failed: " (échec)",
      ask: (on) => (on ? "allumer" : "éteindre"),
      does: (on) => (on ? "allume" : "éteint"),
      itself: (on) => (on ? "s'allume" : "s'éteint"),
      bubbleJourney: (who, mine, recipe) =>
        mine ? `${recipe} t'a vu entrer, et a agi.` : `${recipe} a vu ${who} entrer, et a agi.`,
      bubbleOrder: (who, mine, what) => (mine ? `Tu as demandé : ${what}.` : `${who} a demandé : ${what}.`),
      bubbleCold: (who, mine) =>
        `${mine ? "Tu as ouvert" : `${who} a ouvert`} la fenêtre : la pompe à chaleur repart d'elle-même.`,
    },
    en: {
      title: "3D house",
      full: "Full screen",
      back: "Back to the vignette (Esc)",
      reduce: "Minimise",
      open: "Show the house in 3D",
      visitors: (n) => (n > 1 ? `${n} visitors` : "1 visitor"),
      running: "Running",
      idle: "Nobody is acting: pick an action.",
      mine: "You",
      yourTurn: (pos, eta) => `Your action: ${pos === 1 ? "next" : `#${pos}`} · ~${eta} s`,
      yourRunning: "Your turn: watch the house.",
      choose: "Pick an action:",
      follow: "Follow",
      followOn: "Sowel follows the running action",
      followOff: "Sowel does not follow",
      queue: "Queue",
      showQueue: "See the queue",
      hideQueue: "Fold",
      journal: "Journal",
      noJournal: "Nothing yet: the house is waiting.",
      readOnly:
        "Read-only demo: look at everything, drive the house and switch modes, but the configuration stays as it is.",
      queued: (n) => `Your action is queued (${n === 1 ? "next" : `#${n}`}): watch the house.`,
      presence: "motion",
      mode: (name, on) => `mode ${name} ${on ? "on" : "off"}`,
      failed: " (failed)",
      ask: (on) => (on ? "turn on" : "turn off"),
      does: (on) => (on ? "turns on" : "turns off"),
      itself: (on) => (on ? "turns on" : "turns off"),
      bubbleJourney: (who, mine, recipe) =>
        mine ? `${recipe} saw you walk in, and acted.` : `${recipe} saw ${who} walk in, and acted.`,
      bubbleOrder: (who, mine, what) => (mine ? `You asked to ${what}.` : `${who} asked to ${what}.`),
      bubbleCold: (who, mine) => `${mine ? "You" : who} opened the window: the heat pump starts on its own.`,
    },
  }[lang];

  // The journeys (spec 004, amended): where the figure walks, the room's zone in Sowel,
  // what to point at there, and for the office the cold let in. The queue grants the
  // slot; this window runs the journey when the slot is its own.
  const JOURNEYS = {
    "salle-de-bain": {
      zone: "Salle de Bain",
      recipe: "Motion Light",
      fr: "Entrer dans la salle de bain",
      en: "Walk into the bathroom",
    },
    "chambre-enfant-2": {
      zone: "Chambre Enfant 2",
      recipe: "Presence Heater",
      fr: "Aller dans la chambre d'enfant",
      en: "Go to the child's room",
    },
    sejour: {
      zone: "Séjour",
      recipe: "Motion Light Dimmable",
      fr: "S'installer au séjour",
      en: "Settle in the living room",
    },
    bureau: {
      zone: "Bureau",
      nudge: { alias: "sim.temperature", value: 15 },
      fr: "Ouvrir la fenêtre du bureau",
      en: "Open the office window",
    },
  };

  // ── Who this visitor is: the id the 3D uses for its ghost, and a cookie so that a
  // click anywhere in Sowel carries it to the queue (spec 005, FR6). ─────────────
  let visitor = read("showroom_visitor");
  if (!visitor || !/^[a-z0-9]{1,24}$/.test(visitor)) {
    visitor = `v${Math.random().toString(36).slice(2, 10)}`;
    write("showroom_visitor", visitor);
  }
  document.cookie = `showroom_visitor=${visitor}; path=/; max-age=31536000; samesite=lax`;

  const defaults = () => ({
    // Open on a desk, a pill on a phone: over a phone's interface it is a sheet.
    open: innerWidth >= 900,
    w: Math.min(480, Math.round(innerWidth * 0.36)),
    h: Math.min(600, Math.round(innerHeight * 0.74)),
    right: 20,
    bottom: 84,
    follow: true,
    queueOpen: false,
  });
  let state = defaults();
  try {
    state = { ...state, ...JSON.parse(read(KEY) || "{}") };
  } catch {
    /* a broken preference is no preference */
  }
  const save = () => write(KEY, JSON.stringify(state));

  const style = document.createElement("style");
  style.textContent = `
    #sm-window, #sm-pill { position: fixed; z-index: 2147483000; font: 500 13px Inter, system-ui, sans-serif; color: #10283a; }
    #sm-window { display: flex; flex-direction: column; background: #eef5f8; border-radius: 12px;
      overflow: hidden; box-shadow: 0 12px 36px rgba(20,65,89,.32), 0 0 0 1px rgba(26,79,110,.18); }
    #sm-bar { display: flex; align-items: center; gap: 8px; height: 34px; padding: 0 6px 0 12px; flex-shrink: 0;
      background: #1a4f6e; color: #fff; cursor: grab; touch-action: none; user-select: none; }
    #sm-bar.dragging { cursor: grabbing; }
    #sm-bar .title { flex: 1; font-size: 12px; font-weight: 700; letter-spacing: .02em; }
    #sm-bar .count { font-size: 11px; font-weight: 600; padding: 2px 8px; border-radius: 999px; background: rgba(255,255,255,.14); }
    #sm-bar button { all: unset; display: grid; place-items: center; width: 28px; height: 26px;
      border-radius: 6px; cursor: pointer; color: #fff; opacity: .85; }
    #sm-bar button:hover, #sm-bar button:focus-visible { background: rgba(255,255,255,.16); opacity: 1; }
    #sm-stage { position: relative; flex: 1; min-height: 120px; }
    #sm-stage iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; background: #eef5f8; }
    #sm-window.busy iframe { pointer-events: none; }
    #sm-journal { position: absolute; left: 8px; bottom: 8px; max-width: calc(100% - 16px); width: 290px;
      padding: 7px 9px; border-radius: 9px; background: rgba(16,40,58,.82); color: #fff;
      font: 500 11px/1.35 Inter, system-ui, sans-serif; display: flex; flex-direction: column; gap: 3px;
      max-height: 45%; overflow: hidden; cursor: pointer; }
    #sm-journal.open { max-height: 80%; overflow: auto; cursor: default; }
    /* Full screen, the 3D shows its own room list bottom left: the journal goes right,
       under the sun dial and above the storey switch. On a phone, top left: the storey
       switch holds the bottom. */
    #sm-window.full #sm-journal { left: auto; right: 16px; top: 170px; bottom: auto; width: 320px; max-height: calc(100% - 260px); }
    #sm-window.sheet #sm-journal { top: 8px; bottom: auto; width: 64%; max-height: 40%; }
    #sm-journal .line { display: flex; gap: 7px; }
    #sm-journal time { flex-shrink: 0; color: #9fb6c3; font: 400 10px/1.5 "JetBrains Mono", ui-monospace, monospace; }
    #sm-journal .action { color: #fff; font-weight: 700; }
    #sm-journal .mine { color: #f2c035; }
    #sm-journal .recipe { color: #f2c035; font-weight: 600; }
    #sm-journal .done { color: #a8e4c4; }
    #sm-journal .empty { color: #9fb6c3; }
    #sm-grip { position: absolute; left: 0; top: 34px; width: 16px; height: 16px; cursor: nwse-resize; z-index: 2;
      touch-action: none; background: linear-gradient(135deg, rgba(26,79,110,.55) 0 30%, transparent 30%); }
    #sm-strip { flex-shrink: 0; background: #fff; border-top: 1px solid #dde5ea; padding: 10px 12px 12px;
      display: flex; flex-direction: column; gap: 8px; }
    #sm-strip .row { display: flex; align-items: center; gap: 8px; }
    #sm-strip .badge { flex-shrink: 0; padding: 3px 7px; border-radius: 6px; font: 700 10px Inter, system-ui, sans-serif;
      letter-spacing: .04em; text-transform: uppercase; background: #1a4f6e; color: #fff; }
    #sm-strip .badge.mine { background: #f2c035; color: #10283a; }
    #sm-strip .now { flex: 1; min-width: 0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    #sm-strip .eta { font: 500 12px "JetBrains Mono", ui-monospace, monospace; color: #1a4f6e; }
    #sm-strip .me { flex: 1; color: #4a5b66; }
    #sm-strip .actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px; }
    #sm-strip button { all: unset; box-sizing: border-box; cursor: pointer; border-radius: 8px; font: 600 12px/1.25 Inter, system-ui, sans-serif; }
    #sm-strip .actions button { padding: 8px 10px; min-height: 40px; background: #fff; box-shadow: 0 0 0 1px #c9d6dd; color: #10283a; }
    #sm-strip .actions button:hover, #sm-strip .actions button:focus-visible { box-shadow: 0 0 0 2px #1a4f6e; }
    #sm-strip .actions button[disabled] { background: #eef2f4; color: #6b7b85; box-shadow: none; cursor: default; }
    #sm-strip .toggle { padding: 5px 9px; background: #eef5f8; color: #1a4f6e; }
    #sm-strip .toggle[aria-pressed="true"] { background: #1a4f6e; color: #fff; }
    #sm-strip .link { padding: 4px 6px; color: #1a4f6e; text-decoration: underline; }
    #sm-strip ol { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 4px; max-height: 110px; overflow: auto; }
    #sm-strip li { display: flex; gap: 8px; padding: 5px 8px; border-radius: 7px; background: #f6f8f9; }
    #sm-strip li.mine { background: #fffbef; box-shadow: 0 0 0 1px #f2c035; }
    #sm-pill { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-radius: 999px;
      background: #1a4f6e; color: #fff; cursor: pointer; box-shadow: 0 6px 20px rgba(20,65,89,.35); font-weight: 600; }
    #sm-pill:hover { background: #144159; }
    /* Full screen: over the whole page, a margin and a dimmed backdrop, so it still
       reads as a window over Sowel rather than a different site. */
    #sm-window.full { top: 12px !important; right: 12px !important; bottom: 12px !important;
      left: 12px !important; width: auto !important; height: auto !important;
      box-shadow: 0 0 0 100vmax rgba(10,30,45,.38), 0 18px 48px rgba(20,65,89,.4); }
    #sm-window.full #sm-bar { cursor: default; }
    #sm-window.full #sm-grip { display: none; }
    /* A phone: a sheet along the bottom, not a window to drag. */
    #sm-window.sheet { left: 0 !important; right: 0 !important; bottom: 0 !important; top: auto !important;
      width: auto !important; height: 62vh !important; border-radius: 16px 16px 0 0; }
    #sm-window.sheet #sm-grip { display: none; }
    #sm-window.sheet #sm-bar { cursor: default; }
    #sm-strip .why { margin-top: -4px; color: #4a5b66; font-size: 12px; line-height: 1.35; }
    #sm-toast { position: fixed; z-index: 2147483002; left: 50%; bottom: 80px; transform: translateX(-50%);
      max-width: min(560px, calc(100vw - 32px)); padding: 10px 16px; border-radius: 10px; background: #1a4f6e;
      color: #fff; font: 500 13px/1.4 Inter, system-ui, sans-serif; box-shadow: 0 10px 30px rgba(20,65,89,.35);
      border-left: 4px solid #f2c035; opacity: 0; pointer-events: none; transition: opacity .2s; }
    #sm-toast.shown { opacity: 1; }
  `;
  document.head.appendChild(style);

  const el = (tag, attrs = {}, text = "") => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    if (text) node.textContent = text;
    return node;
  };

  // ── A toast, for what the interface would otherwise not say ─────────────────
  const toast = el("div", { id: "sm-toast", role: "status" });
  let toastTimer = 0;
  const say = (text) => {
    toast.textContent = text;
    if (!toast.isConnected) document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("shown"));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("shown"), 5000);
  };

  // The proxy's refusals and the queue's answers reach the interface's own fetch
  // calls; some pages show them, some swallow them. Read here, once for every page.
  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const res = await nativeFetch(...args);
    if (res.status === 403 || res.status === 409 || res.ok) {
      res
        .clone()
        .text()
        .then((body) => {
          if (res.status === 403 && body.includes("lecture seule")) say(T.readOnly);
          else if (res.status === 409 && body.includes("déjà dans la file")) say(JSON.parse(body).error);
          else if (res.ok && body.startsWith("{") && body.includes('"queued"')) {
            const queued = JSON.parse(body).queued;
            if (typeof queued === "number") say(T.queued(queued));
          }
        })
        .catch(() => {});
    }
    return res;
  };

  // ── The window ──────────────────────────────────────────────────────────────
  const cube =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>';
  const icon = {
    full: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>',
    reduce:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  };

  const win = el("div", { id: "sm-window" });
  win.innerHTML = `
    <div id="sm-bar">
      <span class="title">${T.title}</span>
      <span class="count" id="sm-count"></span>
      <button type="button" data-act="full" title="${T.full}" aria-label="${T.full}">${icon.full}</button>
      <button type="button" data-act="reduce" title="${T.reduce}" aria-label="${T.reduce}">${icon.reduce}</button>
    </div>
    <div id="sm-grip" title="↖"></div>
    <div id="sm-stage">
      <div id="sm-journal" role="log" aria-label="${T.journal}" title="${T.journal}"></div>
    </div>
    <div id="sm-strip">
      <div class="row" id="sm-now"></div>
      <div class="why" id="sm-why" hidden></div>
      <div class="row">
        <span class="me" id="sm-me"></span>
        <button type="button" class="toggle" id="sm-follow" title="${T.followOn}">${T.follow}</button>
        <button type="button" class="link" id="sm-queue-toggle"></button>
      </div>
      <ol id="sm-queue" hidden></ol>
      <div class="actions" id="sm-actions"></div>
    </div>`;
  const pill = el("button", { id: "sm-pill", type: "button", title: T.open });
  pill.innerHTML = `${cube}3D`;
  const $ = (sel) => win.querySelector(sel);
  const stage = $("#sm-stage");
  const journalBox = $("#sm-journal");

  const actionsBox = $("#sm-actions");
  for (const [id, journey] of Object.entries(JOURNEYS)) {
    const button = el("button", { type: "button", "data-journey": id }, journey[lang]);
    actionsBox.appendChild(button);
  }

  const isPhone = () => innerWidth < 640;
  const clamp = () => {
    state.w = Math.max(MIN_W, Math.min(state.w, innerWidth - 16));
    state.h = Math.max(MIN_H, Math.min(state.h, innerHeight - 16));
    state.right = Math.max(0, Math.min(state.right, innerWidth - state.w));
    state.bottom = Math.max(0, Math.min(state.bottom, innerHeight - state.h));
  };
  const place = () => {
    win.classList.toggle("sheet", isPhone());
    clamp();
    Object.assign(win.style, {
      width: `${state.w}px`,
      height: `${state.h}px`,
      right: `${state.right}px`,
      bottom: `${state.bottom}px`,
    });
    Object.assign(pill.style, { right: `${state.right}px`, bottom: `${state.bottom}px` });
  };

  let frame = null;
  let full = false;

  // The 3D app reads its anchor (house-3d spec 003, amended): `full`, `walk`, and for
  // another visitor's walk `who` and `me=0` (its spec 005, amended). A timestamp makes
  // the same walk twice a change the app hears.
  const tell = (extra = "") => {
    const parts = [full ? "full" : "", extra].filter(Boolean);
    try {
      if (frame?.contentWindow) frame.contentWindow.location.hash = parts.join("&");
    } catch {
      /* not loaded yet */
    }
  };
  const setFull = (next) => {
    full = next;
    win.classList.toggle("full", full);
    const button = $('[data-act="full"]');
    button.innerHTML = full ? icon.back : icon.full;
    button.title = full ? T.back : T.full;
    button.setAttribute("aria-label", button.title);
    tell();
  };

  const signedIn = () => Boolean(read("sowel_access_token"));
  const render = () => {
    const mounted = win.isConnected || pill.isConnected;
    // Nothing on the login screen: the 3D would only say there is no session.
    if (!signedIn()) {
      win.remove();
      pill.remove();
      frame = null;
      return;
    }
    if (state.open) {
      pill.remove();
      if (!frame) {
        frame = el("iframe", { src: "/maison/?mini=1", title: T.title });
        stage.insertBefore(frame, journalBox);
      }
      if (!win.isConnected) document.body.appendChild(win);
    } else {
      if (full) setFull(false);
      frame?.remove();
      frame = null;
      win.remove();
      if (!pill.isConnected) document.body.appendChild(pill);
    }
    if (!mounted) place();
  };

  $('[data-act="reduce"]').addEventListener("click", () => {
    state.open = false;
    save();
    render();
  });
  $('[data-act="full"]').addEventListener("click", () => setFull(!full));
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && full) setFull(false);
  });
  pill.addEventListener("click", () => {
    state.open = true;
    save();
    render();
  });

  // ── Sowel's API, with the visitor's own session ─────────────────────────────
  const api = async (path, init = {}) => {
    const res = await fetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${read("sowel_access_token")}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) throw new Error(`${path} → ${res.status}`);
    return res.json();
  };
  let zonesCache = null;
  const zones = async () => {
    if (!zonesCache) {
      const flat = (list) => list.flatMap((z) => [z, ...flat(z.children || [])]);
      zonesCache = flat(await api("/api/v1/zones"));
    }
    return zonesCache;
  };

  // ── Queueing ────────────────────────────────────────────────────────────────
  actionsBox.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-journey]");
    if (!button || button.disabled) return;
    try {
      const res = await fetch("/queue/journey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journey: button.dataset.journey }),
      });
      // The fetch hook above already says "queued" or "already one of yours".
      if (!res.ok && res.status !== 409) say(T.idle);
    } catch {
      /* the stream will show nothing changed */
    }
  });

  const followButton = $("#sm-follow");
  const syncFollow = () => {
    followButton.setAttribute("aria-pressed", String(state.follow));
    followButton.title = state.follow ? T.followOn : T.followOff;
  };
  followButton.addEventListener("click", () => {
    state.follow = !state.follow;
    save();
    syncFollow();
  });
  syncFollow();

  const queueToggle = $("#sm-queue-toggle");
  const queueList = $("#sm-queue");
  const syncQueue = () => {
    queueList.hidden = !state.queueOpen;
    queueToggle.textContent = state.queueOpen ? T.hideQueue : T.showQueue;
  };
  queueToggle.addEventListener("click", () => {
    state.queueOpen = !state.queueOpen;
    save();
    syncQueue();
  });
  syncQueue();
  journalBox.addEventListener("click", () => journalBox.classList.toggle("open"));

  // ── Words for what happened ─────────────────────────────────────────────────
  const onOff = (value) =>
    value === true || value === "ON" || value === "on" ? true : value === false || value === "OFF" || value === "off" ? false : null;
  const whatWords = (what) => {
    if (what.kind === "journey") return JOURNEYS[what.journey]?.[lang] ?? what.journey;
    if (what.type === "order") {
      const on = onOff(what.value);
      return on === null ? `${what.equipment} → ${what.value}` : `${T.ask(on)} ${what.equipment}`;
    }
    if (what.type === "zone-order") return `${what.zone} : ${what.key} → ${String(what.value)}`;
    if (what.type === "mode") return T.mode(what.mode, what.action !== "deactivate");
    if (what.type === "timed-action") return `${what.equipment} ⏲`;
    return "…";
  };
  const time = (at) =>
    new Date(at).toLocaleTimeString(lang === "fr" ? "fr-FR" : "en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const journalLine = (entry) => {
    const line = el("div", { class: "line" });
    line.appendChild(el("time", {}, time(entry.at)));
    const text = el("span");
    if (entry.kind === "action") {
      text.className = entry.mine ? "action mine" : "action";
      text.textContent = `${entry.mine ? T.mine : entry.who} : ${whatWords(entry.what)}${entry.what.failed ? T.failed : ""}`;
    } else {
      const item = entry.what;
      const p = item.message?.params ?? {};
      const template = item.message?.template;
      if (template === "motion.detected") {
        text.textContent = `${p.equipmentName} : ${T.presence}`;
      } else if (template === "order.executed") {
        const by = item.source?.recipeName;
        const on = onOff(p.value);
        if (by) {
          text.appendChild(el("span", { class: "recipe" }, `${by} `));
          text.appendChild(
            el("span", { class: "done" }, on === null ? `→ ${p.equipmentName} ${p.value}` : `${T.does(on)} ${p.equipmentName}`),
          );
        } else {
          text.appendChild(
            el("span", { class: "done" }, on === null ? `${p.equipmentName} → ${p.value}` : `${p.equipmentName} ${T.itself(on)}`),
          );
        }
      } else if (template === "mode.activated" || template === "mode.deactivated") {
        text.textContent = T.mode(p.modeName ?? p.name ?? "", template === "mode.activated");
      } else return null;
    }
    line.appendChild(text);
    return line;
  };

  // ── Following the queue ─────────────────────────────────────────────────────
  let offset = 0; // server clock minus ours
  let whyText = ""; // what the running action shows, in words: under it in the strip
  let last = null;
  let runningKey = null;

  const renderStrip = (view) => {
    $("#sm-count").textContent = T.visitors(Math.max(1, view.visitors));
    const now = $("#sm-now");
    now.replaceChildren();
    const eta = (until) => Math.max(0, Math.round((until - (Date.now() + offset)) / 1000));
    if (view.running) {
      now.appendChild(el("span", { class: `badge${view.running.mine ? " mine" : ""}` }, T.running));
      now.appendChild(el("span", { class: "now" }, `${view.running.mine ? T.mine : view.running.who} · ${whatWords({ kind: view.running.kind, ...view.running.what })}`));
      now.appendChild(el("span", { class: "eta" }, `${eta(view.running.until)} s`));
    } else {
      now.appendChild(el("span", { class: "now" }, T.idle));
    }
    const why = $("#sm-why");
    why.textContent = view.running ? whyText : "";
    why.hidden = !view.running || !whyText;
    const myIndex = view.waiting.findIndex((w) => w.mine);
    const me = $("#sm-me");
    if (view.running?.mine) me.textContent = T.yourRunning;
    else if (myIndex >= 0) {
      const ahead = view.waiting.slice(0, myIndex);
      const wait = (view.running ? eta(view.running.until) : 0) + ahead.reduce((s, w) => s + (w.kind === "journey" ? 20 : 3), 0);
      me.textContent = T.yourTurn(myIndex + 1, wait);
    } else me.textContent = T.choose;
    const pending = myIndex >= 0 || view.running?.mine;
    for (const button of actionsBox.querySelectorAll("button")) button.disabled = Boolean(pending);
    queueList.replaceChildren(
      ...view.waiting.map((w, i) => {
        const li = el("li", { class: w.mine ? "mine" : "" });
        li.appendChild(el("strong", {}, `${i + 1}.`));
        li.appendChild(el("span", {}, `${w.mine ? T.mine : w.who} · ${whatWords({ kind: w.kind, ...w.what })}`));
        return li;
      }),
    );
  };

  const renderJournal = (view) => {
    const lines = view.journal.map(journalLine).filter(Boolean);
    journalBox.replaceChildren(...(lines.length ? lines : [el("div", { class: "empty" }, T.noJournal)]));
  };

  // When an action starts: the 3D walks its figure, the office gets its cold, and
  // Sowel, if following, opens the room and points at what changed (FR5).
  const onStart = async (running) => {
    const what = running.what;
    let zoneName = null;
    let bubble = null;
    if (running.kind === "journey") {
      const journey = JOURNEYS[what.journey];
      if (!journey) return;
      zoneName = journey.zone;
      if (!journey.nudge) {
        tell(
          running.mine
            ? `walk=${what.journey}&t=${Date.now()}`
            : `walk=${what.journey}&who=${encodeURIComponent(running.who)}&me=0&t=${Date.now()}`,
        );
        bubble = T.bubbleJourney(running.who, running.mine, journey.recipe);
      } else {
        if (running.mine) void nudge(journey);
        bubble = T.bubbleCold(running.who, running.mine);
      }
    } else {
      bubble = T.bubbleOrder(running.who, running.mine, whatWords(what));
    }
    whyText = bubble;
    if (last) renderStrip(last);
    if (!state.follow && !running.mine) return;
    let zoneId = what.zoneId ?? null;
    if (!zoneId && zoneName) {
      try {
        zoneId = (await zones()).find((z) => z.name === zoneName)?.id ?? null;
      } catch {
        /* no zone: the bubble alone */
      }
    }
    if (zoneId && location.pathname !== `/home/${zoneId}`) {
      history.pushState({}, "", `/home/${zoneId}`);
      dispatchEvent(new PopStateEvent("popstate"));
    }
  };

  // The office's cold: a simulated temperature on the room's probe, sent by the
  // visitor whose slot it is — the queue forwards it at once.
  const nudge = async (journey) => {
    try {
      const zoneId = (await zones()).find((z) => z.name === journey.zone)?.id;
      const target = (await api("/api/v1/equipments")).find(
        (e) => e.zoneId === zoneId && e.orderBindings.some((b) => b.alias === journey.nudge.alias),
      );
      if (target)
        await api(`/api/v1/equipments/${target.id}/orders/${encodeURIComponent(journey.nudge.alias)}`, {
          method: "POST",
          body: JSON.stringify({ value: journey.nudge.value }),
        });
    } catch {
      /* the journal will show nothing happened */
    }
  };

  // ── The stream ──────────────────────────────────────────────────────────────
  let source = null;
  const listen = () => {
    if (source || !signedIn()) return;
    source = new EventSource("/queue/stream");
    source.addEventListener("state", (event) => {
      let view;
      try {
        view = JSON.parse(event.data);
      } catch {
        return;
      }
      offset = view.now - Date.now();
      last = view;
      renderStrip(view);
      renderJournal(view);
      const key = view.running ? `${view.running.startedAt}:${view.running.who}` : null;
      if (key && key !== runningKey) void onStart(view.running);
      runningKey = key;
    });
    source.addEventListener("error", () => {
      // EventSource reconnects on its own; a closed one is replaced on the next render.
      if (source?.readyState === EventSource.CLOSED) source = null;
    });
  };
  setInterval(() => last && renderStrip(last), 1000);

  // ── Drag by the bar, resize by the top-left corner ─────────────────────────
  // The window is anchored bottom right, so growing it up and left keeps it still.
  const track = (handle, onMove) => {
    handle.addEventListener("pointerdown", (event) => {
      if (full || isPhone() || event.target.closest("button")) return;
      handle.setPointerCapture(event.pointerId);
      const start = { x: event.clientX, y: event.clientY, ...state };
      win.classList.add("busy");
      handle.classList.add("dragging");
      const move = (e) => {
        onMove(start, e.clientX - start.x, e.clientY - start.y);
        place();
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        handle.removeEventListener("pointercancel", up);
        win.classList.remove("busy");
        handle.classList.remove("dragging");
        save();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
      handle.addEventListener("pointercancel", up);
    });
  };
  track($("#sm-bar"), (s, dx, dy) => {
    state.right = s.right - dx;
    state.bottom = s.bottom - dy;
  });
  track($("#sm-grip"), (s, dx, dy) => {
    state.w = s.w - dx;
    state.h = s.h - dy;
  });
  addEventListener("resize", place);

  render();
  place();
  listen();
  // The interface logs in and out without reloading the page; follow it.
  setInterval(() => {
    render();
    listen();
  }, 2000);
})();
