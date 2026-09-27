# Architecture — spec 004

```
Sowel page ── mini-house.js (injected, spec 002)
               ├── "Essayer" panel ── sets the frame's anchor: #level=1&walk=salle-de-bain
               └── the vignette (house-3d ?mini=1)
                     ├── the figure walks the plan's door graph, room by room
                     └── on entering each room:
                         POST /api/v1/equipments/<Simulation>/orders/sim.ghost  {"value": "<id>:<room>"}
                                  │ the 3D's own guest session; visitor id in localStorage
                                  ▼
               Sowel ─► simulator: ghost in the room ─► PIR occupancy
                     ─► motion-light recipe ─► lamp on ─► 3D and Sowel follow
```

The journeys are data in the script (`JOURNEYS`: label, room, level, what to watch,
where in Sowel), so an increment is a line, not a feature. Nothing new in the core;
the deny list already lets a guest order an equipment.

The frame's anchor grows from `#full` to `full`, `level=<n>` and `walk=<room>`, in
any combination (`#level=1&walk=salle-de-bain`). The house-3d app reads it on
`hashchange` as it reads `full` today (its spec 003, amended) and walks the figure
(its spec 005). The 3D sending the ghost orders, rather than the panel, is what keeps
the lights in step with the figure: the order goes out when the figure crosses the
door, not when the visitor clicked.
