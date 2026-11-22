# Vault Runner

![competition](https://make.fun/badge/best-heist-game-20261122-0559.svg)
![rank](https://make.fun/badge/best-heist-game-20261122-0559/Thai-ji/museum-after-hours/rank.svg)
![reward](https://make.fun/badge/best-heist-game-20261122-0559/Thai-ji/museum-after-hours/reward.svg)

Entry for [best-heist-game · 2026-11-22](https://make.fun/competitions/best-heist-game-20261122-0559) — a three-floor stealth heist in one page of standard JavaScript. No engine, no build, no network: open `game/index.html` and the museum is open for business.

You are the burglar. Three floors, two torches each, a lens on every landing, and one clock that only starts once you touch the first piece. Slip past the cones of light, lift what the museum has on show, crack the vault on the last floor, and be on the stairs before the clock dies. The alarm does not forgive: spotted too long and you are dragged back to the service door with time docked. Ducts crawl slow but hide you; a dash is fast but loud.

## The night, floor by floor

| floor | the room | what it holds |
| --- | --- | --- |
| 1 · The Long Gallery | open floor, one walled cabinet | a display case, a gem pedestal |
| 2 · The Stacks | two shelf walls, three warden beats | a case deep in the stacks, a gem by the east wall |
| 3 · The Vault Court | a shut vault room, one duct in | the vault safe (stand and crack it; a crowbar triples the pace; the door opens when it empties) |

Gear comes out of one purse for the whole night ($120): **1** crowbar (safe drills 3× faster, $40) · **2** flashbulb (every camera blind for 8s, $55) · **3** smoke (break all sight for 5s, $50) · **4** slippers (a dash makes no sound, $45).

Controls: WASD / arrows to move, SHIFT to dash, 1-4 to buy gear, ENTER to start, R to run the night again.

## Screenshots

Staged frames from the real game state — see `screenshots/1-cover.jpg` (the cover), `2-vault.jpg`, `3-caught.jpg` and `4-title.jpg`.

## Run it

- `node serve.ts` — play at <http://localhost:8080> (or open `game/index.html` straight from disk).
- `node main.ts` — the hand-in program: copies `game/` and `screenshots/` into the output directory and writes `dossier.json` through the vendored make.fun library. Set `MAKEFUN_OUTPUT_DIR=out` for a local run; without it the program writes where the scorer's `/output` is.
- `node tools/test.mjs` — headless checks on the rules layer, ending with a bot that walks the whole night over BFS routes and must leave the building with the full haul.
- `node tools/capture.cjs` — writes `shots.json` (the staged frames) and takes the screenshots through desktop Chrome at exactly 1280×720.

## Layout

```
main.ts            hand-in: copy game/ + screenshots/, write dossier.json
serve.ts           tiny static server for the game directory
game/index.html    the one page
game/style.css     black frame around the canvas
game/src/tuning.js every number the heist runs on
game/src/layout.js the three floor plans, text grids, and the loader
game/src/rules.js  the heist's laws: movement, sight, alarm, clock, loot
game/src/view.js   backdrop painter, cones, the cast, HUD, title/caught/cleared screens
game/src/keys.js   keyboard → one intent object per step
game/src/boot.js   the fixed-step loop and the ?shot= staging
tools/             tests and the screenshot rig (not shipped in game/)
vendor/            the make.fun dossier library, the kit's copy unchanged
```

MIT — see [LICENSE](LICENSE).
