import { GameEngine } from '../core/gameEngine';
import { createBreakableBlock } from '../core/setup';
import { STATUS, TILE_SIZE, type Bomb, type GameState } from '../core/types';

export function clearArea(
  state: GameState,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): void {
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      const tile = state.board[x][y];
      if (tile.block && tile.block.breakable) {
        tile.block = null;
        tile.status &= ~STATUS.BLOCK_BREAKABLE;
      }
      if (tile.item) {
        tile.item = null;
        tile.status &= ~STATUS.ITEM;
      }
      if (tile.bomb) {
        tile.bomb = null;
        tile.status &= ~STATUS.BOMB;
      }
      if (tile.fire) tile.fire = null;
    }
  }
}

export function teleport(
  state: GameState,
  playerId: number,
  tx: number,
  ty: number,
): void {
  const player = state.players[playerId];
  const oldTile = state.board[player.tileX][player.tileY];
  oldTile.players = oldTile.players.filter((id) => id !== player.id);
  oldTile.status &= ~player.value;
  player.tileX = tx;
  player.tileY = ty;
  player.px = tx * TILE_SIZE + TILE_SIZE / 2;
  player.py = ty * TILE_SIZE + TILE_SIZE / 2;
  player.prevPx = player.px;
  player.prevPy = player.py;
  const newTile = state.board[tx][ty];
  if (!newTile.players.includes(player.id)) newTile.players.push(player.id);
  newTile.status |= player.value;
}

export function placeBombAt(
  state: GameState,
  x: number,
  y: number,
  ownerId: number,
  power = 1,
  fuse = 2,
): void {
  const tile = state.board[x][y];
  tile.bomb = { ownerId, power, fuse, elapsed: 0 } satisfies Bomb;
  tile.status |= STATUS.BOMB;
  state.players[ownerId].bombsActive += 1;
}

export function addBreakable(state: GameState, x: number, y: number): void {
  const tile = state.board[x][y];
  if (tile.block) return;
  tile.block = createBreakableBlock();
  tile.status |= STATUS.BLOCK_BREAKABLE;
}

export function findBombOwnedBy(state: GameState, ownerId: number): boolean {
  for (const column of state.board) {
    for (const tile of column) {
      if (tile.bomb && tile.bomb.ownerId === ownerId) return true;
    }
  }
  return false;
}

export function makeEngine(seed = 1): GameEngine {
  return new GameEngine(seed);
}

export function neutralize(state: GameState, playerId: number): void {
  const player = state.players[playerId];
  if (!player.alive) return;
  player.alive = false;
  player.pose = 'dead';
  player.poseTime = 0;
  player.moving = false;
  const tile = state.board[player.tileX][player.tileY];
  tile.players = tile.players.filter((id) => id !== player.id);
  tile.status &= ~player.value;
}
