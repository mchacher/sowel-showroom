# Plan — spec 003

Depends on simulator spec 004 (the generator) being released.

| Step | What                                                                         | Test                                        | State |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------- | ----- |
| 1    | Project map: the decision table amended (FR1).                               | review                                      | ✅    |
| 2    | `journal-tables.txt`, dump and load scripts; the reset keeps the journals.   | reset twice; a decision survives            | ✅    |
| 3    | The reset finds the earliest energy point and computes the missing days.     | `check-shell`; empty and full InfluxDB      | ✅    |
| 4    | The reset runs the simulator's generator and adds its files to the fixture.  | reset on an empty InfluxDB: month view full | ✅    |
| 5    | `verify-showroom.sh`: thirty days of energy, a week of temperature, arbiter. | the script, green                           | ✅    |
| 6    | `operations.md`: the burn-in week before the public link (FR4).              | review                                      | ✅    |

## Walked, on the local showroom

InfluxDB cleared of the points from before the simulator's timestamp fix, one reset:
thirty days generated in six seconds and restored by the core, the journals kept
(32 arbiter decisions, 303 activity entries…), and `verify-showroom.sh` green —
energy on 29 of 29 whole days, 168 hours of temperature. The Energy page's month
view is full. Two things the walk found and fixed: nginx refused the 4.9 MB restore
(a route of its own now allows 64 MB for the core's restore only), and a reset that
failed after the wipe would have lost the kept journals on the next run (they are
merged now, and dropped only once a reset succeeds).

The burn-in week (FR4) is an operation, not code: `operations.md`.
