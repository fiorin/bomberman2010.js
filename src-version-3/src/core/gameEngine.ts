import { AiController } from './ai';
import { SeededRng } from './random';
import {
  breakableBlockCoords,
  createBoard,
  createBreakableBlock,
  createSolidBlock,
  getDirections,
  initialPlayers,
  itemCoords,
  randomItem,
  solidBlockCoords,
} from './setup';
import {
  BLOCK_BREAK_DURATION,
  BOARD_PX,
  BOARD_SIZE,
  BOMB_FUSE,
  FIRE_DURATION,
  MAX_HUMANS,
  MAX_POWER,
  MAX_SPEED,
  MATCH_SECONDS,
  PLAYER_HALF,
  SPEED_STEP,
  STATUS,
  TICK_SECONDS,
  TILE_SIZE,
  emptyInput,
  type Coord,
  type Difficulty,
  type GameState,
  type InputKey,
  type InputState,
  type Item,
  type Player,
  type Rng,
} from './types';

const COLLISION_EPS = 0.01;

export class GameEngine {
  readonly state: GameState;
  private readonly rng: Rng;
  private readonly aiRng: Rng;
  private held: InputState[] = [];
  private aiInputs: InputState[] = [];
  private ai: (AiController | null)[] = [null, null, null, null];
  private bombHeld: boolean[] = [false, false, false, false];

  constructor(seed?: number) {
    const base = seed ?? Date.now();
    this.rng = new SeededRng(base);
    this.aiRng = new SeededRng((base ^ 0x9e3779b9) >>> 0);
    this.state = {
      board: createBoard(),
      players: [],
      humanCount: 0,
      difficulty: 'normal',
      activeMask: 0,
      started: false,
      running: false,
      winnerText: '',
      remainingSeconds: MATCH_SECONDS,
      elapsed: 0,
    };
  }

  start(humanCount: number, difficulty: Difficulty = 'normal'): void {
    const humans = Math.min(Math.max(Math.round(humanCount), 1), MAX_HUMANS);
    this.state.board = createBoard();
    this.state.players = initialPlayers(humans);
    this.state.humanCount = humans;
    this.state.difficulty = difficulty;
    this.state.activeMask = 15;
    this.state.started = true;
    this.state.running = true;
    this.state.winnerText = '';
    this.state.remainingSeconds = MATCH_SECONDS;
    this.state.elapsed = 0;
    this.held = this.state.players.map(() => emptyInput());
    this.aiInputs = this.state.players.map(() => emptyInput());
    this.bombHeld = [false, false, false, false];
    this.ai = this.state.players.map((player) =>
      player.human
        ? null
        : new AiController(new SeededRng(this.aiRng.nextInt(1 << 30)), difficulty),
    );
    this.placeMapObjects();
    this.placePlayers();
  }

  setKey(playerId: number, key: InputKey, down: boolean): void {
    const player = this.state.players[playerId];
    if (!player || !player.human) return;
    this.held[playerId][key] = down;
  }

  stop(): void {
    this.state.running = false;
    this.state.started = false;
    this.state.winnerText = '';
  }

  tick(dt: number = TICK_SECONDS): void {
    for (const player of this.state.players) {
      if (player.pose === 'dead' || player.pose === 'win' || player.pose === 'draw') {
        player.poseTime += dt;
      }
    }
    if (!this.state.running) return;
    this.state.elapsed += dt;
    for (const player of this.state.players) {
      player.prevPx = player.px;
      player.prevPy = player.py;
    }
    this.updatePlayers(dt);
    this.updateMembershipAndItems();
    this.updateWorld(dt);
    this.updateClock(dt);
    this.evaluateWinner();
  }

