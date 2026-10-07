import {
  BOARD_SIZE,
  BOMB_FUSE,
  TILE_SIZE,
  type Coord,
  type Difficulty,
  type GameState,
  type InputState,
  type Player,
  type Rng,
  type Tile,
} from './types';
import { getDirections } from './setup';

type DangerMap = Map<number, number>;

export interface AiTuning {
  reactionMin: number;
  reactionSpread: number;
  thinkMin: number;
  thinkSpread: number;
  escapeSafety: number;
  predictHorizon: number;
}

const TUNING: Record<Difficulty, AiTuning> = {
  easy: { reactionMin: 0.25, reactionSpread: 0.2, thinkMin: 0.5, thinkSpread: 0.3, escapeSafety: 0.4, predictHorizon: 0 },
  normal: { reactionMin: 0.08, reactionSpread: 0.12, thinkMin: 0.2, thinkSpread: 0.15, escapeSafety: 0.15, predictHorizon: 1 },
  hard: { reactionMin: 0.03, reactionSpread: 0.07, thinkMin: 0.1, thinkSpread: 0.1, escapeSafety: 0, predictHorizon: 1.5 },
};

export function aiTuning(difficulty: Difficulty): AiTuning {
  return TUNING[difficulty];
}

const FLEE_REPLAN_COOLDOWN = 0.12;
const STUCK_LIMIT = 0.5;

function key(x: number, y: number): number {
  return y * BOARD_SIZE + x;
}

function coordOf(k: number): Coord {
  return { x: k % BOARD_SIZE, y: Math.floor(k / BOARD_SIZE) };
}

function inBounds(x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < BOARD_SIZE && y < BOARD_SIZE;
}

function walkable(tile: Tile): boolean {
  return !tile.block && !tile.bomb;
}

export function blastTiles(state: GameState, origin: Coord, power: number): Set<number> {
  const tiles = new Set<number>();
  tiles.add(key(origin.x, origin.y));
  for (const dir of getDirections()) {
    for (let step = 1; step <= power; step++) {
      const x = origin.x + dir.x * step;
      const y = origin.y + dir.y * step;
      if (!inBounds(x, y)) break;
      const tile = state.board[x][y];
      if (tile.block) {
        if (tile.block.breakable) tiles.add(key(x, y));
        break;
      }
      tiles.add(key(x, y));
    }
  }
  return tiles;
}

export function computeDanger(state: GameState): DangerMap {
  const danger: DangerMap = new Map();
  const origins: Coord[] = [];
  const blasts: Set<number>[] = [];
  const effective: number[] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      const tile = state.board[x][y];
      if (tile.fire) danger.set(key(x, y), 0);
      if (tile.bomb) {
        origins.push({ x, y });
        blasts.push(blastTiles(state, { x, y }, tile.bomb.power));
        effective.push(tile.bomb.fuse);
      }
    }
  }
  for (let pass = 0; pass < origins.length; pass++) {
    let changed = false;
    for (let i = 0; i < origins.length; i++) {
      for (let j = 0; j < origins.length; j++) {
        if (i === j) continue;
        if (blasts[i].has(key(origins[j].x, origins[j].y)) && effective[i] < effective[j]) {
          effective[j] = effective[i];
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  for (let i = 0; i < origins.length; i++) {
    for (const k of blasts[i]) {
      const current = danger.get(k);
      if (current === undefined || effective[i] < current) danger.set(k, effective[i]);
    }
  }
  return danger;
}

function explore(
  state: GameState,
  start: Coord,
  passable: (x: number, y: number, tile: Tile) => boolean,
): { parent: Map<number, number | null>; order: number[] } {
  const parent = new Map<number, number | null>();
  const order: number[] = [];
  const startKey = key(start.x, start.y);
  parent.set(startKey, null);
  order.push(startKey);
  const queue = [startKey];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const { x, y } = coordOf(current);
    for (const dir of getDirections()) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!inBounds(nx, ny)) continue;
      const nextKey = key(nx, ny);
      if (parent.has(nextKey)) continue;
      if (!passable(nx, ny, state.board[nx][ny])) continue;
      parent.set(nextKey, current);
      order.push(nextKey);
      queue.push(nextKey);
    }
  }
  return { parent, order };
}

