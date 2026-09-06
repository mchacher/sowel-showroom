# Sowel showroom

Infrastructure for the public Sowel demo: a living, fictional house anyone can visit and act on.

This repository holds **only infrastructure**: the compose stack, the reverse proxy with guest login and quotas, the nightly reset, the demo fixture, and the project map. The two other pieces live in their own repositories:

| Repository | Nature | Role |
| --- | --- | --- |
| [`sowel-plugin-simulator`](https://github.com/mchacher/sowel-plugin-simulator) | Sowel plugin | Simulates the physical world (occupants, sun, weather, thermal, energy) and publishes it as ordinary devices. |
| [`sowel-house-3d`](https://github.com/mchacher/sowel-house-3d) | Application | A stylised 3D view of a home, driven live by any Sowel instance. The showroom is one of its deployments. |
| `sowel-showroom` | Infrastructure | This repo. |

The core, [`mchacher/sowel`](https://github.com/mchacher/sowel), stays stock: the showroom runs the published image.

Start with [docs/project-map.md](docs/project-map.md): decisions taken, the contract between the pieces, multi-visitor rules, and the phased plan.

## Status

Project map written. No phase implemented yet.

## License

AGPL-3.0, like Sowel.
