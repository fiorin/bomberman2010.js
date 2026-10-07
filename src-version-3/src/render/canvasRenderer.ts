import {
  BASE_SPEED,
  BLOCK_BREAK_DURATION,
  BOARD_PX,
  BOARD_SIZE,
  BOMB_FUSE,
  FIRE_DURATION,
  TILE_SIZE,
  type GameState,
  type Player,
} from '../core/types';

const WALK_ROWS = [1, 2, 3, 4];
const DEATH_ROWS = [5, 6, 7];
const FIRE_ROWS = [0, 1, 2];
const BREAK_ROWS = [5, 4, 3];

export class CanvasRenderer {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly sprite: HTMLImageElement;
  private readonly readyPromise: Promise<void>;

  constructor(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context unavailable');
    this.ctx = ctx;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(BOARD_PX * dpr);
    canvas.height = Math.round(BOARD_PX * dpr);
    canvas.style.width = `${BOARD_PX}px`;
    canvas.style.height = `${BOARD_PX}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    this.sprite = new Image();
    this.readyPromise = new Promise<void>((resolve) => {
      if (this.sprite.complete) {
        resolve();
        return;
      }
      this.sprite.onload = () => resolve();
      this.sprite.onerror = () => resolve();
    });
    this.sprite.src = '/resource/sprite.png';
  }

  ready(): Promise<void> {
    return this.readyPromise;
  }

  draw(state: GameState, alpha: number): void {
    const ctx = this.ctx;
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        this.blit(9, 0, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const tile = state.board[x][y];
        if (tile.item && !tile.block) {
          const bob = Math.sin(state.elapsed * 4 + (x + y) * 0.7) * 1.5;
          this.blit(tile.item.imageX, tile.item.imageY, x * TILE_SIZE, y * TILE_SIZE + bob);
        }
      }
    }
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const block = state.board[x][y].block;
        if (!block) continue;
        if (block.breakElapsed === null) {
          this.blit(block.imageX, block.imageY, x * TILE_SIZE, y * TILE_SIZE);
        } else {
          const index = Math.min(2, Math.floor(block.breakElapsed / (BLOCK_BREAK_DURATION / 3)));
          this.blit(9, BREAK_ROWS[index], x * TILE_SIZE, y * TILE_SIZE);
        }
      }
    }
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const bomb = state.board[x][y].bomb;
        if (!bomb) continue;
        const speed = bomb.elapsed > BOMB_FUSE - 0.5 ? 0.075 : 0.15;
        const row = Math.floor(bomb.elapsed / speed) % 4;
        this.blit(7, row, x * TILE_SIZE, y * TILE_SIZE);
      }
    }
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const fire = state.board[x][y].fire;
        if (!fire) continue;
        const index = Math.min(2, Math.floor(fire.elapsed / (FIRE_DURATION / 3)));
        this.blit(6, FIRE_ROWS[index], x * TILE_SIZE, y * TILE_SIZE);
      }
    }
    const sorted = [...state.players].sort(
      (a, b) =>
        a.prevPy + (a.py - a.prevPy) * alpha - (b.prevPy + (b.py - b.prevPy) * alpha),
    );
    for (const player of sorted) {
      const ix = player.prevPx + (player.px - player.prevPx) * alpha;
      const iy = player.prevPy + (player.py - player.prevPy) * alpha;
      this.blit(player.id, this.poseRow(player), ix - TILE_SIZE / 2, iy - TILE_SIZE / 2);
    }
  }

  private poseRow(player: Player): number {
    if (player.pose === 'dead') {
      if (player.poseTime < 0.15) return DEATH_ROWS[0];
      if (player.poseTime < 0.3) return DEATH_ROWS[1];
      return DEATH_ROWS[2];
    }
    if (player.pose === 'win') return Math.floor(player.poseTime / 0.35) % 2 === 0 ? 8 : 9;
    if (player.pose === 'draw') return 10;
    if (player.pose === 'walk') {
      const period = 0.09 * (BASE_SPEED / player.speed);
      return WALK_ROWS[Math.floor(player.animTime / period) % 4];
    }
    return 1;
  }

  private blit(spriteX: number, spriteY: number, dx: number, dy: number): void {
    this.ctx.drawImage(
      this.sprite,
      spriteX * TILE_SIZE,
      spriteY * TILE_SIZE,
      TILE_SIZE,
      TILE_SIZE,
      dx,
      dy,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
}
