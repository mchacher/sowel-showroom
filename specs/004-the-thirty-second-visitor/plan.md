# Plan — spec 004

| Step | Repository             | What                                                                                      | Test                                                     | State |
| ---- | ---------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------- | ----- |
| 1    | sowel-plugin-simulator | Fixture: a PIR in the bathroom, a motion-light instance on it (spec 003 amended); release | fixture test; validate                                   | ✅    |
| 2    | sowel-house-3d         | `#level=N` in the frame's anchor (spec 003 amended)                                       | the anchor parser, tested                                | ✅    |
| 3    | sowel-showroom         | The "Essayer" panel, the visitor's ghost, journey P1                                      | `verify-showroom`: the guest's ghost lights the bathroom | ✅    |
| 4    | sowel-showroom         | Walked in a browser: day and night, two visitors                                          | seen                                                     | ✅    |

## Walked, on the local showroom

As the guest on the dashboard: the "Essayer" panel beside the vignette, "Y aller",
the figure walking in from the street; the hall, stairwell and bathroom lamps come on
as it enters each, and the bathroom's about two minutes after "Sortir" — then, with
simulator v0.4.1 (5 s timeouts and PIR hold, the ghost leaving on `away`), ten seconds
after, measured. The panel
first opened over the vignette and hid the figure it exists to show: it sits beside
the vignette now, and in its top-left corner in full screen.
