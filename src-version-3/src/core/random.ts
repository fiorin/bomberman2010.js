import type { Rng } from './types';

export class SeededRng implements Rng {
  private state: number;

  constructor(seed: number = Date.now()) {
    this.state = seed >>> 0;
  }

  nextInt(maxExclusive: number): number {
    if (maxExclusive <= 0) return 0;
    this.state = (Math.imul(1664525, this.state) + 1013904223) >>> 0;
    return Math.floor((this.state / 0xffffffff) * maxExclusive);
  }
}
