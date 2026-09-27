# Plan — spec 005

Starts once the owner validates the spec, and after showroom #14 and #15 are merged
(the read-only guest, the journeys of increment 2 — waiting on simulator v0.5.0).

| Step | Repository     | What                                                                             | Test                                               | State |
| ---- | -------------- | -------------------------------------------------------------------------------- | -------------------------------------------------- | ----- |
| 1    | sowel-showroom | The queue service: queue, one pending each, slots, forward, record, SSE          | unit tests; two clients against a running showroom | ⬜    |
| 2    | sowel-showroom | The proxy: visitors' orders to the queue, `/queue/` to the service               | `verify-showroom`: an order is queued              | ⬜    |
| 3    | sowel-house-3d | `who` and `me` on the anchor: someone else's figure (its spec 005 amended)       | the anchor parser; the scene                       | ⬜    |
| 4    | sowel-showroom | The window: journal, strip, queue, actions, "Suivre", the pointer and the bubble | walked in two browsers, desk and phone             | ⬜    |
| 5    | sowel-showroom | The landing page's button opens Sowel with the window                            | walked                                             | ⬜    |
| 6    | sowel-showroom | Walked end to end: three browsers, day and night                                 | seen, written below                                | ⬜    |
