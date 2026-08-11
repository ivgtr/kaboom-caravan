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
      displayName: 'ELITE AMBUSH',
      description: '強化Monster。Treasure Drop確率とReward品質が上昇。',
      accent: 'coral',
    },
    {
      id: `route-${encounterIndex}-repair`,
      type: 'repair',
      displayName: 'REPAIR GARAGE',
      description: '次戦前に耐久を30回復する。',
      accent: 'mint',
    },
    {
      id: `route-${encounterIndex}-salvage`,
      type: 'salvage',
      displayName: 'SALVAGE CACHE',
      description: 'Treasure +2とReward Rerollを獲得する。',
      accent: 'yellow',
    },
  ];
  return [
    {
      id: `route-${encounterIndex}-normal`,
      type: 'normal',
      displayName: 'HIGHWAY',
      description: '通常の敵構成で次の区画へ進む。',
      accent: 'cyan',
    },
    alternatives[Math.floor(encounterIndex / 3) % alternatives.length]!,
  ];
}