  formatClock(): string {
    const total = Math.max(0, Math.ceil(this.state.remainingSeconds));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  private updatePlayers(dt: number): void {
    for (let i = 0; i < this.state.players.length; i++) {
      const player = this.state.players[i];
      if (!player.alive) {
        player.moving = false;
        continue;
      }
      let input: InputState;
      if (player.human) {
        input = this.held[i];
      } else {
        input = this.aiInputs[i];
        this.ai[i]?.update(this.state, player, input, dt);
      }
      if (input.bomb && !this.bombHeld[i]) this.placeBomb(player);
      this.bombHeld[i] = input.bomb;
      this.movePlayer(player, input, dt);
    }
  }

  private movePlayer(player: Player, input: InputState, dt: number): void {
    const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
    const step = player.speed * dt;
    let moved = false;
    if (dx !== 0 && dy === 0) {
      this.alignLane(player, 'y', step);
      moved = this.tryMove(player, 'x', Math.sign(dx) * step) !== 0;
    } else if (dy !== 0 && dx === 0) {
      this.alignLane(player, 'x', step);
      moved = this.tryMove(player, 'y', Math.sign(dy) * step) !== 0;
    } else if (dx !== 0 && dy !== 0) {
      moved = this.tryMove(player, 'x', Math.sign(dx) * step) !== 0;
      moved = this.tryMove(player, 'y', Math.sign(dy) * step) !== 0 || moved;
    }
    player.moving = moved;
    player.pose = moved ? 'walk' : 'idle';
    if (moved) player.animTime += dt;
  }

  private alignLane(player: Player, axis: 'x' | 'y', limit: number): void {
    const pos = axis === 'x' ? player.px : player.py;
    const lane = Math.floor(pos / TILE_SIZE) * TILE_SIZE + TILE_SIZE / 2;
    const diff = lane - pos;
    if (Math.abs(diff) < 0.001) return;
    const delta = Math.max(-limit, Math.min(limit, diff));
    this.tryMove(player, axis, delta);
  }

  private tryMove(player: Player, axis: 'x' | 'y', delta: number): number {
    if (delta === 0) return 0;
    const onX = axis === 'x';
    const current = onX ? player.px : player.py;
    const other = onX ? player.py : player.px;
    const boundLo = PLAYER_HALF;
    const boundHi = BOARD_PX - PLAYER_HALF;
    let target = Math.max(boundLo, Math.min(boundHi, current + delta));

    const otherStart = Math.floor((other - PLAYER_HALF) / TILE_SIZE);
    const otherEnd = Math.floor((other + PLAYER_HALF - COLLISION_EPS) / TILE_SIZE);
    const axisStart = Math.floor((target - PLAYER_HALF) / TILE_SIZE);
    const axisEnd = Math.floor((target + PLAYER_HALF - COLLISION_EPS) / TILE_SIZE);

    for (let a = axisStart; a <= axisEnd; a++) {
      for (let o = otherStart; o <= otherEnd; o++) {
        const tx = onX ? a : o;
        const ty = onX ? o : a;
        if (this.isWalkableFor(player, tx, ty)) continue;
        const edge = Math.min(Math.max(onX ? tx : ty, 0), BOARD_SIZE - 1) * TILE_SIZE;
        if (delta > 0) {
          target = Math.min(target, edge - PLAYER_HALF - COLLISION_EPS);
        } else {
          target = Math.max(target, edge + TILE_SIZE + PLAYER_HALF + COLLISION_EPS);
        }
      }
    }
    target = Math.max(boundLo, Math.min(boundHi, target));
    const displacement = target - current;
    if (displacement === 0) return 0;
    if (onX) player.px = target;
    else player.py = target;
    return displacement;
  }

  private isWalkableFor(player: Player, tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= BOARD_SIZE || ty >= BOARD_SIZE) return false;
    const tile = this.state.board[tx][ty];
    if (tile.block) return false;
    if (tile.bomb) return this.intersectsTile(player, tx, ty);
    return true;
  }

  private intersectsTile(player: Player, tx: number, ty: number): boolean {
    const cx = tx * TILE_SIZE + TILE_SIZE / 2;
    const cy = ty * TILE_SIZE + TILE_SIZE / 2;
    return (
      Math.abs(player.px - cx) < PLAYER_HALF + TILE_SIZE / 2 &&
      Math.abs(player.py - cy) < PLAYER_HALF + TILE_SIZE / 2
    );
  }

  private updateMembershipAndItems(): void {
    for (const player of this.state.players) {
      if (!player.alive) continue;
      const tx = Math.floor(player.px / TILE_SIZE);
      const ty = Math.floor(player.py / TILE_SIZE);
      if (tx !== player.tileX || ty !== player.tileY) {
        const oldTile = this.state.board[player.tileX][player.tileY];
        oldTile.players = oldTile.players.filter((id) => id !== player.id);
        oldTile.status &= ~player.value;
        player.tileX = tx;
        player.tileY = ty;
        const newTile = this.state.board[tx][ty];
        newTile.players.push(player.id);
        newTile.status |= player.value;
      }
      const tile = this.state.board[player.tileX][player.tileY];
      if (tile.item && !tile.block) this.consumeItem(player, tile.item);
    }
  }

  private consumeItem(player: Player, item: Item): void {
    const tile = this.state.board[player.tileX][player.tileY];
    if (item.kind === 'moreBomb') player.bombLimit += 1;
    else if (item.kind === 'moreFire') player.power = Math.min(MAX_POWER, player.power + 1);
    else if (item.kind === 'moreSpeed') player.speed = Math.min(MAX_SPEED, player.speed + SPEED_STEP);
    else if (item.kind === 'maxFire') player.power = MAX_POWER;
    tile.item = null;
    tile.status &= ~STATUS.ITEM;
  }

  private placeBomb(player: Player): void {
    if (!player.alive) return;
    const tile = this.state.board[player.tileX][player.tileY];
    if (tile.block || tile.bomb) return;
    if (player.bombsActive >= player.bombLimit) return;
    tile.bomb = { ownerId: player.id, power: player.power, fuse: BOMB_FUSE, elapsed: 0 };
    tile.status |= STATUS.BOMB;
    player.bombsActive += 1;
  }

