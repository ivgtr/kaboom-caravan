export interface RandomSource {
  next(): number;
}

export function createSeededRandom(initialSeed: number): RandomSource {
  let seed = initialSeed >>> 0;

  return {
    next(): number {
      seed = (seed + 0x6d2b79f5) >>> 0;
      let value = seed;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}
