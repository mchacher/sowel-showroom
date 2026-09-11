/*
 * The showroom's service worker: one that does nothing, on purpose.
 *
 * The Sowel image ships a PWA whose worker is registered at scope "/" with
 * `navigateFallback: "/index.html"`. A worker at that scope intercepts *every*
 * navigation on the origin and answers it from the cached app shell — so asking
 * for /maison/ never reached nginx at all: the browser served the Sowel
 * interface, whose router does not know that path and redirected to /login. The
 * 3D house was unreachable for anybody who had opened Sowel once, and no amount
 * of reloading fixed it, because the network was never consulted.
 *
 * Serving this file at /sw.js replaces the shipped one. It registers no fetch
 * handler, so every navigation goes to the network, where nginx decides what
 * /maison/ means. It also clears the caches the old worker left behind.
 *
 * Losing offline mode is not a loss here. A demonstrator that answers from a
 * cache shows yesterday's build of a house that is supposed to be live, which is
 * the opposite of the point. Nothing about the product changes: this file exists
 * only in this deployment, and the image is untouched.
 */

self.addEventListener("install", () => {
  // Do not wait for the old worker's clients to close: it is actively breaking
  // the site, and every second it stays in charge is a visitor sent to /login.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
      await self.clients.claim();

      // The page that is open right now was very likely served from the cache by
      // the worker this one replaces. Reloading it once is what turns "clear your
      // site data" into something a visitor never has to hear.
      const windows = await self.clients.matchAll({ type: "window" });
      for (const client of windows) {
        // `navigate` rejects for a client this worker does not control, and a
        // rejection inside `waitUntil` would fail the activation and leave the old
        // worker in charge — the one outcome this file exists to prevent.
        try {
          await client.navigate(client.url);
        } catch {
          /* the visitor reloads when they reload; nothing here is worth failing for */
        }
      }
    })(),
  );
});
