import { BOARD_SIZE, STATUS, type Block, type Controls, type Coord, type Item, type ItemKind, type Player, type Rng, type Tile } from './types';

const DIRECTIONS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 }
];

const RESERVED: Coord[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 },
  { x: 10, y: 10 }, { x: 9, y: 10 }, { x: 10, y: 9 },
  { x: 9, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 1 },
  { x: 0, y: 9 }, { x: 0, y: 10 }, { x: 1, y: 10 }
];

export function createBoard(): Tile[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => ({
      status: 0,
      block: null,
      bomb: null,
      item: null,
      fire: null,
      players: []
    }))
  );
}

export function getDirections() {
  return DIRECTIONS;
}

export function getReserved() {
  return RESERVED;
}

export function createSolidBlock(): Block {
  return { breakable: false, value: STATUS.BLOCK_SOLID, imageX: 9, imageY: 1, breakAnimY: null };
}

export function createBreakableBlock(): Block {
  return { breakable: true, value: STATUS.BLOCK_BREAKABLE, imageX: 9, imageY: 2, breakAnimY: null };
}

export function createItem(kind: ItemKind): Item {
  if (kind === 'moreBomb') return { kind, imageX: 8, imageY: 0 };
  if (kind === 'moreFire') return { kind, imageX: 8, imageY: 4 };
  if (kind === 'moreSpeed') return { kind, imageX: 8, imageY: 2 };
  return { kind, imageX: 8, imageY: 1 };
}

export function randomItem(rng: Rng): Item {
  const roll = rng.nextInt(16);
  if (roll < 6) return createItem('moreBomb');
  if (roll < 12) return createItem('moreFire');
  if (roll < 14) return createItem('moreSpeed');
  return createItem('maxFire');
}

function removeCoordinates(base: Coord[], remove: Coord[]): Coord[] {
  return base.filter((coord) => !remove.some((r) => r.x === coord.x && r.y === coord.y));
}

function refineRandom(coords: Coord[], count: number, rng: Rng): Coord[] {
  const arr = [...coords];
  for (let i = 0; i < count && arr.length > 0; i += 1) {
    const random = rng.nextInt(arr.length);
    const temp = arr[random];
    arr[random] = arr[0];
    arr[0] = temp;
    arr.shift();
  }
  return arr;
}

export function allCoordinates(): Coord[] {
  const coords: Coord[] = [];
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      coords.push({ x, y });
    }
  }
  return coords;
}

export function solidBlockCoords(): Coord[] {
  const coords: Coord[] = [];
  for (let x = 1; x < BOARD_SIZE; x += 2) {
    for (let y = 1; y < BOARD_SIZE; y += 2) {
      coords.push({ x, y });
    }
  }
  return coords;
}

export function breakableBlockCoords(rng: Rng): Coord[] {
  let coords = allCoordinates();
  const solids = solidBlockCoords();
  coords = removeCoordinates(coords, RESERVED);
  coords = removeCoordinates(coords, solids);
  coords = refineRandom(coords, rng.nextInt(30) + 10, rng);
  return coords;
}

export function itemCoords(breakableCoords: Coord[], rng: Rng): Coord[] {
  return refineRandom([...breakableCoords], Math.floor(breakableCoords.length / 2), rng);
}

function playerControls(id: number): Controls {
  if (id === 1) return { up: 'w', right: 'd', down: 's', left: 'a', bomb: 'e' };
  if (id === 2) return { up: 'i', right: 'l', down: 'k', left: 'j', bomb: 'o' };
  if (id === 3) return { up: '8', right: '6', down: '5', left: '4', bomb: '9' };
  return { up: 't', right: 'h', down: 'g', left: 'f', bomb: 'y' };
}

export function initialPlayers(selectedPlayers: number): Player[] {
  const starts = [
    { x: 0, y: 0, value: STATUS.PLAYER1, imageX: 0, name: 'Player1' },
    { x: BOARD_SIZE - 1, y: BOARD_SIZE - 1, value: STATUS.PLAYER2, imageX: 1, name: 'Player2' },
    { x: BOARD_SIZE - 1, y: 0, value: STATUS.PLAYER3, imageX: 2, name: 'Player3' },
    { x: 0, y: BOARD_SIZE - 1, value: STATUS.PLAYER4, imageX: 3, name: 'Player4' }
  ];

  return starts.slice(0, selectedPlayers).map((start, index) => ({
    id: index + 1,
    name: start.name,
    value: start.value,
    alive: true,
    life: 1,
    imageX: start.imageX,
    imageY: 1,
    x: start.x,
    y: start.y,
    controls: playerControls(index + 1),
    bombLimit: 1,
    power: 1,
    speed: 3,
    moveCooldown: 0,
    canMove: true,
    animTick: true
  }));
}