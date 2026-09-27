# Architecture — spec 004

```
Sowel page ── mini-house.js (injected, spec 002)
               ├── the vignette (house-3d ?mini=1)
               │     └── #level=1 on a journey that needs the upper storey
               └── "Essayer" panel
                     ├── visitor id: localStorage `showroom_visitor`
                     ├── GET  /api/v1/equipments            → the "Simulation" equipment
                     └── POST /api/v1/equipments/:id/orders/sim.ghost  {"value": "<id>:<room>"}
                                  │ guest token from localStorage (same origin)
                                  ▼
               Sowel ─► simulator: ghost in the room ─► PIR occupancy
                     ─► motion-light recipe ─► lamp on ─► 3D and Sowel follow
```

The journeys are data in the script (`JOURNEYS`: label, room, level, what to watch,
where in Sowel), so an increment is a line, not a feature. Nothing new in the core;
the deny list already lets a guest order an equipment.

The frame's anchor grows from `#full` to `#full`, `#level=1`, or both
(`#full&level=1`). The house-3d app reads it on `hashchange` as it reads `full`
today (its spec 003, amended).
