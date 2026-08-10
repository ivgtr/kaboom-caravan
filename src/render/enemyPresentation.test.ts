import { describe, expect, it } from 'vitest';
import { getEnemyEntryX } from './enemyPresentation';

describe('enemy presentation entry', () => {
  it('starts beyond the right edge and converges to the simulation position', () => {
    const viewportWidth = 844;
    const spriteSize = 120;
    const targetX = 640;

    const start = getEnemyEntryX(targetX, viewportWidth, spriteSize, 0);
    const middle = getEnemyEntryX(targetX, viewportWidth, spriteSize, 0.4);
    const end = getEnemyEntryX(targetX, viewportWidth, spriteSize, 0.8);

    expect(start - spriteSize / 2).toBeGreaterThan(viewportWidth);
    expect(middle).toBeLessThan(start);
    expect(middle).toBeGreaterThan(targetX);
    expect(end).toBe(targetX);
  });

  it('stays synchronized after the entrance completes', () => {
    expect(getEnemyEntryX(720, 1184, 180, 4)).toBe(720);
  });
});
