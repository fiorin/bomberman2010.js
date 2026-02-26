import { BOARD_SIZE, TILE_SIZE } from '../core/types';
export class CanvasRenderer {
    canvas;
    ctx;
    sprite;
    constructor(canvas) {
        this.canvas = canvas;
        const context = canvas.getContext('2d');
        if (!context) {
            throw new Error('Canvas 2D context unavailable');
        }
        this.ctx = context;
        this.sprite = new Image();
        this.sprite.src = '/resource/sprite.png';
    }
    ready() {
        if (this.sprite.complete)
            return Promise.resolve();
        return new Promise((resolve) => {
            this.sprite.onload = () => resolve();
        });
    }
    draw(engine) {
        const { board, players } = engine.state;
        for (let x = 0; x < BOARD_SIZE; x += 1) {
            for (let y = 0; y < BOARD_SIZE; y += 1) {
                this.blit(9, 0, x, y);
                const tile = board[x][y];
                if (tile.fire) {
                    this.blit(6, tile.fire.frame, x, y);
                    continue;
                }
                if (tile.item)
                    this.blit(tile.item.imageX, tile.item.imageY, x, y);
                if (tile.block) {
                    const blockY = tile.block.breakAnimY ?? tile.block.imageY;
                    this.blit(tile.block.imageX, blockY, x, y);
                }
                if (tile.bomb)
                    this.blit(tile.bomb.imageX, tile.bomb.imageY, x, y);
                for (const playerId of tile.players) {
                    const player = players.find((p) => p.id === playerId);
                    if (player)
                        this.blit(player.imageX, player.imageY, player.x, player.y);
                }
            }
        }
    }
    blit(spriteX, spriteY, tileX, tileY) {
        this.ctx.drawImage(this.sprite, spriteX * TILE_SIZE, spriteY * TILE_SIZE, TILE_SIZE, TILE_SIZE, tileX * TILE_SIZE, tileY * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    }
}
