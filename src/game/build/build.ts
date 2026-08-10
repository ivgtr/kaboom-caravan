import { MODULE_DEFINITIONS } from '../data/moduleDefinitions';
import type { ModuleId } from '../data/ids';
import type { BuildState } from '../simulation/types';

export const MODULE_SLOT_COUNT = 4;

export interface BuildValidation {
  valid: boolean;
  errors: string[];
}

export function validateBuild(build: BuildState): BuildValidation {
  const errors: string[] = [];
  if (build.moduleIds.length > MODULE_SLOT_COUNT) {
    errors.push(`Moduleは最大${MODULE_SLOT_COUNT}個です。`);
  }
  if (new Set(build.moduleIds).size !== build.moduleIds.length) {
    errors.push('同じModuleは重複装備できません。');
  }
  for (const moduleId of build.moduleIds) {
    if (!MODULE_DEFINITIONS[moduleId]) {
      errors.push(`未登録のModuleです: ${moduleId}`);
    }
  }
  return { valid: errors.length === 0, errors };
}

export function equipModule(build: BuildState, moduleId: ModuleId): BuildState {
  const candidate = { ...build, moduleIds: [...build.moduleIds, moduleId] };
  const validation = validateBuild(candidate);
  if (!validation.valid) throw new Error(validation.errors.join(' '));
  return candidate;
}
