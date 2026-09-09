import type { EnemyTypeId } from './ids';

export type RouteType = 'normal' | 'elite' | 'repair' | 'salvage';
export type BattlefieldObjectiveKind = 'repair' | 'salvage';

export interface BattlefieldObjectiveDefinition {
  displayName: string;
  position: number;
  radius: number;
  holdSeconds: number;
  deadlineSeconds: number;
  repair: number;
  treasure: number;
  guards: readonly EnemyTypeId[];
  reward: string;
}

export const BATTLEFIELD_OBJECTIVES: Readonly<
  Record<BattlefieldObjectiveKind, BattlefieldObjectiveDefinition>
> = {
  repair: {
    displayName: '整備拠点',
    position: 45,
    radius: 8,
    holdSeconds: 3,
    deadlineSeconds: 18,
    repair: 40,
    treasure: 0,
    guards: ['rusher'],
    reward: '耐久を40回復（最大耐久まで）',
  },
  salvage: {
    displayName: '物資拠点',
    position: 65,
    radius: 8,
    holdSeconds: 4,
    deadlineSeconds: 20,
    repair: 0,
    treasure: 2,
    guards: ['heavy', 'artillery'],
    reward: '武器箱1個（3択）＋お宝2個',
  },
};

export interface RouteChoice {
  id: string;
  type: RouteType;
  displayName: string;
  description: string;
  risk: string;
  reward: string;
  accent: 'mint' | 'coral' | 'yellow' | 'cyan';
}

export function objectiveInstructions(kind: BattlefieldObjectiveKind): string {
  const objective = BATTLEFIELD_OBJECTIVES[kind];
  return `${objective.deadlineSeconds}秒以内に${objective.position - objective.radius}〜${objective.position + objective.radius}mを累計${objective.holdSeconds}秒確保。範囲内に敵がいる間は進まない。`;
}

export function createRouteChoices(encounterIndex: number): RouteChoice[] {
  const choices: Omit<RouteChoice, 'id'>[] = [
    {
      type: 'normal',
      displayName: '街道を進む',
      description: '寄り道をせず、通常の敵部隊を突破する。',
      risk: '追加の敵・回収期限なし',
      reward: '通常の戦利品',
      accent: 'cyan',
    },
    {
      type: 'elite',
      displayName: '強敵の待ち伏せ',
      description: '強化された敵部隊に挑み、戦利品の品質を狙う。',
      risk: '敵の耐久1.45倍・攻撃1.2倍・前線圧力1.25倍',
      reward: '補給品のドロップ率と戦利品の品質が上昇',
      accent: 'coral',
    },
    {
      type: 'repair',
      displayName: '出張整備所',
      description: objectiveInstructions('repair'),
      risk: 'ハナツノ1体が追加。選ぶだけでは回復しない',
      reward: BATTLEFIELD_OBJECTIVES.repair.reward,
      accent: 'mint',
    },
    {
      type: 'salvage',
      displayName: '秘密の物資庫',
      description: objectiveInstructions('salvage'),
      risk: 'ガレキガメ・ホウシダケ各1体が追加',
      reward: BATTLEFIELD_OBJECTIVES.salvage.reward,
      accent: 'yellow',
    },
  ];
  // The final battle has no subsequent equipment/quality reward to chase.
  return choices
    .filter(
      ({ type }) =>
        encounterIndex !== 9 || type === 'normal' || type === 'repair',
    )
    .map((choice) => ({
      ...choice,
      id: `route-${encounterIndex}-${choice.type}`,
    }));
}