function extractPath(parent: Map<number, number | null>, startKey: number, goalKey: number): Coord[] {
  const path: Coord[] = [];
  let current: number | null = goalKey;
  while (current !== null && current !== startKey) {
    path.unshift(coordOf(current));
    current = parent.get(current) ?? null;
  }
  return path;
}

function pathSteps(parent: Map<number, number | null>, startKey: number, goalKey: number): number {
  let steps = 0;
  let current: number | null = goalKey;
  while (current !== null && current !== startKey) {
    steps += 1;
    current = parent.get(current) ?? null;
  }
  return steps;
}

const CROSS_MARGIN = 0.15;

function timedExplore(
  state: GameState,
  start: Coord,
  stepTime: number,
  allowed: (k: number, tile: Tile, arrival: number) => boolean,
): { parent: Map<number, number | null>; order: number[]; arrival: Map<number, number> } {
  const parent = new Map<number, number | null>();
  const order: number[] = [];
  const arrival = new Map<number, number>();
  const startKey = key(start.x, start.y);
  parent.set(startKey, null);
  order.push(startKey);
  arrival.set(startKey, 0);
  const queue = [startKey];
  let head = 0;
  while (head < queue.length) {
    const current = queue[head++];
    const { x, y } = coordOf(current);
    const time = arrival.get(current) ?? 0;
    const nextTime = time + stepTime;
    for (const dir of getDirections()) {
      const nx = x + dir.x;
      const ny = y + dir.y;
      if (!inBounds(nx, ny)) continue;
      const nextKey = key(nx, ny);
      if (parent.has(nextKey)) continue;
      if (!allowed(nextKey, state.board[nx][ny], nextTime)) continue;
      parent.set(nextKey, current);
      arrival.set(nextKey, nextTime);
      order.push(nextKey);
      queue.push(nextKey);
    }
  }
  return { parent, order, arrival };
}

export function planFlee(state: GameState, danger: DangerMap, start: Coord, speed: number): Coord[] | null {
  const startKey = key(start.x, start.y);
  const stepTime = TILE_SIZE / speed;
  const strict = (k: number, tile: Tile, arrival: number) => {
    if (!walkable(tile)) return false;
    const value = danger.get(k);
    if (value === 0) return false;
    if (value === undefined) return true;
    return value > arrival + stepTime + CROSS_MARGIN;
  };
  const first = timedExplore(state, start, stepTime, strict);
  for (const k of first.order) {
    if (k === startKey) continue;
    if (!danger.has(k)) return extractPath(first.parent, startKey, k);
  }
  const relaxed = (k: number, tile: Tile) => walkable(tile) && danger.get(k) !== 0;
  const second = timedExplore(state, start, stepTime, (k, tile) => relaxed(k, tile));
  const startDanger = danger.get(startKey);
  const ceiling = startDanger === undefined ? Infinity : startDanger;
  let best: number | null = null;
  let bestValue = ceiling;
  for (const k of second.order) {
    if (k === startKey) continue;
    const value = danger.get(k);
    if (value === undefined) {
      best = k;
      break;
    }
    if (value > bestValue) {
      bestValue = value;
      best = k;
    }
  }
  if (best === null) return null;
  return extractPath(second.parent, startKey, best);
}

