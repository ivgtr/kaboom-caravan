import { describe, expect, it } from 'vitest';
import { BOSS_PHASE_AURA_ART, getBossPhaseAuraSource } from './bossPhaseAssets';

describe('boss phase aura assets', () => {
  it('maps all three phases to ordered square cells', () => {
    const phaseOne = getBossPhaseAuraSource(1200, 900, 1);
    const phaseTwo = getBossPhaseAuraSource(1200, 900, 2);
    const phaseThree = getBossPhaseAuraSource(1200, 900, 3);
    expect(phaseOne).toEqual([0, 250, 400, 400]);
    expect(phaseTwo).toEqual([400, 250, 400, 400]);
    expect(phaseThree).toEqual([800, 250, 400, 400]);
  });

  it('increases scale, alpha and rotation speed by phase', () => {
    expect(BOSS_PHASE_AURA_ART.scaleByPhase[1]).toBeLessThan(
      BOSS_PHASE_AURA_ART.scaleByPhase[2],
    );
    expect(BOSS_PHASE_AURA_ART.scaleByPhase[2]).toBeLessThan(
      BOSS_PHASE_AURA_ART.scaleByPhase[3],
    );
    expect(BOSS_PHASE_AURA_ART.alphaByPhase[1]).toBeLessThan(
      BOSS_PHASE_AURA_ART.alphaByPhase[3],
    );
    expect(BOSS_PHASE_AURA_ART.rotationSpeedByPhase[1]).toBeLessThan(
      BOSS_PHASE_AURA_ART.rotationSpeedByPhase[3],
    );
  });
});
