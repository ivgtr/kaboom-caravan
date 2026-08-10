import { describe, expect, it } from 'vitest';
import { MVP_ENCOUNTERS } from './runDefinitions';
import { validateContentRegistry } from './contentRegistry';
import { WEAPON_DEFINITIONS } from './weaponDefinitions';
import { MODULE_DEFINITIONS } from './moduleDefinitions';

describe('MVP content registry', () => {
  it('contains the complete and internally consistent MVP content set', () => {
    expect(Object.keys(WEAPON_DEFINITIONS)).toHaveLength(6);
    expect(Object.keys(MODULE_DEFINITIONS)).toHaveLength(10);
    expect(MVP_ENCOUNTERS).toHaveLength(10);
    expect(new Set(MVP_ENCOUNTERS.map(({ waveId }) => waveId)).size).toBe(10);

    expect(validateContentRegistry()).toEqual({ valid: true, errors: [] });
  });
});
