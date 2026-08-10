import { describe, expect, it } from 'vitest';
import { MAX_ACTIVE_EFFECTS, MAX_RECYCLED_EFFECTS } from './GameRenderer';

describe('renderer budgets', () => {
  it('caps active and recycled effect pools', () => {
    expect(MAX_ACTIVE_EFFECTS).toBe(96);
    expect(MAX_RECYCLED_EFFECTS).toBe(96);
  });
});
