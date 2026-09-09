import { CORE_RULES, type CombatCoreId } from '../data/combatCoreDefinitions';
import type { CombatCoreState, PlayerCommand, WeaponSlot } from './types';

export function createCombatCoreState(): CombatCoreState {
  return {
    relaySlot: null,
    relaySeconds: 0,
    siegeSeconds: 0,
    counterSeconds: 0,
  };
}
const countdown = (seconds: number, delta: number) =>
  seconds - delta <= 1e-9 ? 0 : seconds - delta;

// Called only by the fixed simulation step: menus and pause consume no time.
export function advanceCombatCore(
  coreId: CombatCoreId | undefined,
  core: CombatCoreState,
  command: PlayerCommand,
  position: number,
  velocity: number,
  deltaSeconds: number,
): CombatCoreState {
  if (!coreId) return core;
  const relaySeconds = countdown(core.relaySeconds, deltaSeconds);
  const canDeploy =
    coreId === 'siege' &&
    command.move === 0 &&
    Math.abs(velocity) < 0.001 &&
    position >= CORE_RULES.siege.minimumPosition;
  const deployment = canDeploy ? core.siegeSeconds + deltaSeconds : 0;
  const simultaneous = command.firePrimary && command.fireSecondary;
  return {
    relaySlot: relaySeconds > 0 && !simultaneous ? core.relaySlot : null,
    relaySeconds: simultaneous ? 0 : relaySeconds,
    siegeSeconds:
      deployment >= CORE_RULES.siege.deploySeconds - 1e-9
        ? CORE_RULES.siege.deploySeconds
        : deployment,
    counterSeconds: countdown(core.counterSeconds, deltaSeconds),
  };
}
interface CoreShot {
  core: CombatCoreState;
  damageMultiplier: number;
  heatMultiplier: number;
  ventSlot?: WeaponSlot;
  ventAmount: number;
}
// This is a proposal. The caller commits it ONLY when a whole volley fires.
// Cooldown, overheat and insufficient resources never consume a stored shot.
export function prepareCoreShot(
  coreId: CombatCoreId | undefined,
  core: CombatCoreState,
  slot: WeaponSlot,
  simultaneous: boolean,
): CoreShot {
  const base: CoreShot = {
    core,
    damageMultiplier: 1,
    heatMultiplier: 1,
    ventAmount: 0,
  };
  if (coreId === 'relay' && !simultaneous) {
    const linked =
      core.relaySeconds > 0 &&
      core.relaySlot !== null &&
      core.relaySlot !== slot;
    return {
      ...base,
      core: {
        ...core,
        relaySlot: slot,
        relaySeconds: CORE_RULES.relay.windowSeconds,
      },
      damageMultiplier: linked ? CORE_RULES.relay.damageMultiplier : 1,
      ...(linked ? { ventSlot: core.relaySlot! } : {}),
      ventAmount: linked ? CORE_RULES.relay.heatVent : 0,
    };
  }
  if (coreId === 'siege' && core.siegeSeconds >= CORE_RULES.siege.deploySeconds)
    return {
      ...base,
      damageMultiplier: CORE_RULES.siege.damageMultiplier,
      heatMultiplier: CORE_RULES.siege.heatMultiplier,
    };
  if (coreId === 'counter' && core.counterSeconds > 0)
    return {
      ...base,
      core: { ...core, counterSeconds: 0 },
      damageMultiplier: CORE_RULES.counter.damageMultiplier,
    };
  return base;
}
export function chargeCounterCore(
  coreId: CombatCoreId | undefined,
  core: CombatCoreState,
  successfulParry: boolean,
): CombatCoreState {
  return coreId === 'counter' && successfulParry
    ? { ...core, counterSeconds: CORE_RULES.counter.windowSeconds }
    : core;
}
export function getCoreStatus(
  coreId: CombatCoreId,
  core: CombatCoreState,
  position: number,
): { ready: boolean; label: string; value: number; max: number } {
  if (coreId === 'relay') {
    const ready = core.relaySlot !== null && core.relaySeconds > 0;
    return {
      ready,
      label: ready
        ? `次は${core.relaySlot === 'primary' ? '副' : '主'}武器 ×1.6`
        : '片方ずつ交互に射撃',
      value: core.relaySeconds,
      max: CORE_RULES.relay.windowSeconds,
    };
  }
  if (coreId === 'siege') {
    const ready = core.siegeSeconds >= CORE_RULES.siege.deploySeconds;
    return {
      ready,
      label: ready
        ? '展開中 ×1.5 / 発熱−30%'
        : position < CORE_RULES.siege.minimumPosition
          ? '25m以降で停止して展開'
          : '停止1.5秒で展開',
      value: core.siegeSeconds,
      max: CORE_RULES.siege.deploySeconds,
    };
  }
  return {
    ready: core.counterSeconds > 0,
    label:
      core.counterSeconds > 0
        ? `反攻弾 ×2.5 残り${core.counterSeconds.toFixed(1)}秒`
        : 'パリィ成功で反攻弾',
    value: core.counterSeconds,
    max: CORE_RULES.counter.windowSeconds,
  };
}
