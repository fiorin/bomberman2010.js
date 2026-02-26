import { BOMB_TIMER_TICKS, BOARD_SIZE, MATCH_SECONDS, STATUS } from './types';
import { SeededRng } from './random';
import { breakableBlockCoords, createBoard, createBreakableBlock, createSolidBlock, getDirections, getReserved, initialPlayers, itemCoords, randomItem, solidBlockCoords } from './setup';
export class GameEngine {
    state;
    rng;
    constructor(seed) {
        this.rng = new SeededRng(seed);
        this.state = {
            board: createBoard(),
            players: [],
            activeMask: 0,
            selectedPlayers: 2,
            running: false,
            winnerText: '',
            remainingSeconds: MATCH_SECONDS,
            reserved: getReserved()
        };
    }
    selectPlayers(count) {
        this.state.selectedPlayers = Math.max(2, Math.min(4, count));
    }
    start() {
        this.state.board = createBoard();
        this.state.players = initialPlayers(this.state.selectedPlayers);
        this.state.activeMask = this.state.players.reduce((sum, p) => sum + p.value, 0);
        this.state.winnerText = '';
        this.state.remainingSeconds = MATCH_SECONDS;
        this.state.running = true;
        this.placeMapObjects();
        this.placePlayers();
    }
    keyPress(key) {
        if (!this.state.running)
            return;
        const normalized = key.toLowerCase();
        for (const player of this.state.players) {
            if (!player.alive || !player.canMove)
                continue;
            this.moveForKey(player, normalized);
            if (normalized === player.controls.bomb) {
                this.placeBomb(player);
            }
        }
    }
    tick() {
        if (!this.state.running)
            return;
        this.updateTiles();
        for (const player of this.state.players) {
            if (player.moveCooldown > 0)
                player.moveCooldown -= 1;
        }
        this.evaluateWinner();
    }
    secondTick() {
        if (!this.state.running)
            return;
        this.state.remainingSeconds = Math.max(0, this.state.remainingSeconds - 1);
        if (this.state.remainingSeconds === 0) {
            this.state.running = false;
            if (!this.state.winnerText)
                this.state.winnerText = 'EMPATE';
            for (const player of this.state.players) {
                if (player.alive) {
                    player.imageY = 10;
                    player.canMove = false;
                }
            }
        }
    }
    placeMapObjects() {
        const board = this.state.board;
        for (const coord of solidBlockCoords()) {
            const tile = board[coord.x][coord.y];
            tile.block = createSolidBlock();
            tile.status += STATUS.BLOCK_SOLID;
        }
        const breakables = breakableBlockCoords(this.rng);
        for (const coord of breakables) {
            const tile = board[coord.x][coord.y];
            tile.block = createBreakableBlock();
            tile.status += STATUS.BLOCK_BREAKABLE;
        }
        for (const coord of itemCoords(breakables, this.rng)) {
            const tile = board[coord.x][coord.y];
            tile.item = randomItem(this.rng);
            tile.status += STATUS.ITEM;
        }
    }
    placePlayers() {
        for (const player of this.state.players) {
            const tile = this.tile(player.x, player.y);
            tile.players.push(player.id);
            tile.status += player.value;
        }
    }
    moveForKey(player, key) {
        if (player.moveCooldown > 0)
            return;
        if (key === player.controls.up)
            this.move(player, 0, -1);
        if (key === player.controls.right)
            this.move(player, 1, 0);
        if (key === player.controls.down)
            this.move(player, 0, 1);
        if (key === player.controls.left)
            this.move(player, -1, 0);
    }
    move(player, dx, dy) {
        const nx = player.x + dx;
        const ny = player.y + dy;
        if (nx < 0 || ny < 0 || nx >= BOARD_SIZE || ny >= BOARD_SIZE)
            return;
        const target = this.tile(nx, ny);
        if (target.status >= STATUS.BLOCK_SOLID)
            return;
        const current = this.tile(player.x, player.y);
        current.players = current.players.filter((id) => id !== player.id);
        current.status -= player.value;
        player.x = nx;
        player.y = ny;
        player.moveCooldown = player.speed;
        target.players.push(player.id);
        target.status += player.value;
        if (target.item) {
            this.consumeItem(player, target.item);
            target.item = null;
            target.status -= STATUS.ITEM;
        }
    }
    consumeItem(player, item) {
        if (item.kind === 'moreBomb')
            player.bombLimit += 1;
        if (item.kind === 'moreFire')
            player.power = Math.min(10, player.power + 1);
        if (item.kind === 'moreSpeed')
            player.speed = Math.max(1, player.speed - 1);
        if (item.kind === 'maxFire')
            player.power = 10;
    }
    placeBomb(player) {
        const tile = this.tile(player.x, player.y);
        if (tile.bomb || player.bombLimit < 1)
            return;
        tile.bomb = {
            timer: BOMB_TIMER_TICKS,
            ownerId: player.id,
            power: player.power,
            imageX: 7,
            imageY: 0
        };
        tile.status += STATUS.BOMB;
        player.bombLimit -= 1;
    }
    updateTiles() {
        for (let x = 0; x < BOARD_SIZE; x += 1) {
            for (let y = 0; y < BOARD_SIZE; y += 1) {
                const tile = this.tile(x, y);
                if (tile.fire) {
                    if (tile.fire.frame === 1)
                        tile.fire.frame = 2;
                    else if (tile.fire.frame === 2)
                        tile.fire.frame = 3;
                    else
                        tile.fire = null;
                    continue;
                }
                if (tile.block?.breakAnimY === 5)
                    tile.block.breakAnimY = 4;
                else if (tile.block?.breakAnimY === 4)
                    tile.block.breakAnimY = 3;
                else if (tile.block?.breakAnimY === 3) {
                    tile.status -= tile.block.value;
                    tile.block = null;
                }
                if (tile.bomb) {
                    tile.bomb.imageY = ((tile.bomb.imageY + 1) % 4);
                    if (tile.bomb.timer <= 0) {
                        const bomb = tile.bomb;
                        tile.bomb = null;
                        tile.status -= STATUS.BOMB;
                        const owner = this.state.players.find((p) => p.id === bomb.ownerId);
                        if (owner)
                            owner.bombLimit += 1;
                        this.explode(x, y, bomb.power);
                    }
                    else {
                        tile.bomb.timer -= 1;
                    }
                }
            }
        }
    }
    explode(cx, cy, power) {
        this.hitTile(cx, cy, false);
        for (const dir of getDirections()) {
            for (let r = 1; r <= power; r += 1) {
                const x = cx + dir.x * r;
                const y = cy + dir.y * r;
                if (x < 0 || y < 0 || x >= BOARD_SIZE || y >= BOARD_SIZE)
                    break;
                const stop = this.hitTile(x, y, true);
                if (stop)
                    break;
            }
        }
    }
    hitTile(x, y, stopOnBlock) {
        const tile = this.tile(x, y);
        if (tile.players.length === 0) {
            tile.fire = { frame: 1 };
        }
        for (const playerId of tile.players) {
            const player = this.state.players.find((p) => p.id === playerId);
            if (!player || !player.alive)
                continue;
            player.life -= 1;
            if (player.life <= 0) {
                player.alive = false;
                player.canMove = false;
                player.imageY = 5;
                tile.status -= player.value;
                this.state.activeMask -= player.value;
            }
        }
        tile.players = tile.players.filter((playerId) => {
            const player = this.state.players.find((p) => p.id === playerId);
            return Boolean(player?.alive);
        });
        if (tile.block) {
            if (tile.block.breakable) {
                tile.block.breakAnimY = 5;
            }
            return stopOnBlock;
        }
        if (tile.item) {
            tile.item = null;
            tile.status -= STATUS.ITEM;
            tile.fire = { frame: 1 };
        }
        if (tile.bomb) {
            tile.bomb.timer = 0;
        }
        return false;
    }
    evaluateWinner() {
        if (!this.state.running)
            return;
        if (this.state.activeMask === STATUS.PLAYER1)
            this.finish('P1 VENCEU', 1);
        else if (this.state.activeMask === STATUS.PLAYER2)
            this.finish('P2 VENCEU', 2);
        else if (this.state.activeMask === STATUS.PLAYER3)
            this.finish('P3 VENCEU', 3);
        else if (this.state.activeMask === STATUS.PLAYER4)
            this.finish('P4 VENCEU', 4);
        else if (this.state.activeMask === 0)
            this.finish('EMPATE');
    }
    finish(message, winnerId) {
        this.state.running = false;
        this.state.winnerText = message;
        for (const player of this.state.players) {
            player.canMove = false;
            if (winnerId && player.id === winnerId) {
                player.imageY = 8;
            }
            else if (message === 'EMPATE' && player.alive) {
                player.imageY = 10;
            }
        }
    }
    tile(x, y) {
        return this.state.board[x][y];
    }
    formatClock() {
        const minutes = Math.floor(this.state.remainingSeconds / 60);
        const seconds = this.state.remainingSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
}