export function planEscape(
  state: GameState,
  danger: DangerMap,
  from: Coord,
  power: number,
  speed: number,
  safety: number,
): Coord[] | null {
  const combined: DangerMap = new Map(danger);
  const newBlast = blastTiles(state, from, power);
  for (const k of newBlast) {
    const current = combined.get(k);
    if (current === undefined || BOMB_FUSE < current) combined.set(k, BOMB_FUSE);
  }
  const startKey = key(from.x, from.y);
  const stepTime = TILE_SIZE / speed;
  const allowed = (k: number, tile: Tile, arrival: number) => {
    if (!walkable(tile)) return false;
    const value = combined.get(k);
    if (value === 0) return false;
    if (value === undefined) return true;
    return value > arrival + stepTime + CROSS_MARGIN + safety;
  };
  const { parent, order } = timedExplore(state, from, stepTime, allowed);
  for (const k of order) {
    if (k === startKey) continue;
    if (!combined.has(k)) return extractPath(parent, startKey, k);
  }
  return null;
}

function hasClearLine(state: GameState, from: Coord, to: Coord, maxDistance: number): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx !== 0 && dy !== 0) return false;
  const distance = Math.abs(dx) + Math.abs(dy);
  if (distance === 0 || distance > maxDistance) return false;
  const sx = Math.sign(dx);
  const sy = Math.sign(dy);
  for (let step = 1; step < distance; step++) {
    const x = from.x + sx * step;
    const y = from.y + sy * step;
    if (!inBounds(x, y)) return false;
    if (state.board[x][y].block) return false;
  }
  return true;
}

function adjacentBreakable(state: GameState, at: Coord): boolean {
  for (const dir of getDirections()) {
    const x = at.x + dir.x;
    const y = at.y + dir.y;
    if (!inBounds(x, y)) continue;
    const block = state.board[x][y].block;
    if (block && block.breakable) return true;
  }
  return false;
}

export class AiController {
  private path: Coord[] = [];
  private mode: 'act' | 'flee' = 'act';
  private thinkTimer: number;
  private threatTimer = 0;
  private fleeCooldown = 0;
  private bombPulse = false;
  private stuckTimer = 0;
  private lastX = -1;
  private lastY = -1;
  private readonly reactionDelay: number;
  private readonly thinkInterval: number;
  private readonly escapeSafety: number;
  private readonly predictHorizon: number;
  private readonly memory = new Map<number, { px: number; py: number; vx: number; vy: number }>();

  constructor(private readonly rng: Rng, difficulty: Difficulty = 'normal') {
    const tuning = aiTuning(difficulty);
    this.escapeSafety = tuning.escapeSafety;
    this.predictHorizon = tuning.predictHorizon;
    this.reactionDelay =
      tuning.reactionMin + rng.nextInt(Math.round(tuning.reactionSpread * 1000)) / 1000;
    this.thinkInterval = tuning.thinkMin + rng.nextInt(Math.round(tuning.thinkSpread * 1000)) / 1000;
    this.thinkTimer = rng.nextInt(Math.round(this.thinkInterval * 1000)) / 1000;
  }

