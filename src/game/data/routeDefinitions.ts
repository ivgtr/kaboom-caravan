export type RouteType = 'normal' | 'elite' | 'repair' | 'salvage';

export interface RouteChoice {
  id: string;
  type: RouteType;
  displayName: string;
  description: string;
  accent: 'mint' | 'coral' | 'yellow' | 'cyan';
}

export function createRouteChoices(encounterIndex: number): RouteChoice[] {
  const alternatives: RouteChoice[] = [
    {
      id: `route-${encounterIndex}-elite`,
      type: 'elite',
      displayName: '強敵の待ち伏せ',
      description: '手強い敵が出現。お宝の獲得量と戦利品の品質が上がる。',
      accent: 'coral',
    },
    {
      id: `route-${encounterIndex}-repair`,
      type: 'repair',
      displayName: '出張整備所',
      description: '次戦前に耐久を30回復する。',
      accent: 'mint',
    },
    {
      id: `route-${encounterIndex}-salvage`,
      type: 'salvage',
      displayName: '秘密の物資庫',
      description: 'お宝を2個回収し、戦利品を1回引き直せる。',
      accent: 'yellow',
    },
  ];
  return [
    {
      id: `route-${encounterIndex}-normal`,
      type: 'normal',
      displayName: '街道を進む',
      description: '通常の敵構成で次の区画へ進む。',
      accent: 'cyan',
    },
    alternatives[Math.floor(encounterIndex / 3) % alternatives.length]!,
  ];
}
