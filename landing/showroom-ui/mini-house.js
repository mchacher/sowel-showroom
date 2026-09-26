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
    },
    en: {
      title: "3D house",
      full: "Full screen",
      back: "Back to the vignette (Esc)",
      reduce: "Minimise",
      open: "Show the house in 3D",
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

  const win = document.createElement("div");
  win.id = "sm-window";
  win.innerHTML = `
    <div id="sm-bar">
      <span>${T.title}</span>
      <button type="button" data-act="full" title="${T.full}" aria-label="${T.full}">${icon.full}</button>
      <button type="button" data-act="reduce" title="${T.reduce}" aria-label="${T.reduce}">${icon.reduce}</button>
    </div>
    <div id="sm-grip" title="↖"></div>`;
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
  };

  let frame = null;
  let full = false;

  // The 3D app reads its `#full` anchor: small without it, the full HUD with it.
  // Setting the anchor of a same-origin frame reloads nothing.
  const tell = () => {
    try {
      if (frame?.contentWindow) frame.contentWindow.location.hash = full ? "full" : "";
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
  };

  const render = () => {
    const signedIn = Boolean(read("sowel_access_token"));
    const mounted = win.isConnected || pill.isConnected;
    // Nothing on the login screen: the 3D would only say there is no session.
    if (!signedIn) {
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

  win.querySelector('[data-act="reduce"]').addEventListener("click", () => {
    state.open = false;
    save();
    render();
  });
  win.querySelector('[data-act="full"]').addEventListener("click", () => setFull(!full));
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
