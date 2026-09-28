# Plan — spec 005

Starts once the owner validates the spec, and after showroom #14 and #15 are merged
(the read-only guest, the journeys of increment 2 — waiting on simulator v0.5.0).

| Step | Repository     | What                                                                             | Test                                               | State |
| ---- | -------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | ----- |
| 1    | sowel-showroom | The queue service: queue, one pending each, slots, forward, record, SSE          | unit tests; two clients against a running showroom | ✅    |
| 2    | sowel-showroom | The proxy: visitors' orders to the queue, `/queue/` to the service               | `verify-showroom`: an order is queued              | ✅    |
| 3    | sowel-house-3d | `who` and `me` on the anchor: someone else's figure (its spec 005 amended)       | the anchor parser; the scene                       | ✅    |
| 4    | sowel-showroom | The window: journal, strip, queue, actions, "Suivre", the pointer and the bubble | walked in two browsers, desk and phone             | ✅    |
| 5    | sowel-showroom | The landing page's button opens Sowel with the window                            | walked                                             | ✅    |
| 6    | sowel-showroom | Walked end to end: three browsers, day and night                                 | seen, written below                                | ⬜    |

## Walked, on the local showroom (2026-09-27, evening)

Two and three browsers at once, as the guest, desk and phone:

- **The queue.** A's journey to the bathroom ran; B's lamp, clicked through Sowel's
  API as a card would, answered `200 {"queued": 1}`, waited, and ran after it. A
  second action from A while one waited: `409`, and the toast said why.
- **The journal**, identical in both browsers: "Visiteur 1 : Entrer dans la salle de
  bain", "Présence : mouvement", "Motion Light allume Lumière", then B's "Toi : allumer
  Spots", and five seconds later "Motion Light (Dimmable) éteint Spots" — nobody in
  the kitchen, so its recipe put the light back out. The chain a visitor is meant to
  see, found without being staged.
- **Suivre.** Both Sowel pages opened the bathroom; the lamp's row outlined, the bubble
  beside the window ("Motion Light t'a vu entrer, et a agi." for A, "… a vu Visiteur 1
  entrer" for B).
- **Found and fixed on the way:** the journal showed the ghost's own order, and with
  it the visitor's id — simulation orders are dropped from the feed; "Lumière allumé"
  — the lines are verbs now ("allume", "éteint"); "a vu Toi entrer" — the visitor's own
  lines are in the second person; the pointer ringed the whole equipment list, and the
  first target, the recipe row, sat under the window — it points at the equipment's
  row now; full screen, the journal lay over the 3D's room list — it moves right; on a
  phone, over the storey switch — it moves up.
- `verify-showroom.sh` checks that a visitor's order goes through the queue and that
  the stream answers. The reset passes every check.
- Not yet seen well: the other visitor's grey figure is small at the window's zoom;
  its logic is tested in house-3d, the eye check wants a closer look on the host.
