// The queue of what visitors do (spec 005, FR2–FR4).
//
// Pure: no network, no clock of its own. The server (server.mjs) gives it the time,
// a way to forward an order to Sowel, and Sowel's activity; this decides what runs
// when, and keeps the journal. Tested in queue.test.mjs.

/** How long an action holds the house, milliseconds (FR3). */
export const HOLD_JOURNEY_MS = 20_000;
export const HOLD_ORDER_MS = 3_000;
/** A visitor whose stream has been gone this long loses their pending action. */
export const PRESENCE_MS = 30_000;
/** Lines of journal kept, and sent to a visitor who arrives. */
export const JOURNAL_MAX = 100;

/**
 * The journeys a visitor may queue (spec 004): the window knows how to run each;
 * the queue only grants the slot. An id outside this list is refused.
 */
export const JOURNEYS = ["salle-de-bain", "chambre-enfant-2", "sejour", "bureau"];

export function createQueue({ forward }) {
  const visitors = new Map(); // id → { name, lastSeen, streams }
  const waiting = []; // { seq, visitor, kind, what, request? }
  let running = null; // { ...item, startedAt, until }
  const journal = []; // { at, kind: "action" | "activity", visitor?, who?, what }
  let seq = 0;
  let names = 0;

  const visitor = (id, now) => {
    let v = visitors.get(id);
    if (!v) {
      names += 1;
      v = { name: `Visiteur ${names}`, lastSeen: now, streams: 0 };
      visitors.set(id, v);
    }
    v.lastSeen = now;
    return v;
  };

  const note = (entry) => {
    journal.unshift(entry);
    if (journal.length > JOURNAL_MAX) journal.length = JOURNAL_MAX;
  };

  const pendingOf = (id) =>
    (running && running.visitor === id) || waiting.some((item) => item.visitor === id);

  return {
    /** A visitor's stream opened or closed: that is their presence. */
    connect(id, now) {
      visitor(id, now).streams += 1;
    },
    disconnect(id, now) {
      const v = visitor(id, now);
      v.streams = Math.max(0, v.streams - 1);
    },
    seen(id, now) {
      visitor(id, now);
    },

    /**
     * Queue an action. One pending per visitor (FR2): a second is refused. Returns
     * the position in the queue, 1 being the next to run after the running one.
     */
    enqueue(id, kind, what, now, request = null) {
      if (kind === "journey" && !JOURNEYS.includes(what.journey)) {
        return { ok: false, reason: "unknown" };
      }
      visitor(id, now);
      if (pendingOf(id)) return { ok: false, reason: "pending" };
      seq += 1;
      waiting.push({ seq, visitor: id, kind, what, request });
      return { ok: true, position: waiting.length };
    },

    /** Whether this visitor holds the running journey: their orders go straight through. */
    holds(id) {
      return Boolean(running && running.kind === "journey" && running.visitor === id);
    },

    /** Sowel's own activity, for the journal (FR4). */
    activity(item) {
      note({ at: item.timestamp, kind: "activity", what: item });
    },

    /**
     * Move time on: drop the absent, finish the running action when its hold is over,
     * start the next. Returns true when something changed.
     */
    async tick(now) {
      let changed = false;
      for (let i = waiting.length - 1; i >= 0; i--) {
        const v = visitors.get(waiting[i].visitor);
        if (v && v.streams === 0 && now - v.lastSeen > PRESENCE_MS) {
          waiting.splice(i, 1);
          changed = true;
        }
      }
      if (running && now >= running.until) {
        running = null;
        changed = true;
      }
      if (!running && waiting.length > 0) {
        const item = waiting.shift();
        const hold = item.kind === "journey" ? HOLD_JOURNEY_MS : HOLD_ORDER_MS;
        running = { ...item, startedAt: now, until: now + hold };
        let failed = false;
        if (item.request) {
          try {
            failed = !(await forward(item.request));
          } catch {
            failed = true;
          }
        }
        note({
          at: now,
          kind: "action",
          visitor: item.visitor,
          who: visitors.get(item.visitor)?.name ?? "Un visiteur",
          what: { kind: item.kind, ...item.what, failed },
        });
        changed = true;
      }
      return changed;
    },

    /** What one visitor's stream is sent: everything, their own marked, no one's id. */
    view(id, now) {
      const connected = [...visitors.values()].filter(
        (v) => v.streams > 0 || now - v.lastSeen < PRESENCE_MS,
      ).length;
      const line = (item) => ({
        who: visitors.get(item.visitor)?.name ?? "Un visiteur",
        mine: item.visitor === id,
        kind: item.kind,
        what: item.what,
      });
      return {
        now,
        visitors: connected,
        me: visitors.get(id)?.name ?? null,
        running: running ? { ...line(running), startedAt: running.startedAt, until: running.until } : null,
        waiting: waiting.map(line),
        journal: journal.map((entry) => ({
          at: entry.at,
          kind: entry.kind,
          who: entry.who,
          mine: entry.visitor === id,
          what: entry.what,
        })),
      };
    },
  };
}