  update(state: GameState, player: Player, input: InputState, dt: number): void {
    input.up = false;
    input.down = false;
    input.left = false;
    input.right = false;
    input.bomb = false;
    if (!player.alive || !state.running) {
      this.lastX = -1;
      this.lastY = -1;
      return;
    }

    for (const other of state.players) {
      if (other.id === player.id || !other.alive) continue;
      const memory = this.memory.get(other.id);
      if (!memory) {
        this.memory.set(other.id, { px: other.px, py: other.py, vx: 0, vy: 0 });
      } else {
        const vx = (other.px - memory.px) / dt;
        const vy = (other.py - memory.py) / dt;
        memory.px = other.px;
        memory.py = other.py;
        memory.vx = vx;
        memory.vy = vy;
      }
    }

    this.thinkTimer -= dt;
    this.fleeCooldown -= dt;

    const danger = computeDanger(state);
    const start: Coord = { x: player.tileX, y: player.tileY };
    const startKey = key(start.x, start.y);
    const inDangerNow = danger.has(startKey);
    const nextThreat = this.path.length > 0 && danger.has(key(this.path[0].x, this.path[0].y));
    const threatened = inDangerNow || nextThreat;

    if (threatened) {
      this.threatTimer += dt;
      const goalThreatened =
        this.path.length === 0 ||
        nextThreat ||
        danger.has(key(this.path[this.path.length - 1].x, this.path[this.path.length - 1].y));
      if ((this.mode !== 'flee' || goalThreatened) && this.threatTimer >= this.reactionDelay && this.fleeCooldown <= 0) {
        const fleePath = planFlee(state, danger, start, player.speed);
        if (fleePath && fleePath.length > 0) {
          this.path = fleePath;
          this.mode = 'flee';
          this.stuckTimer = 0;
        } else {
          this.path = [];
        }
        this.fleeCooldown = FLEE_REPLAN_COOLDOWN;
      }
    } else {
      this.threatTimer = 0;
      if (this.thinkTimer <= 0) {
        this.thinkTimer = this.thinkInterval;
        this.think(state, player, danger, start);
      }
    }

    this.follow(player, input);

    if (this.lastX >= 0) {
      const moved = Math.abs(player.px - this.lastX) + Math.abs(player.py - this.lastY);
      if (moved < 0.05 && this.path.length > 0) {
        this.stuckTimer += dt;
        if (this.stuckTimer > STUCK_LIMIT) {
          this.path = [];
          this.stuckTimer = 0;
        }
      } else if (moved >= 0.05) {
        this.stuckTimer = 0;
      }
    }
    this.lastX = player.px;
    this.lastY = player.py;

    if (this.bombPulse) {
      input.bomb = true;
      this.bombPulse = false;
    }
  }

  private tryBomb(
    state: GameState,
    danger: DangerMap,
    player: Player,
    start: Coord,
    aim: Coord,
  ): boolean {
    if (!hasClearLine(state, start, aim, player.power)) return false;
    const escape = planEscape(state, danger, start, player.power, player.speed, this.escapeSafety);
    if (!escape) return false;
    this.path = escape;
    this.mode = 'flee';
    this.bombPulse = true;
    this.stuckTimer = 0;
    return true;
  }

