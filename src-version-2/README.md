# Bomberman 2010 Modern (`src-new`)

Modern TypeScript rewrite preserving original visuals, core mechanics, and playability.

## Steps Completed

1. **Project scaffold**
   - Created Vite + TypeScript + Vitest setup.
   - Copied original visual assets into `public/resource`.

2. **Deterministic gameplay core**
   - Implemented board/map generation, reserved spawn cells, fixed/breakable blocks.
   - Implemented players, movement cooldown/speed, bombs, chain explosion logic.
   - Implemented item spawn and item effects with the original distribution rates.
   - Implemented match timer and winner/empate rules.

3. **Renderer + input**
   - Added sprite-sheet renderer on canvas.
   - Added legacy-equivalent key controls and player count/start controls.

4. **UI replication**
   - Recreated original TV frame layout, HUD, start button, and controls panel styling.

5. **Performance finalization**
   - Preserved fixed gameplay tick (`100ms`) for parity.
   - Decoupled render loop with `requestAnimationFrame` for smoother rendering.

## Verification Per Step

- Unit tests: `npm run test`
- Type checks: `npm run typecheck`
- Build checks: `npm run build`

## Run

```bash
npm install
npm run dev
```
