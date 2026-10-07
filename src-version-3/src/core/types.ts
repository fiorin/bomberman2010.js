export const BOARD_SIZE = 11;
export const TILE_SIZE = 30;
export const BOARD_PX = BOARD_SIZE * TILE_SIZE;
export const TICK_MS = 1000 / 60;
export const TICK_SECONDS = 1 / 60;
export const MAX_FRAME_MS = 250;
export const MATCH_SECONDS = 300;
export const BOMB_FUSE = 2;
export const FIRE_DURATION = 0.5;
export const BLOCK_BREAK_DURATION = 0.3;
export const BASE_SPEED = 100;
export const SPEED_STEP = 30;
export const MAX_SPEED = 220;
export const MAX_POWER = 10;
export const PLAYER_HALF = 11;
export const MAX_HUMANS = 4;

export const STATUS = {
  PLAYER1: 1,
  PLAYER2: 2,
  PLAYER3: 4,
  PLAYER4: 8,
  ITEM: 32,
  BLOCK_SOLID: 64,
  BLOCK_BREAKABLE: 128,
  BOMB: 256,
} as const;

export type Direction = 'up' | 'down' | 'left' | 'right';
export type InputKey = Direction | 'bomb';

export type ItemKind = 'moreBomb' | 'moreFire' | 'moreSpeed' | 'maxFire';

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface Item {
  kind: ItemKind;
  imageX: number;
  imageY: number;
}

export interface Block {
  breakable: boolean;
  breakElapsed: number | null;
  imageX: number;
  imageY: number;
}

export interface Bomb {
  ownerId: number;
  power: number;
  fuse: number;
  elapsed: number;
}

export interface Fire {
  elapsed: number;
}

export type PlayerPose = 'idle' | 'walk' | 'dead' | 'win' | 'draw';

export interface Controls {
  up: string;
  right: string;
  down: string;
  left: string;
  bomb: string;
}

export interface InputState {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  bomb: boolean;
}

export interface Player {
  id: number;
  name: string;
  value: number;
  human: boolean;
  alive: boolean;
  px: number;
  py: number;
  prevPx: number;
  prevPy: number;
  tileX: number;
  tileY: number;
  moving: boolean;
  animTime: number;
  pose: PlayerPose;
  poseTime: number;
  bombLimit: number;
  bombsActive: number;
  power: number;
  speed: number;
  controls: Controls;
}

export interface Tile {
  status: number;
  block: Block | null;
  bomb: Bomb | null;
  item: Item | null;
  fire: Fire | null;
  players: number[];
}

export interface Coord {
  x: number;
  y: number;
}

export interface GameState {
  board: Tile[][];
  players: Player[];
  humanCount: number;
  difficulty: Difficulty;
  activeMask: number;
  started: boolean;
  running: boolean;
  winnerText: string;
  remainingSeconds: number;
  elapsed: number;
}

export interface Rng {
  nextInt(maxExclusive: number): number;
}

export function emptyInput(): InputState {
  return { up: false, down: false, left: false, right: false, bomb: false };
}

export function emptyInputWith(...keys: InputKey[]): InputState {
  const input = emptyInput();
  for (const key of keys) input[key] = true;
  return input;
}
