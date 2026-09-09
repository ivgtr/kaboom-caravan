export const COMBAT_CORE_IDS = ['relay', 'siege', 'counter'] as const;
export type CombatCoreId = (typeof COMBAT_CORE_IDS)[number];
export const CORE_RULES = {
  relay: { windowSeconds: 2.5, damageMultiplier: 1.6, heatVent: 18 },
  siege: {
    minimumPosition: 25,
    deploySeconds: 1.5,
    damageMultiplier: 1.5,
    heatMultiplier: 0.7,
  },
  counter: { windowSeconds: 3, damageMultiplier: 2.5 },
} as const;
interface CombatCoreDefinition {
  id: CombatCoreId;
  displayName: string;
  style: string;
  sequence: string;
  description: string;
  tradeoff: string;
  equipmentHint: string;
}
export const COMBAT_CORE_DEFINITIONS: Readonly<
  Record<CombatCoreId, CombatCoreDefinition>
> = {
  relay: {
    id: 'relay',
    displayName: '連携機関',
    style: '主副を切り替えて攻める',
    sequence: '主武器 → 副武器 → 主武器',
    description:
      '2.5秒以内に主副を切り替えて撃つと、その斉射の威力が1.6倍。直前の武器の熱を18下げる。',
    tradeoff: '片方ずつ撃つ。同時押しは連携を解除する。',
    equipmentHint: '大型弾薬庫・追加発電機で交互射撃を支える。',
  },
  siege: {
    id: 'siege',
    displayName: '展開砲座',
    style: '前線で足を止めて撃ち抜く',
    sequence: '25mへ前進 → 停止1.5秒 → 砲撃',
    description:
      '25m以降で1.5秒静止すると展開。斉射の威力が1.5倍、発熱が30%減る。',
    tradeoff: '移動操作・惰性移動・25m未満で展開を解除。無敵にはならない。',
    equipmentHint: '戦術レーダー・追加装甲で陣地を維持する。',
  },
  counter: {
    id: 'counter',
    displayName: '反攻蓄電器',
    style: '迎撃から重い一撃を返す',
    sequence: 'パリィ成功 → 3秒以内に斉射',
    description: 'パリィ成功で反攻弾を1回分装填。次の斉射の威力が2.5倍になる。',
    tradeoff:
      '3秒で失効。重複せず、同時射撃は主武器優先。弾薬・電力は通常消費。',
    equipmentHint: 'レールガン・ロケット砲の重い一撃に合わせる。',
  },
};
export function isCombatCoreId(value: string): value is CombatCoreId {
  return (COMBAT_CORE_IDS as readonly string[]).includes(value);
}
