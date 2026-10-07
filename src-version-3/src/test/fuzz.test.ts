import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/gameEngine';
import { SeededRng } from '../core/random';
import { BOARD_PX, BOARD_SIZE, PLAYER_HALF, TICK_SECONDS, type InputKey, type Player } from '../core/types';

function overlapsSolid(engine: GameEngine, player: Player): string | null {
  const loX = player.px - PLAYER_HALF;
  const hiX = player.px + PLAYER_HALF;
  const loY = player.py - PLAYER_HALF;
  const hiY = player.py + PLAYER_HALF;
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      const block = engine.state.board[x][y].block;
      if (!block) continue;
      const xLo = x * 30;
      const xHi = xLo + 30;
      const yLo = y * 30;
      const yHi = yLo + 30;
      if (loX < xHi && hiX > xLo && loY < yHi && hiY > yLo) {
        return `P${player.id + 1} inside block (${x},${y}) at px=${player.px.toFixed(2)} py=${player.py.toFixed(2)}`;
      }
    }
  }
  return null;
}

describe('movement invariants', () => {
  it('never teleports or enters solids under random input', () => {
    for (const seed of [1, 2, 3, 4, 5]) {
      const engine = new GameEngine(seed);
      engine.start(4);
      const rng = new SeededRng(seed * 7919 + 13);
      const keys: InputKey[] = ['up', 'down', 'left', 'right', 'bomb'];
      const held: Record<InputKey, boolean> = { up: false, down: false, left: false, right: false, bomb: false };
      let heldCount = 0;
      for (let tick = 0; tick < 20000; tick++) {
        if (rng.nextInt(40) === 0) {
          const key = keys[rng.nextInt(keys.length)];
          held[key] = !held[key];
          heldCount += held[key] ? 1 : -1;
          if (heldCount < 0) heldCount = 0;
          engine.setKey(0, key, held[key]);
        }
        const before = { px: engine.state.players[0].px, py: engine.state.players[0].py };
        engine.tick();
        const p = engine.state.players[0];
        if (!p.alive) continue;
        const step = p.speed * TICK_SECONDS + 0.02;
        const ddx = Math.abs(p.px - before.px);
        const ddy = Math.abs(p.py - before.py);
        expect(ddx, `seed ${seed} tick ${tick}: px ${before.px} -> ${p.px}`).toBeLessThanOrEqual(step);
        expect(ddy, `seed ${seed} tick ${tick}: py ${before.py} -> ${p.py}`).toBeLessThanOrEqual(step);
        expect(p.px).toBeGreaterThanOrEqual(PLAYER_HALF - 0.001);
        expect(p.px).toBeLessThanOrEqual(BOARD_PX - PLAYER_HALF + 0.001);
        expect(p.py).toBeGreaterThanOrEqual(PLAYER_HALF - 0.001);
        expect(p.py).toBeLessThanOrEqual(BOARD_PX - PLAYER_HALF + 0.001);
        const problem = overlapsSolid(engine, p);
        expect(problem, `seed ${seed} tick ${tick}`).toBeNull();
        expect(Math.floor(p.px / 30)).toBe(p.tileX);
        expect(Math.floor(p.py / 30)).toBe(p.tileY);
      }
    }
  });
});
