# Museum After Hours

[![make.fun](https://make.fun/badge/best-heist-game-20261122-0559.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![rank](https://make.fun/badge/best-heist-game-20261122-0559/Thai-ji/museum-after-hours/rank.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)
[![reward](https://make.fun/badge/best-heist-game-20261122-0559/Thai-ji/museum-after-hours/reward.svg)](https://make.fun/bounty/best-heist-game-20261122-0559)

A one-screen stealth heist: one night, one museum, three guards on patrol, three
sweeping cameras, four exhibits worth $1,470 — and a getaway clock that only
starts when you touch the first one.

## Play

Open `game/index.html` in a browser, or:

```
node serve.ts        # then open http://localhost:8080
```

- **WASD / arrows** — move (ducts are slow but block every line of sight)
- **SHIFT** — sprint: fast, but guards within earshot snap their head toward you
- **1–4** — buy gear from a $120 budget: Lockpick $40 (vault cracks 3x faster),
  EMP Burst $60 (all cameras down 8s), Smoke Bomb $50 (breaks every line of
  sight for 5s), Glass Cutter $70 (sprint through ducts silently)
- Stand on the vault pad to crack it. Grab anything and the **getaway clock**
  starts — reach the EXIT before it hits zero.

Red cones are guards, amber cones are cameras, gold is loot, green is the way
out. The alarm bar fills while anything sees you (faster once you are detected);
when it tops out you are caught and dumped back at the entrance with 20 seconds
off the clock.

## Layout

| file | role |
|---|---|
| `game/src/constants.js` | every tunable: speeds, cone angles, alarm rates, gear, palette |
| `game/src/map.js` | the 32×18 floor plan as an ASCII grid, plus every spawn |
| `game/src/stealth.js` | pure rules, no DOM: collision, sight lines, cones, alarm, tools, clock |
| `game/src/controls.js` | keyboard to intent |
| `game/src/painter.js` | pure canvas drawing: floor, cones, actors, HUD, overlays |
| `game/src/run.js` | the fixed-step loop and the `?shot=` screenshot staging mode |
| `main.ts` | hands the game in: copies `game/` + `screenshots/` to `/output`, writes `dossier.json` |

The rules layer is headless — `node tools/test.mjs` drives the same module
(43 assertions: map shape, reachability of every loot and patrol beat, cone
geometry, pickup, vault cracking, getting caught, respawn penalty, the escape).
