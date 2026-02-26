import type { Rng } from './types';

export class SeededRng implements Rng {
  private state: number;

  constructor(seed = Date.now()) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive: number): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return Math.floor((this.state / 0xffffffff) * maxExclusive);
  }
}