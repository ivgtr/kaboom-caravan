import type { EnemyTypeId } from './ids';
import { ENEMY_DEFINITIONS } from './enemyDefinitions';
import { MODULE_DEFINITIONS } from './moduleDefinitions';
import { MVP_ENCOUNTERS } from './runDefinitions';
import { WAVE_DEFINITIONS } from './waveDefinitions';
import { WEAPON_DEFINITIONS } from './weaponDefinitions';

export interface ContentRegistryReport {
  valid: boolean;
  errors: string[];
}

export function validateContentRegistry(): ContentRegistryReport {
  const errors: string[] = [];
  const weapons = Object.values(WEAPON_DEFINITIONS);
  const modules = Object.values(MODULE_DEFINITIONS);
  const enemies = Object.values(ENEMY_DEFINITIONS);
  const roleEnemyIds: EnemyTypeId[] = [
    'basic',
    'rusher',
    'heavy',
    'artillery',
    'bomber',
  ];

  if (weapons.length !== 6) errors.push(`武器数: ${weapons.length}/6`);
  if (modules.length !== 10) errors.push(`Module数: ${modules.length}/10`);
  if (!roleEnemyIds.every((id) => ENEMY_DEFINITIONS[id])) {
    errors.push('5種の通常敵ロールが不足しています');
  }
  if (enemies.length !== 6 || !ENEMY_DEFINITIONS['kawaii-fortress']) {
    errors.push('通常敵5種とBoss 1種の構成ではありません');
  }
  if (MVP_ENCOUNTERS.length !== 10) {
    errors.push(`戦闘数: ${MVP_ENCOUNTERS.length}/10`);
  }

  const waveIds = MVP_ENCOUNTERS.map((encounter) => encounter.waveId);
  if (new Set(waveIds).size !== 10) {
    errors.push('各戦闘に固有のWaveが割り当てられていません');
  }
  for (const encounter of MVP_ENCOUNTERS) {
    if (!WAVE_DEFINITIONS[encounter.waveId]) {
      errors.push(`${encounter.id}: Wave参照が無効です`);
    }
  }
  for (const wave of Object.values(WAVE_DEFINITIONS)) {
    if (wave.id === undefined || WAVE_DEFINITIONS[wave.id] !== wave) {
      errors.push('WaveのRegistry keyとidが一致しません');
    }
    for (const spawn of wave.spawns) {
      if (!ENEMY_DEFINITIONS[spawn.enemyTypeId]) {
        errors.push(`${wave.id}: 敵参照が無効です`);
      }
    }
  }

  for (const definition of [...weapons, ...modules, ...enemies]) {
    if (!definition.assetId.trim()) {
      errors.push(`${definition.id}: assetIdが空です`);
    }
  }

  return { valid: errors.length === 0, errors };
}
