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
  attackWindupSeconds: number;
  attackCooldownSeconds: number;
  frontlinePressure: number;
  assetId: string;
}

export const ENEMY_DEFINITIONS: Readonly<Record<EnemyTypeId, EnemyDefinition>> =
  {
    basic: {
      id: 'basic',
      displayName: 'モスモコ',
      description: '苔と小石をまとい、群れで前線へ転がり込む標準Monster。',
      behaviorId: 'advance',
      hitPoints: 42,
      armor: 0,
      speed: 5.5,
      radius: 1.5,
      contactDamage: 8,
      attackRange: 0,
      attackDamage: 0,
      attackWindupSeconds: 0.18,
      attackCooldownSeconds: 1,
      frontlinePressure: 1,
      assetId: 'enm_basic',
    },
    rusher: {
      id: 'rusher',
      displayName: 'ハナツノ',
      description: '花角を伏せて高速突進する、優先撃破対象の四足Monster。',
      behaviorId: 'rush',
      hitPoints: 30,
      armor: 0,
      speed: 8,
      radius: 1.2,
      contactDamage: 12,
      attackRange: 0,
      attackDamage: 0,
      attackWindupSeconds: 0.12,
      attackCooldownSeconds: 0.8,
      frontlinePressure: 1.4,
      assetId: 'enm_rusher',
    },
    heavy: {
      id: 'heavy',
      displayName: 'ガレキガメ',
      description: '旧文明の小さな護符を滑らかな甲羅へ宿す、高耐久Monster。',
      behaviorId: 'heavyAdvance',
      hitPoints: 110,
      armor: 4,
      speed: 4,
      radius: 2.1,
      contactDamage: 16,
      attackRange: 0,
      attackDamage: 0,
      attackWindupSeconds: 0.28,
      attackCooldownSeconds: 1.3,
      frontlinePressure: 1.8,
      assetId: 'enm_heavy',
    },
    artillery: {
      id: 'artillery',
      displayName: 'ホウシダケ',
      description: '巨大な傘から胞子弾を放ち、キャラバンへ前進を要求する。',
      behaviorId: 'stopAndShoot',
      hitPoints: 55,
      armor: 1,
      speed: 5.5,
      radius: 1.7,
      contactDamage: 5,
      attackRange: 44,
      attackDamage: 9,
      attackWindupSeconds: 0.42,
      attackCooldownSeconds: 2.4,
      frontlinePressure: 1.2,
      assetId: 'enm_artillery',
    },
    bomber: {
      id: 'bomber',
      displayName: 'バクレツミ',
      description: '熟した爆裂果を抱え、接近すると破裂する小型Monster。',
      behaviorId: 'suicideRush',
      hitPoints: 24,
      armor: 0,
      speed: 8,
      radius: 1,
      contactDamage: 30,
      attackRange: 0,
      attackDamage: 0,
      attackWindupSeconds: 0.24,
      attackCooldownSeconds: 99,
      frontlinePressure: 1.5,
      assetId: 'enm_bomber',
    },
    'kawaii-fortress': {
      id: 'kawaii-fortress',
      displayName: 'カワイイ・フォートレス',
      description:
        '古代Coreを宿し、胞子砲撃・眷属召喚・突進を行う巨大Guardian。',
      behaviorId: 'bossFortress',
      hitPoints: 320,
      armor: 3,
      speed: 2.5,
      radius: 5,
      contactDamage: 24,
      attackRange: 52,
      attackDamage: 14,
      attackWindupSeconds: 0.55,
      attackCooldownSeconds: 2.8,
      frontlinePressure: 4,
      assetId: 'boss_kawaii_fortress',
    },
  };
