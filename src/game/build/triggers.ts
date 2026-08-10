import { MODULE_DEFINITIONS } from '../data/moduleDefinitions';
import type { BuildState } from '../simulation/types';
import type { BuildTrigger, TriggerEffect, TriggerSignal } from './types';

export interface TriggerResources {
  ammo: number;
  energy: number;
  heat: number;
  hitPoints: number;
}

export interface TriggerResourceMaximums {
  ammo: number;
  energy: number;
  heat: number;
  hitPoints: number;
}

export interface TriggerRunResult {
  resources: TriggerResources;
  processedSignals: number;
  overflowed: boolean;
}

const DEFAULT_MAXIMUM_TRIGGER_SIGNALS = 32;

function applyEffect(
  effect: TriggerEffect,
  resources: TriggerResources,
  maximums: TriggerResourceMaximums,
  queue: TriggerSignal[],
): TriggerResources {
  if (effect.type === 'emitTrigger') {
    queue.push({ type: effect.trigger });
    return resources;
  }

  const resource = effect.resource;
  return {
    ...resources,
    [resource]: Math.min(
      maximums[resource],
      Math.max(0, resources[resource] + effect.amount),
    ),
  };
}

export function runTriggerQueue(
  signals: readonly TriggerSignal[],
  triggers: readonly BuildTrigger[],
  initialResources: TriggerResources,
  maximums: TriggerResourceMaximums,
  maximumSignals = DEFAULT_MAXIMUM_TRIGGER_SIGNALS,
): TriggerRunResult {
  const queue = [...signals];
  let resources = initialResources;
  let processedSignals = 0;

  while (queue.length > 0 && processedSignals < maximumSignals) {
    const signal = queue.shift()!;
    processedSignals += 1;
    for (const trigger of triggers) {
      if (trigger.event !== signal.type) continue;
      if (
        trigger.requiredWeaponTag &&
        !signal.weaponTags?.includes(trigger.requiredWeaponTag)
      ) {
        continue;
      }
      for (const effect of trigger.effects) {
        resources = applyEffect(effect, resources, maximums, queue);
      }
    }
  }

  return {
    resources,
    processedSignals,
    overflowed: queue.length > 0,
  };
}

export function runBuildTriggers(
  build: BuildState,
  signals: readonly TriggerSignal[],
  initialResources: TriggerResources,
  maximums: TriggerResourceMaximums,
): TriggerRunResult {
  const triggers = build.moduleIds.flatMap(
    (moduleId) => MODULE_DEFINITIONS[moduleId].triggers,
  );
  return runTriggerQueue(signals, triggers, initialResources, maximums);
}
