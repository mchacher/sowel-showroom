// The 3D house, floating over the Sowel interface.
//
// The proxy loads this file into every page of the interface (nginx.conf, the
// `sub_filter` in the UI locations). A file rather than inline code because the
// interface's CSP allows scripts from this origin and none inline; the styles are a
// <style> element, which its `style-src 'unsafe-inline'` allows.
//
// What it is: a small window, bottom right, holding the 3D app in its mini mode
// (`/maison/?mini=1`): the house from outside, reacting as it happens. So a visitor
// switches on the garden lights in Sowel and watches them come on, without two apps
// squeezed side by side. The camera stays put — it used to fly to whatever was
// clicked, and a view that lurched on every click was harder to watch. The window can be dragged by its bar, resized from
// its top-left corner, reduced to a pill, or opened full screen over the page —
// without leaving Sowel or reloading the 3D, and back with the same button or Esc.
// Where it is and how big is remembered per browser; full screen is not, so a
// reload never lands anyone in a view that covers the interface.
//
// Reduced, the iframe is removed rather than hidden: a WebGL scene rendering at
// sixty frames a second behind a pill is a phone's battery for nothing.
(() => {
  if (window.top !== window.self) return;

  const KEY = "showroom_mini";
  const MIN_W = 260;
  const MIN_H = 180;
  const read = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
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
      try: "Essayer",
      tryTitle: "Essayer : Sowel réagit à ta présence",
      go: "Y aller",
      leave: "Sortir",
      seeInSowel: "Voir dans Sowel",
    },
    en: {
      title: "3D house",
      full: "Full screen",
      back: "Back to the vignette (Esc)",
      reduce: "Minimise",
      open: "Show the house in 3D",
      try: "Try it",
      tryTitle: "Try it: Sowel reacts to you being there",
      go: "Go",
      leave: "Leave",
      seeInSowel: "See it in Sowel",
    },
  }[lang];

  const defaults = () => ({
    // Open on a desk, closed on a phone: a window over a phone's interface covers
    // the interface.
    open: innerWidth >= 900,
    w: Math.min(440, Math.round(innerWidth * 0.34)),
    h: Math.min(300, Math.round(innerHeight * 0.36)),
    right: 20,
    bottom: 96,
  });
  let state = defaults();
  try {
    state = { ...state, ...JSON.parse(read(KEY) || "{}") };
  } catch {
    /* a broken preference is no preference */
  }
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      /* it holds for this page */
    }
  };

  const style = document.createElement("style");
  style.textContent = `
    #sm-window, #sm-pill { position: fixed; z-index: 2147483000; font: 600 13px Inter, system-ui, sans-serif; }
    #sm-window { display: flex; flex-direction: column; background: #eef5f8; border-radius: 12px;
      overflow: hidden; box-shadow: 0 12px 36px rgba(20,65,89,.32), 0 0 0 1px rgba(26,79,110,.18); }
    #sm-bar { display: flex; align-items: center; gap: 6px; height: 32px; padding: 0 6px 0 12px;
      background: #1a4f6e; color: #fff; cursor: grab; touch-action: none; user-select: none; }
    #sm-bar.dragging { cursor: grabbing; }
    #sm-bar span { flex: 1; font-size: 12px; letter-spacing: .02em; }
    #sm-bar button { all: unset; display: grid; place-items: center; width: 26px; height: 24px;
      border-radius: 6px; cursor: pointer; color: #fff; opacity: .85; }
    #sm-bar button:hover, #sm-bar button:focus-visible { background: rgba(255,255,255,.16); opacity: 1; }
    #sm-window iframe { flex: 1; width: 100%; border: 0; display: block; background: #eef5f8; }
    #sm-window.busy iframe { pointer-events: none; }
    #sm-grip { position: absolute; left: 0; top: 32px; width: 16px; height: 16px; cursor: nwse-resize;
      touch-action: none; background: linear-gradient(135deg, rgba(26,79,110,.55) 0 30%, transparent 30%); }
    #sm-pill { display: flex; align-items: center; gap: 8px; padding: 10px 16px; border: 0; border-radius: 999px;
      background: #1a4f6e; color: #fff; cursor: pointer; box-shadow: 0 6px 20px rgba(20,65,89,.35); }
    #sm-pill:hover { background: #144159; }
    /* Full screen: over the whole page, a margin and a dimmed backdrop so it still
       reads as a window over Sowel rather than a different site. */
    #sm-window.full { top: 12px !important; right: 12px !important; bottom: 12px !important;
      left: 12px !important; width: auto !important; height: auto !important;
      box-shadow: 0 0 0 100vmax rgba(10,30,45,.38), 0 18px 48px rgba(20,65,89,.4); }
    #sm-window.full #sm-bar { cursor: default; }
    #sm-window.full #sm-grip { display: none; }
    #sm-bar #sm-try { width: auto; height: auto; padding: 3px 9px; border-radius: 6px; font-size: 11px; font-weight: 700;
      background: #f2c035; color: #1a2f3c; opacity: 1; }
    #sm-bar #sm-try:hover, #sm-bar #sm-try:focus-visible { background: #d4a41c; }
    /* Beside the vignette, never over it: the point is to watch the house. */
    #sm-panel { position: fixed; z-index: 2147483001; width: 270px; display: none; max-height: 70vh; overflow: auto;
      background: rgba(255,255,255,.97); color: #1f2d36; border-radius: 12px; padding: 10px 12px;
      box-shadow: 0 10px 30px rgba(20,65,89,.3), 0 0 0 1px rgba(26,79,110,.15); font: 500 12px/1.4 Inter, system-ui, sans-serif; }
    #sm-panel.open { display: block; }
    #sm-panel h3 { margin: 0 0 6px; font-size: 12px; font-weight: 700; color: #1a4f6e; }
    #sm-panel .journey { padding: 6px 0; border-top: 1px solid #e3ebf0; }
    #sm-panel .journey:first-of-type { border-top: 0; }
    #sm-panel .what { font-weight: 600; }
    #sm-panel .why { color: #52616b; margin-top: 2px; }
    #sm-panel .watch { display: none; margin-top: 6px; padding: 6px 8px; border-radius: 8px; background: #eef5f8; color: #1f3d4e; }
    #sm-panel .journey.walking .watch { display: block; }
    #sm-panel .actions { display: flex; gap: 6px; margin-top: 6px; align-items: center; }
    #sm-panel button { all: unset; cursor: pointer; padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 11px;
      background: #1a4f6e; color: #fff; }
    #sm-panel button.secondary { background: #dbe7ee; color: #1a4f6e; }
    #sm-panel a { color: #1a4f6e; font-weight: 600; }
  `;
  document.head.appendChild(style);

  const cube =
    '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2 3 7v10l9 5 9-5V7z"/><path d="M3 7l9 5 9-5M12 12v10"/></svg>';
  const icon = {
    full: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>',
    back: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>',
    reduce:
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  };

  // The guided journeys (spec 004): the visitor walks into a room, a recipe sees
  // them. Data, so an increment is an entry: the room it walks to and the zone whose
  // page in Sowel shows what happened. The 3D shows whichever storey the figure is
  // on as it walks (house-3d spec 005, FR4).
  const JOURNEYS = [
    {
      room: "salle-de-bain",
      zone: "Salle de Bain",
      fr: {
        what: "Entrer dans la salle de bain",
        why: "Une recette allume la lumière dès qu'elle détecte quelqu'un, de jour comme de nuit.",
        watch:
          "Ton personnage entre, monte l'escalier : chaque lumière s'allume quand il entre dans la pièce. Ce sont les recettes de Sowel qui réagissent à sa présence, pas un clic sur une lampe.",
      },
      en: {
        what: "Walk into the bathroom",
        why: "A recipe switches the light on as soon as it detects someone, day or night.",
        watch:
          "Your figure walks in and up the stairs: each light comes on as it enters the room. That is Sowel's recipes reacting to its presence, not a click on a lamp.",
      },
    },
  ];

  const win = document.createElement("div");
  win.id = "sm-window";
  win.innerHTML = `
    <div id="sm-bar">
      <span>${T.title}</span>
      <button type="button" id="sm-try" title="${T.tryTitle}">${T.try}</button>
      <button type="button" data-act="full" title="${T.full}" aria-label="${T.full}">${icon.full}</button>
      <button type="button" data-act="reduce" title="${T.reduce}" aria-label="${T.reduce}">${icon.reduce}</button>
    </div>
    <div id="sm-grip" title="↖"></div>`;
  const holder = document.createElement("div");
  holder.innerHTML = `
    <div id="sm-panel" role="dialog" aria-label="${T.tryTitle}">
      <h3>${T.tryTitle}</h3>
      ${JOURNEYS.map(
        (j, i) => `<div class="journey" data-i="${i}">
          <div class="what">${j[lang].what}</div>
          <div class="why">${j[lang].why}</div>
          <div class="actions">
            <button type="button" data-go="${i}">${T.go}</button>
            <button type="button" class="secondary" data-leave="${i}">${T.leave}</button>
            <a data-zone="${i}" href="/home" target="_top">${T.seeInSowel}</a>
          </div>
          <div class="watch">${j[lang].watch}</div>
        </div>`,
      ).join("")}
    </div>`;
  const panel = holder.firstElementChild;
  const pill = document.createElement("button");
  pill.id = "sm-pill";
  pill.type = "button";
  pill.title = T.open;
  pill.innerHTML = `${cube}3D`;

  const clamp = () => {
    state.w = Math.max(MIN_W, Math.min(state.w, innerWidth - 16));
    state.h = Math.max(MIN_H, Math.min(state.h, innerHeight - 16));
    state.right = Math.max(0, Math.min(state.right, innerWidth - state.w));
    state.bottom = Math.max(0, Math.min(state.bottom, innerHeight - state.h));
  };
  const place = () => {
    clamp();
    Object.assign(win.style, {
      width: `${state.w}px`,
      height: `${state.h}px`,
      right: `${state.right}px`,
      bottom: `${state.bottom}px`,
    });
    Object.assign(pill.style, { right: `${state.right}px`, bottom: `${state.bottom}px` });
    placePanel();
  };
  // Beside the vignette, on its left, bottom-aligned; in full screen, in its
  // top-left corner, over the house's sky rather than its rooms.
  function placePanel() {
    if (!panel) return;
    if (full) {
      Object.assign(panel.style, { left: "24px", top: "56px", right: "", bottom: "" });
    } else {
      const right = state.right + state.w + 10;
      const fits = innerWidth - right >= 280;
      Object.assign(
        panel.style,
        fits
          ? { right: `${right}px`, bottom: `${state.bottom}px`, left: "", top: "" }
          : {
              right: `${state.right}px`,
              bottom: `${state.bottom + state.h + 10}px`,
              left: "",
              top: "",
            },
      );
    }
  }

  let frame = null;
  let full = false;

  // The 3D app reads its anchor (house-3d spec 003, amended): `full` for the full
  // HUD, `level` for a storey, `walk` to walk the visitor's figure to a room. Setting
  // the anchor of a same-origin frame reloads nothing. A walk carries a timestamp so
  // asking twice for the same room is still a change the app hears.
  const tell = (extra = "") => {
    const parts = [full ? "full" : "", extra].filter(Boolean);
    try {
      if (frame?.contentWindow) frame.contentWindow.location.hash = parts.join("&");
    } catch {
      /* not loaded yet: it starts small, which is what `full = false` means */
    }
  };
  const setFull = (next) => {
    full = next;
    win.classList.toggle("full", full);
    const button = win.querySelector('[data-act="full"]');
    button.innerHTML = full ? icon.back : icon.full;
    button.title = full ? T.back : T.full;
    button.setAttribute("aria-label", button.title);
    tell();
    placePanel();
  };

  const render = () => {
    const signedIn = Boolean(read("sowel_access_token"));
    const mounted = win.isConnected || pill.isConnected;
    // Nothing on the login screen: the 3D would only say there is no session.
    if (!signedIn) {
      panel.remove();
      win.remove();
      pill.remove();
      frame = null;
      return;
    }
    if (state.open) {
      pill.remove();
      if (!frame) {
        frame = document.createElement("iframe");
        frame.src = "/maison/?mini=1";
        frame.title = T.title;
        win.insertBefore(frame, win.querySelector("#sm-grip"));
      }
      if (!win.isConnected) {
        document.body.appendChild(win);
        document.body.appendChild(panel);
        void zoneLinks();
      }
    } else {
      if (full) setFull(false);
      frame?.remove();
      frame = null;
      win.remove();
      panel.remove();
      if (!pill.isConnected) document.body.appendChild(pill);
    }
    if (!mounted) place();
  };

  win.querySelector('[data-act="reduce"]').addEventListener("click", () => {
    state.open = false;
    save();
    render();
  });
  win.querySelector('[data-act="full"]').addEventListener("click", () => setFull(!full));

  win.querySelector("#sm-try").addEventListener("click", () => {
    panel.classList.toggle("open");
    placePanel();
  });
  // Each journey's link goes to its room's page in Sowel, found by the zone's name.
  const zoneLinks = async () => {
    try {
      const token = read("sowel_access_token");
      const res = await fetch("/api/v1/zones", { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) return;
      const flat = (zones) => zones.flatMap((z) => [z, ...flat(z.children || [])]);
      const zones = flat(await res.json());
      JOURNEYS.forEach((j, i) => {
        const zone = zones.find((z) => z.name === j.zone);
        const link = panel.querySelector(`[data-zone="${i}"]`);
        if (zone && link) link.href = `/home/${zone.id}`;
      });
    } catch {
      /* the link stays on the home page */
    }
  };
  panel.addEventListener("click", (event) => {
    const go = event.target.closest("[data-go]");
    const leave = event.target.closest("[data-leave]");
    if (!go && !leave) return;
    const i = Number((go || leave).dataset.go ?? (go || leave).dataset.leave);
    const journey = JOURNEYS[i];
    const line = panel.querySelector(`.journey[data-i="${i}"]`);
    if (go) {
      line.classList.add("walking");
      tell(`walk=${journey.room}&t=${Date.now()}`);
    } else {
      line.classList.remove("walking");
      tell(`walk=away&t=${Date.now()}`);
    }
  });
  addEventListener("keydown", (event) => {
    if (event.key === "Escape" && full) setFull(false);
  });
  pill.addEventListener("click", () => {
    state.open = true;
    save();
    render();
  });

  // Drag by the bar, resize by the top-left corner. The window is anchored bottom
  // right, so growing it up and left is what keeps its anchor still.
  const track = (handle, onMove) => {
    handle.addEventListener("pointerdown", (event) => {
      if (full || event.target.closest("button")) return;
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
  track(win.querySelector("#sm-bar"), (s, dx, dy) => {
    state.right = s.right - dx;
    state.bottom = s.bottom - dy;
  });
  track(win.querySelector("#sm-grip"), (s, dx, dy) => {
    state.w = s.w - dx;
    state.h = s.h - dy;
  });
  addEventListener("resize", place);

  render();
  place();
  // The interface logs in and out without reloading the page; follow it.
  setInterval(render, 2000);
})();
