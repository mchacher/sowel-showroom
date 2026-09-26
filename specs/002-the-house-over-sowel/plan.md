# Plan — spec 002

Built iteratively on the local showroom, then written down. Shipped in
`feat/serve-house-3d` (PR #10).

| Step | What                                                                      | Test                              | State |
| ---- | ------------------------------------------------------------------------- | --------------------------------- | ----- |
| 1    | `/maison/` from `HOUSE_3D_DIST`, same origin.                             | `verify-showroom.sh`              | ✅    |
| 2    | `$http_host`, `CORS_ORIGINS` from `PUBLIC_ORIGIN`, the UI's token keys.   | guest WebSocket through the proxy | ✅    |
| 3    | `absolute_redirect off`; logout clears the cookie.                        | curl: relative 302, `max-age=0`   | ✅    |
| 4    | The neutral service worker; reload only when healing.                     | Chrome with the old worker        | ✅    |
| 5    | Side by side with a divider — tried, then replaced.                       | seen, rejected by the owner       | ✅    |
| 6    | The vignette: drag, resize, pill, full screen by anchor, Escape.          | Chrome over DevTools              | ✅    |
| 7    | Framing back to Sowel `none`, the house `'self'`; verified in the script. | `verify-showroom.sh`              | ✅    |
| 8    | `no-cache` on the 3D app and the vignette's script.                       | headers                           | ✅    |