  private updateWorld(dt: number): void {
    const board = this.state.board;
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const block = board[x][y].block;
        if (block && block.breakElapsed !== null) {
          block.breakElapsed += dt;
          if (block.breakElapsed >= BLOCK_BREAK_DURATION) {
            board[x][y].block = null;
            board[x][y].status &= ~(STATUS.BLOCK_SOLID | STATUS.BLOCK_BREAKABLE);
          }
        }
        const bomb = board[x][y].bomb;
        if (bomb) {
          bomb.fuse -= dt;
          bomb.elapsed += dt;
        }
      }
    }

    const queue: Coord[] = [];
    const queued = new Set<number>();
    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const bomb = board[x][y].bomb;
        if (bomb && bomb.fuse <= 0) {
          queue.push({ x, y });
          queued.add(y * BOARD_SIZE + x);
        }
      }
    }
    let head = 0;
    while (head < queue.length) {
      const { x, y } = queue[head++];
      const tile = board[x][y];
      const bomb = tile.bomb;
      if (!bomb) continue;
      tile.bomb = null;
      tile.status &= ~STATUS.BOMB;
      this.state.players[bomb.ownerId].bombsActive -= 1;
      this.explode(x, y, bomb.power, queue, queued);
    }

    for (let x = 0; x < BOARD_SIZE; x++) {
      for (let y = 0; y < BOARD_SIZE; y++) {
        const tile = board[x][y];
        if (tile.fire) {
          tile.fire.elapsed += dt;
          for (const id of [...tile.players]) {
            const player = this.state.players[id];
            if (player.alive && player.tileX === x && player.tileY === y) this.killPlayer(player);
          }
          if (tile.fire.elapsed >= FIRE_DURATION) tile.fire = null;
        }
      }
    }
  }

  private explode(cx: number, cy: number, power: number, queue: Coord[], queued: Set<number>): void {
    this.hit(cx, cy, queue, queued);
    for (const dir of getDirections()) {
      for (let step = 1; step <= power; step++) {
        if (this.hit(cx + dir.x * step, cy + dir.y * step, queue, queued)) break;
      }
    }
  }

  private hit(x: number, y: number, queue: Coord[], queued: Set<number>): boolean {
    if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE) return true;
    const tile = this.state.board[x][y];
    if (tile.block) {
      if (tile.block.breakable) {
        if (tile.block.breakElapsed === null) tile.block.breakElapsed = 0;
        if (!tile.fire) tile.fire = { elapsed: 0 };
      }
      return true;
    }
    if (tile.item) {
      tile.item = null;
      tile.status &= ~STATUS.ITEM;
    }
    if (!tile.fire) tile.fire = { elapsed: 0 };
    if (tile.bomb && tile.bomb.fuse > 0) {
      tile.bomb.fuse = 0;
      const k = y * BOARD_SIZE + x;
      if (!queued.has(k)) {
        queued.add(k);
        queue.push({ x, y });
      }
    }
    return false;
  }

  private killPlayer(player: Player): void {
    if (!player.alive) return;
    player.alive = false;
    player.pose = 'dead';
    player.poseTime = 0;
    player.moving = false;
    const tile = this.state.board[player.tileX][player.tileY];
    tile.players = tile.players.filter((id) => id !== player.id);
    tile.status &= ~player.value;
    this.state.activeMask &= ~player.value;
  }

  private updateClock(dt: number): void {
    this.state.remainingSeconds -= dt;
    if (this.state.remainingSeconds <= 0) {
      this.state.remainingSeconds = 0;
      this.finish('EMPATE');
    }
  }

  private evaluateWinner(): void {
    let mask = 0;
    for (const player of this.state.players) {
      if (player.alive) mask |= player.value;
    }
    this.state.activeMask = mask;
    if (mask === 0) {
      this.finish('EMPATE');
      return;
    }
    if ((mask & (mask - 1)) === 0) {
      const winner = this.state.players.find((player) => player.alive);
      if (winner) this.finish(`${winner.name} VENCEU`, winner.id);
    }
  }

  private finish(message: string, winnerId?: number): void {
    if (!this.state.running) return;
    this.state.running = false;
    this.state.winnerText = message;
    for (const player of this.state.players) {
      player.moving = false;
      if (!player.alive) continue;
      player.pose = winnerId === player.id ? 'win' : 'draw';
      player.poseTime = 0;
    }
  }

  private placeMapObjects(): void {
    for (const coord of solidBlockCoords()) {
      const tile = this.state.board[coord.x][coord.y];
      tile.block = createSolidBlock();
      tile.status |= STATUS.BLOCK_SOLID;
    }
    const breakables = breakableBlockCoords(this.rng);
    for (const coord of breakables) {
      const tile = this.state.board[coord.x][coord.y];
      tile.block = createBreakableBlock();
      tile.status |= STATUS.BLOCK_BREAKABLE;
    }
    for (const coord of itemCoords(breakables, this.rng)) {
      const tile = this.state.board[coord.x][coord.y];
      tile.item = randomItem(this.rng);
      tile.status |= STATUS.ITEM;
    }
  }

  private placePlayers(): void {
    for (const player of this.state.players) {
      const tile = this.state.board[player.tileX][player.tileY];
      tile.players.push(player.id);
      tile.status |= player.value;
    }
  }
}
