export class SeededRng {
    state;
    constructor(seed = Date.now()) {
        this.state = seed >>> 0;
    }
    nextInt(maxExclusive) {
        this.state = (1664525 * this.state + 1013904223) >>> 0;
        return Math.floor((this.state / 0xffffffff) * maxExclusive);
    }
}
