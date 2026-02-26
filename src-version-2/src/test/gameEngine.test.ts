import { describe, expect, it } from 'vitest';
import { GameEngine } from '../core/gameEngine';
import { STATUS } from '../core/types';

describe('GameEngine', () => {
  it('starts with selected number of players and proper active mask', () => {
    const engine = new GameEngine(1);
    engine.selectPlayers(4);
    engine.start();
    expect(engine.state.players).toHaveLength(4);
    expect(engine.state.activeMask).toBe(STATUS.PLAYER1 + STATUS.PLAYER2 + STATUS.PLAYER3 + STATUS.PLAYER4);
  });

  it('blocks movement into solid fixed tile', () => {
    const engine = new GameEngine(2);
    engine.selectPlayers(2);
    engine.start();
    const p1 = engine.state.players[0];
    p1.x = 1;
    p1.y = 0;
    const from = engine.state.board[0][0];
    from.players = from.players.filter((id) => id !== p1.id);
    from.status -= p1.value;
    engine.state.board[1][0].players.push(p1.id);
    engine.state.board[1][0].status += p1.value;
    engine.keyPress('s');
    expect(p1.x).toBe(1);
    expect(p1.y).toBe(0);
  });

  it('bomb explodes and can kill a player in range', () => {
    const engine = new GameEngine(3);
    engine.selectPlayers(2);
    engine.start();
    const p1 = engine.state.players[0];
    const p2 = engine.state.players[1];

    p1.x = 0;
    p1.y = 0;
    p2.x = 1;
    p2.y = 0;

    const t00 = engine.state.board[0][0];
    const t10 = engine.state.board[1][0];
    t00.players = [p1.id];
    t10.players = [p2.id];
    t00.status = p1.value;
    t10.status = p2.value;
    t10.block = null;

    engine.keyPress('e');
    for (let i = 0; i < 22; i += 1) engine.tick();
    expect(p2.alive).toBe(false);
  });

  it('consumes item and applies more bomb effect', () => {
    const engine = new GameEngine(4);
    engine.selectPlayers(2);
    engine.start();
    const p1 = engine.state.players[0];
    p1.x = 0;
    p1.y = 0;
    engine.state.board[1][0].block = null;
    engine.state.board[1][0].status = STATUS.ITEM;
    engine.state.board[1][0].item = { kind: 'moreBomb', imageX: 8, imageY: 0 };

    const before = p1.bombLimit;
    engine.keyPress('d');
    expect(p1.bombLimit).toBe(before + 1);
  });
});