  private predictTile(state: GameState, enemy: Player): Coord {
    const memory = this.memory.get(enemy.id);
    if (!memory) return { x: enemy.tileX, y: enemy.tileY };
    const ax = Math.abs(memory.vx);
    const ay = Math.abs(memory.vy);
    const speed = Math.max(ax, ay);
    const distance = speed * this.predictHorizon;
    if (distance < TILE_SIZE * 0.5) return { x: enemy.tileX, y: enemy.tileY };
    const horizontal = ax >= ay;
    const dirX = horizontal ? Math.sign(memory.vx) : 0;
    const dirY = horizontal ? 0 : Math.sign(memory.vy);
    let x = enemy.tileX;
    let y = enemy.tileY;
    let travelled = 0;
    while (travelled + TILE_SIZE <= distance) {
      const nx = x + dirX;
      const ny = y + dirY;
      if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE) break;
      const tile = state.board[nx][ny];
      if (tile.block || tile.bomb) break;
      x = nx;
      y = ny;
      travelled += TILE_SIZE;
    }
    return { x, y };
  }

  private think(state: GameState, player: Player, danger: DangerMap, start: Coord): void {
    if (player.bombsActive < player.bombLimit) {
      for (const enemy of state.players) {
        if (enemy.id === player.id || !enemy.alive) continue;
        const enemyTile: Coord = { x: enemy.tileX, y: enemy.tileY };
        if (this.tryBomb(state, danger, player, start, enemyTile)) return;
        if (this.predictHorizon > 0) {
          const predicted = this.predictTile(state, enemy);
          if (predicted.x !== enemy.tileX || predicted.y !== enemy.tileY) {
            if (this.tryBomb(state, danger, player, start, predicted)) return;
          }
        }
      }
      if (adjacentBreakable(state, start)) {
        const escape = planEscape(
          state,
          danger,
          start,
          player.power,
          player.speed,
          this.escapeSafety,
        );
        if (escape) {
          this.path = escape;
          this.mode = 'flee';
          this.bombPulse = true;
          this.stuckTimer = 0;
          return;
        }
      }
    }
    if (this.mode === 'flee') {
      this.mode = 'act';
      this.path = [];
    }
    if (this.path.length > 0) return;
    this.chooseGoal(state, player, danger, start);
  }

  private chooseGoal(state: GameState, player: Player, danger: DangerMap, start: Coord): void {
    const startKey = key(start.x, start.y);
    const safePassable = (x: number, y: number, tile: Tile) => walkable(tile) && !danger.has(key(x, y));
    const { parent, order } = explore(state, start, safePassable);

    const goalLos = (x: number, y: number) => {
      if (player.bombsActive >= player.bombLimit) return false;
      for (const enemy of state.players) {
        if (enemy.id === player.id || !enemy.alive) continue;
        if (hasClearLine(state, { x, y }, { x: enemy.tileX, y: enemy.tileY }, player.power)) return true;
      }
      return false;
    };
    const goalBreakable = (x: number, y: number) =>
      player.bombsActive < player.bombLimit && adjacentBreakable(state, { x, y });

    const itemCandidates: { goalKey: number; steps: number; contested: boolean }[] = [];
    for (const k of order) {
      if (k === startKey) continue;
      const { x, y } = coordOf(k);
      const tile = state.board[x][y];
      if (!tile.item || tile.block) continue;
      const steps = pathSteps(parent, startKey, k);
      let contested = false;
      for (const enemy of state.players) {
        if (enemy.id === player.id || !enemy.alive) continue;
        const enemyDist = Math.abs(enemy.tileX - x) + Math.abs(enemy.tileY - y);
        if (enemyDist < steps) {
          contested = true;
          break;
        }
      }
      itemCandidates.push({ goalKey: k, steps, contested });
    }
    if (itemCandidates.length > 0) {
      itemCandidates.sort((a, b) => Number(b.contested) - Number(a.contested) || a.steps - b.steps);
      this.path = extractPath(parent, startKey, itemCandidates[0].goalKey);
      this.mode = 'act';
      this.stuckTimer = 0;
      return;
    }

    const goals: Array<(x: number, y: number, tile: Tile) => boolean> = [goalLos, goalBreakable];
    for (const goal of goals) {
      for (const k of order) {
        if (k === startKey) continue;
        const { x, y } = coordOf(k);
        if (goal(x, y, state.board[x][y])) {
          this.path = extractPath(parent, startKey, k);
          this.mode = 'act';
          this.stuckTimer = 0;
          return;
        }
      }
    }
    const wanderTargets = order.filter((k) => k !== startKey);
    if (wanderTargets.length > 0) {
      const target = wanderTargets[this.rng.nextInt(wanderTargets.length)];
      this.path = extractPath(parent, startKey, target);
      this.mode = 'act';
      this.stuckTimer = 0;
    } else {
      this.path = [];
      this.mode = 'act';
    }
  }

  private follow(player: Player, input: InputState): void {
    while (this.path.length > 0) {
      const waypoint = this.path[0];
      if (waypoint.x === player.tileX && waypoint.y === player.tileY) {
        this.path.shift();
        continue;
      }
      break;
    }
    if (this.path.length === 0) return;
    const waypoint = this.path[0];
    const targetX = waypoint.x * TILE_SIZE + TILE_SIZE / 2;
    const targetY = waypoint.y * TILE_SIZE + TILE_SIZE / 2;
    if (Math.abs(targetX - player.px) > 1.5) {
      if (targetX < player.px) input.left = true;
      else input.right = true;
    } else if (Math.abs(targetY - player.py) > 1.5) {
      if (targetY < player.py) input.up = true;
      else input.down = true;
    } else {
      this.path.shift();
    }
  }
}
