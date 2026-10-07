import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/gameEngine';
import { createItem } from '../core/setup';
import { STATUS } from '../core/types';
import { clearArea, placeBombAt, teleport } from './helpers';

describe('player setup', () => {
  it('always creates four players with the chosen number of humans', () => {
    for (const humans of [1, 2, 3, 4]) {
      const engine = new GameEngine(42);
      engine.start(humans);
      expect(engine.state.players).toHaveLength(4);
      expect(engine.state.players.filter((p) => p.human)).toHaveLength(humans);
      expect(engine.state.players.every((p) => p.alive)).toBe(true);
      expect(engine.state.activeMask).toBe(15);
    }
  });

  it('clamps the human count between 1 and 4', () => {
    const low = new GameEngine(1);
    low.start(0);
    expect(low.state.humanCount).toBe(1);
    const high = new GameEngine(1);
    high.start(9);
    expect(high.state.humanCount).toBe(4);
  });
});

describe('smooth movement', () => {
  it('moves continuously at the configured speed', () => {
    const engine = new GameEngine(7);
    engine.start(1);
    clearArea(engine.state, 0, 0, 10, 0);
    const player = engine.state.players[0];
    engine.setKey(0, 'right', true);
    for (let i = 0; i < 10; i++) engine.tick();
    expect(player.px).toBeCloseTo(31.67, 1);
    expect(player.moving).toBe(true);
    expect(player.pose).toBe('walk');
    expect(player.animTime).toBeGreaterThan(0);
    for (let i = 0; i < 50; i++) engine.tick();
    expect(player.px).toBeCloseTo(115, 0);
    engine.setKey(0, 'right', false);
    engine.tick();
    expect(player.moving).toBe(false);
    expect(player.pose).toBe('idle');
  });

  it('stops against a solid pillar', () => {
    const engine = new GameEngine(7);
    engine.start(4);
    clearArea(engine.state, 0, 1, 1, 1);
    teleport(engine.state, 0, 0, 1);
    engine.setKey(0, 'right', true);
    for (let i = 0; i < 30; i++) engine.tick();
    const player = engine.state.players[0];
    expect(player.px).toBeLessThan(19);
    expect(player.px).toBeGreaterThan(15);
    expect(player.py).toBeCloseTo(45, 3);
  });
});

describe('bombs', () => {
  it('kills players in the blast while the owner escapes', () => {
    const engine = new GameEngine(3);
    engine.start(4);
    const state = engine.state;
    clearArea(state, 0, 0, 5, 0);
    clearArea(state, 0, 1, 0, 7);
    engine.setKey(0, 'bomb', true);
    engine.tick();
    engine.setKey(0, 'bomb', false);
    engine.tick();
    expect(state.board[0][0].bomb).not.toBeNull();
    teleport(state, 1, 1, 0);
    engine.setKey(0, 'down', true);
    for (let i = 0; i < 130; i++) engine.tick();
    expect(state.players[1].alive).toBe(false);
    expect(state.players[0].alive).toBe(true);
    expect(state.board[0][0].bomb).toBeNull();
    expect(state.players[0].bombsActive).toBe(0);
  });

  it('lets the owner walk off their bomb but blocks re-entry', () => {
    const engine = new GameEngine(5);
    engine.start(4);
    clearArea(engine.state, 0, 0, 5, 0);
    engine.setKey(0, 'bomb', true);
    engine.tick();
    engine.setKey(0, 'bomb', false);
    engine.setKey(0, 'right', true);
    for (let i = 0; i < 30; i++) engine.tick();
    const player = engine.state.players[0];
    expect(player.px).toBeGreaterThan(45);
    expect(player.alive).toBe(true);
    engine.setKey(0, 'right', false);
    engine.setKey(0, 'left', true);
    for (let i = 0; i < 30; i++) engine.tick();
    expect(player.px).toBeGreaterThan(41);
    expect(player.alive).toBe(true);
  });

  it('chain-detonates bombs caught in a blast', () => {
    const engine = new GameEngine(5);
    engine.start(4);
    const state = engine.state;
    clearArea(state, 0, 0, 5, 0);
    engine.setKey(0, 'bomb', true);
    engine.tick();
    engine.setKey(0, 'bomb', false);
    teleport(state, 0, 0, 9);
    placeBombAt(state, 1, 0, 0, 1, 1);
    for (let i = 0; i < 60; i++) engine.tick();
    expect(state.board[1][0].bomb).toBeNull();
    expect(state.board[0][0].bomb).toBeNull();
    expect(state.players[0].alive).toBe(true);
  });
});

describe('power-ups', () => {
  it('picks up items and applies their effects', () => {
    const engine = new GameEngine(7);
    engine.start(4);
    const state = engine.state;
    clearArea(state, 0, 0, 5, 0);
    state.board[1][0].item = createItem('moreBomb');
    state.board[1][0].status |= STATUS.ITEM;
    state.board[2][0].item = createItem('moreSpeed');
    state.board[2][0].status |= STATUS.ITEM;
    engine.setKey(0, 'right', true);
    for (let i = 0; i < 30; i++) engine.tick();
    const player = state.players[0];
    expect(player.bombLimit).toBe(2);
    expect(player.speed).toBe(130);
    expect(state.board[1][0].item).toBeNull();
    expect(state.board[2][0].item).toBeNull();
  });
});

describe('match clock', () => {
  it('ends the match as a draw when time runs out', () => {
    const engine = new GameEngine(9);
    engine.start(1);
    engine.tick(150);
    engine.tick(150);
    expect(engine.state.running).toBe(false);
    expect(engine.state.winnerText).toBe('EMPATE');
    expect(engine.state.remainingSeconds).toBe(0);
    expect(engine.formatClock()).toBe('00:00');
    for (const player of engine.state.players) {
      if (player.alive) expect(player.pose).toBe('draw');
      else expect(player.pose).toBe('dead');
    }
  });
});
