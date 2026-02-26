export const BOARD_SIZE = 11;
export const TILE_SIZE = 30;
export const BOMB_TIMER_TICKS = 20;
export const TICK_MS = 100;
export const MATCH_SECONDS = 300;

export const STATUS = {
  PLAYER1: 1,
  PLAYER2: 2,
  PLAYER3: 4,
  PLAYER4: 8,
  ITEM: 32,
  BLOCK_SOLID: 64,
  BLOCK_BREAKABLE: 128,
  BOMB: 256
} as const;

export type Direction = { x: number; y: number };
export type Coord = { x: number; y: number };

export type ItemKind = 'moreBomb' | 'moreFire' | 'moreSpeed' | 'maxFire';

export interface Item {
  kind: ItemKind;
  imageX: number;
  imageY: number;
}

export interface Block {
  breakable: boolean;
  value: number;
  imageX: number;
  imageY: number;
  breakAnimY: number | null;
}

export interface Bomb {
  timer: number;
  ownerId: number;
  power: number;
  imageX: number;
  imageY: number;
}

export interface Fire {
  frame: 1 | 2 | 3;
}

export interface Player {
  id: number;
  name: string;
  value: number;
  alive: boolean;
  life: number;
  imageX: number;
  imageY: number;
  x: number;
  y: number;
  bombLimit: number;
  power: number;
  speed: number;
  moveCooldown: number;
  canMove: boolean;
  animTick: boolean;
  controls: Controls;
}

export interface Controls {
  up: string;
  right: string;
  down: string;
  left: string;
  bomb: string;
}

export interface Tile {
  status: number;
  block: Block | null;
  bomb: Bomb | null;
  item: Item | null;
  fire: Fire | null;
  players: number[];
}

export interface GameState {
  board: Tile[][];
  players: Player[];
  activeMask: number;
  selectedPlayers: number;
  running: boolean;
  winnerText: string;
  remainingSeconds: number;
  reserved: Coord[];
}

export interface Rng {
  nextInt(maxExclusive: number): number;
}