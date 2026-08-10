import type { EnemyBehaviorId, EnemyTypeId } from './ids';

export interface EnemyDefinition {
  id: EnemyTypeId;
  displayName: string;
  description: string;
  behaviorId: EnemyBehaviorId;
  hitPoints: number;
  armor: number;
  speed: number;
  radius: number;
  contactDamage: number;
  attackRange: number;
  attackDamage: number;
  attackCooldownSeconds: number;
  frontlinePressure: number;
  assetId: string;
}

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyTypeId, EnemyDefinition>> =
  {
    basic: {
      id: 'basic',
      displayName: '一般兵',
      description: '数で前線へ圧力をかける標準敵。',
      behaviorId: 'advance',
      hitPoints: 30,
      armor: 0,
      speed: 1.5,
      radius: 1.5,
      contactDamage: 8,
      attackRange: 0,
      attackDamage: 0,
      attackCooldownSeconds: 1,
      frontlinePressure: 1,
      assetId: 'enm_basic',
    },
    rusher: {
      id: 'rusher',
      displayName: '高速兵',
      description: '高速で防衛線を突破する優先撃破対象。',
      behaviorId: 'rush',
      hitPoints: 20,
      armor: 0,
      speed: 4.5,
      radius: 1.2,
      contactDamage: 12,
      attackRange: 0,
      attackDamage: 0,
      attackCooldownSeconds: 0.8,
      frontlinePressure: 1.4,
      assetId: 'enm_rusher',
    },
    heavy: {
      id: 'heavy',
      displayName: '重装兵',
      description: '高耐久と装甲で火力を要求する。',
      behaviorId: 'heavyAdvance',
      hitPoints: 85,
      armor: 4,
      speed: 0.8,
      radius: 2.1,
      contactDamage: 16,
      attackRange: 0,
      attackDamage: 0,
      attackCooldownSeconds: 1.3,
      frontlinePressure: 1.8,
      assetId: 'enm_heavy',
    },
    artillery: {
      id: 'artillery',
      displayName: '遠距離兵',
      description: '遠距離から砲撃し、プレイヤーへ前進を要求する。',
      behaviorId: 'stopAndShoot',
      hitPoints: 38,
      armor: 1,
      speed: 1,
      radius: 1.7,
      contactDamage: 5,
      attackRange: 44,
      attackDamage: 9,
      attackCooldownSeconds: 2.4,
      frontlinePressure: 1.2,
      assetId: 'enm_artillery',
    },
    bomber: {
      id: 'bomber',
      displayName: '自爆兵',
      description: '接近を許すと自爆して大ダメージを与える。',
      behaviorId: 'suicideRush',
      hitPoints: 16,
      armor: 0,
      speed: 5.2,
      radius: 1,
      contactDamage: 30,
      attackRange: 0,
      attackDamage: 0,
      attackCooldownSeconds: 99,
      frontlinePressure: 1.5,
      assetId: 'enm_bomber',
    },
    'kawaii-fortress': {
      id: 'kawaii-fortress',
      displayName: 'カワイイ・フォートレス',
      description: '砲撃、増援、突撃の3Phaseを持つ巨大移動要塞。',
      behaviorId: 'bossFortress',
      hitPoints: 420,
      armor: 5,
      speed: 0.45,
      radius: 5,
      contactDamage: 24,
      attackRange: 52,
      attackDamage: 14,
      attackCooldownSeconds: 2.8,
      frontlinePressure: 4,
      assetId: 'boss_kawaii_fortress',
    },
  };
