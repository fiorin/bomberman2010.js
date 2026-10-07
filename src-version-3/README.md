# Bomberman 2010 Modern (`src-version-3`)

Evolution of `src-version-2`: smooth continuous movement, richer animation, 60 Hz simulation, and AI opponents that bomb, kill, flee blast zones, cut off moving enemies, and prioritize contested items — across three difficulty levels.

## Steps Completed

1. **Project scaffold**
   - Created Vite + TypeScript + Vitest setup.
   - Copied visual assets into `public/resource`.

2. **Smooth movement core**
   - Replaced tile-to-tile hopping with continuous pixel movement (base `100 px/s`, `+30` per speed item, max `220`).
   - Added lane-center perpendicular alignment (corner assist) and AABB collision.
   - Bomb tiles are passable only while the player still overlaps them: you can walk off your bomb but never back on.

3. **60 Hz simulation with interpolated rendering**
   - Fixed gameplay tick (`1000/60` ms) with accumulator and frame clamp (`250 ms`).
   - `requestAnimationFrame` render loop interpolates between ticks (`prevPx/prevPy` + alpha) for fluid motion at any display refresh rate.

4. **Animation upgrade**
   - Walk cycle from the sprite sheet with speed-scaled frame period.
   - Death sequence, victory dance, and draw poses animated from `poseTime`.

5. **AI opponents**
   - Per-player `AiController` emits the same `InputState` humans use; only one human-vs-AI switch differs.
   - Time-aware BFS danger map: bomb blasts are evaluated with chain-fuse propagation, and paths may cross a blast tile only if the player would pass before it ignites.
   - Flee mode escapes to a permanently safe tile (relaxed fallback maximizes survival time).
   - Offense priorities: clear-line kill shot → adjacent breakable → item → line-of-sight positioning → breakable approach → wander.
   - Human reaction delay (`0.08–0.20 s`), think interval (`0.2–0.35 s`), stuck detection, and flee replan cooldown.

6. **Difficulty levels**
   - Menu offers Fácil / Normal / Difícil; each level tunes reaction delay, think interval, escape strictness (extra safety margin when crossing a timed blast), and prediction horizon.
   - Easy bots hesitate longer and refuse to bomb unless a roomy escape exists; hard bots react almost instantly, bomb with tight escapes, and predict enemy movement.

7. **Predictive cutting and item stealing**
   - Hard/normal bots project an enemy's tile a moment ahead along its velocity (stopping at blocks/bombs/walls) and bomb that heading instead of the current tile.
   - Items are ranked by BFS distance but a contested item (an enemy closer than our path) outranks a nearer free one.

8. **Four players, 1–4 humans**
   - Menu selects 1–4 human players; remaining slots are AI. Same default key map as v2 (P1 `WASD+E`, P2 `IJKL+O`, P3 `4658+9`, P4 `TFHG+Y`).

## Verification

- Unit tests: `npm test`
- Type checks: `npm run typecheck`
- Build checks: `npm run build`

## Run

```bash
npm install
npm run dev
```
