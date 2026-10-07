import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/gameEngine';
import { aiTuning, computeDanger, planEscape } from '../core/ai';
import { createSolidBlock, createItem } from '../core/setup';
import { STATUS } from '../core/types';
import {
  clearArea,
  findBombOwnedBy,
  addBreakable,
  neutralize,
  placeBombAt,
  teleport,
} from './helpers';

describe('difficulty tuning', () => {
  it('scales reaction, think, strictness and prediction by level', () => {
    const easy = aiTuning('easy');
    const normal = aiTuning('normal');
    const hard = aiTuning('hard');
    expect(easy.reactionMin).toBeGreaterThan(normal.reactionMin);
    expect(normal.reactionMin).toBeGreaterThan(hard.reactionMin);
    expect(easy.thinkMin).toBeGreaterThan(normal.thinkMin);
    expect(normal.thinkMin).toBeGreaterThan(hard.thinkMin);
    expect(easy.escapeSafety).toBeGreaterThan(normal.escapeSafety);
    expect(normal.escapeSafety).toBeGreaterThan(hard.escapeSafety);
    expect(easy.predictHorizon).toBe(0);
    expect(hard.predictHorizon).toBeGreaterThan(normal.predictHorizon);
  });

  it('demands a roomier escape on easy than on hard before bombing', () => {
    const engine = new GameEngine(21);
    engine.start(1);
    const state = engine.state;
    for (let x = 0; x < 11; x++) {
      for (let y = 0; y < 11; y++) {
        const tile = state.board[x][y];
        tile.block = null;
        tile.status &= ~(STATUS.BLOCK_SOLID | STATUS.BLOCK_BREAKABLE);
        tile.item = null;
        tile.status &= ~STATUS.ITEM;
        tile.bomb = null;
        tile.status &= ~STATUS.BOMB;
        tile.fire = null;
      }
    }
    for (let x = 0; x < 11; x++) {
      for (const y of [4, 6]) {
        state.board[x][y].block = createSolidBlock();
        state.board[x][y].status |= STATUS.BLOCK_SOLID;
      }
    }
    const danger = new Map<number, number>();
    const from = { x: 0, y: 5 };
    const easy = planEscape(state, danger, from, 4, 100, aiTuning('easy').escapeSafety);
    const normal = planEscape(state, danger, from, 4, 100, aiTuning('normal').escapeSafety);
    const hard = planEscape(state, danger, from, 4, 100, aiTuning('hard').escapeSafety);
    expect(hard).not.toBeNull();
    expect(normal).not.toBeNull();
    expect(easy).toBeNull();
  });
});

describe('danger map', () => {
  it('propagates chain reaction timing', () => {
    const engine = new GameEngine(3);
    engine.start(1);
    const state = engine.state;
    clearArea(state, 0, 0, 5, 0);
    placeBombAt(state, 2, 0, 0, 1, 1);
    placeBombAt(state, 3, 0, 0, 1, 2);
    const danger = computeDanger(state);
    expect(danger.get(2)).toBeCloseTo(1, 5);
    expect(danger.get(3)).toBeCloseTo(1, 5);
    expect(danger.get(4)).toBeCloseTo(1, 5);
  });
});

describe('AI behavior', () => {
  it('flees a planted bomb and survives the blast', () => {
    const engine = new GameEngine(11);
    engine.start(1);
    const state = engine.state;
    clearArea(state, 6, 6, 10, 10);
    teleport(state, 1, 10, 10);
    placeBombAt(state, 10, 10, 1, 1, 2);
    for (let i = 0; i < 60; i++) engine.tick();
    const player = state.players[1];
    expect(player.tileX !== 10 || player.tileY !== 10).toBe(true);
    for (let i = 0; i < 70; i++) engine.tick();
    expect(player.alive).toBe(true);
    expect(state.players[1].bombsActive).toBe(0);
  });

  it('bombs an adjacent breakable, escapes, and destroys it', () => {
    const engine = new GameEngine(13);
    engine.start(1);
    const state = engine.state;
    clearArea(state, 6, 6, 10, 10);
    addBreakable(state, 9, 10);
    let sawBomb = false;
    for (let i = 0; i < 160; i++) {
      engine.tick();
      if (findBombOwnedBy(state, 1)) {
        sawBomb = true;
        break;
      }
    }
    expect(sawBomb).toBe(true);
    for (let i = 0; i < 160; i++) engine.tick();
    expect(state.board[9][10].block).toBeNull();
    expect(state.players[1].alive).toBe(true);
  });

  it('sees a clear line to an idle human, bombs it, and secures the kill', () => {
    const engine = new GameEngine(17);
    engine.start(1);
    const state = engine.state;
    clearArea(state, 6, 6, 10, 10);
    teleport(state, 0, 6, 10);
    state.players[1].power = 4;
    let sawBomb = false;
    for (let i = 0; i < 200; i++) {
      engine.tick();
      if (findBombOwnedBy(state, 1)) {
        sawBomb = true;
        break;
      }
    }
    expect(sawBomb).toBe(true);
    for (let i = 0; i < 140; i++) engine.tick();
    expect(state.players[0].alive).toBe(false);
    expect(state.players[1].alive).toBe(true);
  });

  it('flees when a blast reaches its tile', () => {
    const engine = new GameEngine(19);
    engine.start(1);
    const state = engine.state;
    clearArea(state, 6, 6, 10, 10);
    teleport(state, 1, 8, 8);
    placeBombAt(state, 8, 8, 0, 3, 2);
    for (let i = 0; i < 140; i++) engine.tick();
    expect(state.players[1].alive).toBe(true);
    expect(state.players[1].tileX !== 8 || state.players[1].tileY !== 8).toBe(true);
  });

  it('cuts off an enemy by bombing where it is heading', () => {
    const engine = new GameEngine(23);
    engine.start(1, 'hard');
    const state = engine.state;
    clearArea(state, 6, 6, 10, 10);
    state.players[1].power = 4;
    teleport(state, 0, 6, 7);
    engine.setKey(0, 'down', true);
    let sawBomb = false;
    for (let i = 0; i < 40; i++) {
      engine.tick();
      if (findBombOwnedBy(state, 1)) {
        sawBomb = true;
        break;
      }
    }
    expect(sawBomb).toBe(true);
    for (let i = 0; i < 140; i++) engine.tick();
    expect(state.players[0].alive).toBe(false);
    expect(state.players[1].alive).toBe(true);
  });

  it('steals a contested item before a free one', () => {
    const engine = new GameEngine(29);
    engine.start(1, 'normal');
    const state = engine.state;
    clearArea(state, 6, 6, 10, 10);
    state.board[6][10].item = createItem('moreBomb');
    state.board[6][10].status |= STATUS.ITEM;
    state.board[10][8].item = createItem('moreSpeed');
    state.board[10][8].status |= STATUS.ITEM;
    teleport(state, 0, 7, 10);
    neutralize(state, 2);
    neutralize(state, 3);
    let contestedTick = -1;
    let freeTick = -1;
    for (let i = 0; i < 240; i++) {
      engine.tick();
      if (contestedTick < 0 && !state.board[6][10].item) contestedTick = i;
      if (freeTick < 0 && !state.board[10][8].item) freeTick = i;
    }
    expect(contestedTick).toBeGreaterThanOrEqual(0);
    expect(freeTick === -1 || freeTick > contestedTick).toBe(true);
  });
});
