import {
  BASE_SPEED,
  BOARD_SIZE,
  STATUS,
  TILE_SIZE,
  type Block,
  type Coord,
  type Controls,
  type Item,
  type ItemKind,
  type Player,
  type Rng,
  type Tile,
} from './types';

const DIRECTIONS: Coord[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const RESERVED: Coord[] = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: 9, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 1 },
  { x: 10, y: 9 },
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 1, y: 10 },
  { x: 0, y: 10 },
  { x: 0, y: 9 },
];

export function getDirections(): readonly Coord[] {
  return DIRECTIONS;
}

export function getReserved(): readonly Coord[] {
  return RESERVED;
}

export function createBoard(): Tile[][] {
  const board: Tile[][] = [];
  for (let x = 0; x < BOARD_SIZE; x++) {
    const column: Tile[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      column.push({ status: 0, block: null, bomb: null, item: null, fire: null, players: [] });
    }
    board.push(column);
  }
  return board;
}

export function createSolidBlock(): Block {
  return { breakable: false, breakElapsed: null, imageX: 9, imageY: 1 };
}

export function createBreakableBlock(): Block {
  return { breakable: true, breakElapsed: null, imageX: 9, imageY: 2 };
}

export function createItem(kind: ItemKind): Item {
  const sprites: Record<ItemKind, [number, number]> = {
    moreBomb: [8, 0],
    moreFire: [8, 4],
    moreSpeed: [8, 2],
    maxFire: [8, 1],
  };
  const [imageX, imageY] = sprites[kind];
  return { kind, imageX, imageY };
}

export function randomItem(rng: Rng): Item {
  const roll = rng.nextInt(16);
  if (roll < 6) return createItem('moreBomb');
  if (roll < 12) return createItem('moreFire');
  if (roll < 14) return createItem('moreSpeed');
  return createItem('maxFire');
}

export function removeRandom(base: Coord[], count: number, rng: Rng): Coord[] {
  const result = [...base];
  for (let i = 0; i < count && result.length > 0; i++) {
    const index = rng.nextInt(result.length);
    result.splice(index, 1);
  }
  return result;
}

export function allCoordinates(): Coord[] {
  const coords: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y++) {
    for (let x = 0; x < BOARD_SIZE; x++) {
      coords.push({ x, y });
    }
  }
  return coords;
}

export function solidBlockCoords(): Coord[] {
  return allCoordinates().filter((c) => c.x % 2 === 1 && c.y % 2 === 1);
}

export function breakableBlockCoords(rng: Rng): Coord[] {
  const reserved = new Set(RESERVED.map((c) => `${c.x},${c.y}`));
  const solids = new Set(solidBlockCoords().map((c) => `${c.x},${c.y}`));
  const candidates = allCoordinates().filter(
    (c) => !reserved.has(`${c.x},${c.y}`) && !solids.has(`${c.x},${c.y}`),
  );
  return removeRandom(candidates, rng.nextInt(30) + 10, rng);
}

export function itemCoords(breakables: Coord[], rng: Rng): Coord[] {
  return removeRandom([...breakables], Math.floor(breakables.length / 2), rng);
}

export function playerControls(id: number): Controls {
  const controls: Controls[] = [
    { up: 'w', right: 'd', down: 's', left: 'a', bomb: 'e' },
    { up: 'i', right: 'l', down: 'k', left: 'j', bomb: 'o' },
    { up: '8', right: '6', down: '5', left: '4', bomb: '9' },
    { up: 't', right: 'h', down: 'g', left: 'f', bomb: 'y' },
  ];
  return controls[id];
}

const SPAWNS: Coord[] = [
  { x: 0, y: 0 },
  { x: 10, y: 10 },
  { x: 10, y: 0 },
  { x: 0, y: 10 },
];

export function initialPlayers(humanCount: number): Player[] {
  const players: Player[] = [];
  for (let id = 0; id < 4; id++) {
    const spawn = SPAWNS[id];
    const px = spawn.x * TILE_SIZE + TILE_SIZE / 2;
    const py = spawn.y * TILE_SIZE + TILE_SIZE / 2;
    players.push({
      id,
      name: `P${id + 1}`,
      value: (STATUS.PLAYER1 << id) as number,
      human: id < humanCount,
      alive: true,
      px,
      py,
      prevPx: px,
      prevPy: py,
      tileX: spawn.x,
      tileY: spawn.y,
      moving: false,
      animTime: 0,
      pose: 'idle',
      poseTime: 0,
      bombLimit: 1,
      bombsActive: 0,
      power: 1,
      speed: BASE_SPEED,
      controls: playerControls(id),
    });
  }
  return players;
}
