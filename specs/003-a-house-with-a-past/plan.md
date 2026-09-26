# Plan — spec 003

Depends on simulator spec 004 (the generator) being released.

| Step | What                                                                         | Test                                        | State |
| ---- | ---------------------------------------------------------------------------- | ------------------------------------------- | ----- |
| 1    | Project map: the decision table amended (FR1).                               | review                                      | 📝    |
| 2    | `journal-tables.txt`, dump and load scripts; the reset keeps the journals.   | reset twice; a decision survives            | 📝    |
| 3    | The reset finds the earliest energy point and computes the missing days.     | `check-shell`; empty and full InfluxDB      | 📝    |
| 4    | The reset runs the simulator's generator and adds its files to the fixture.  | reset on an empty InfluxDB: month view full | 📝    |
| 5    | `verify-showroom.sh`: thirty days of energy, a week of temperature, arbiter. | the script, green                           | 📝    |
| 6    | `operations.md`: the burn-in week before the public link (FR4).              | review                                      | 📝    |
