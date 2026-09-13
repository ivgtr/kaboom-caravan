export const TROOPS = ['wall', 'buggy', 'mortar', 'titan'] as const;
export type Troop = (typeof TROOPS)[number];
export type Kind =
  Troop | 'grunt' | 'runner' | 'spitter' | 'brute' | 'commander';
export type Side = 'ally' | 'enemy';
export interface Profile {
  name: string;
  role: string;
  cost: number;
  recharge: number;
  hp: number;
  damage: number;
  interval: number;
  range: number;
  minimumRange?: number;
  speed: number;
  radius: number;
  splash: number;
  batch: number;
  art: `assets/${string}`;
}
export const PROFILES: Record<Kind, Profile> = {
  wall: {
    name: 'バリケード',
    role: '安い壁・前衛を補充',
    cost: 35,
    recharge: 1.4,
    hp: 130,
    damage: 8,
    interval: 1.4,
    range: 2,
    speed: 6,
    radius: 1.7,
    splash: 0,
    batch: 1,
    art: 'assets/equipment/mod_armor_v001.png',
  },
  buggy: {
    name: 'ラッシュバギー',
    role: '速射・単体を削る',
    cost: 80,
    recharge: 3,
    hp: 90,
    damage: 23,
    interval: 0.85,
    range: 10,
    speed: 8,
    radius: 1.8,
    splash: 0,
    batch: 1,
    art: 'assets/equipment/wpn_machine_cannon_v001.png',
  },
  mortar: {
    name: 'ドカン砲車',
    role: '範囲砲撃・足元は死角',
    cost: 145,
    recharge: 6,
    hp: 65,
    damage: 48,
    interval: 3.2,
    range: 29,
    minimumRange: 14,
    speed: 3.4,
    radius: 2,
    splash: 9,
    batch: 1,
    art: 'assets/equipment/wpn_rocket_launcher_v001.png',
  },
  titan: {
    name: '鉄くずタイタン',
    role: '高額・戦線ごと押す',
    cost: 300,
    recharge: 16,
    hp: 560,
    damage: 90,
    interval: 2.4,
    range: 5,
    speed: 3.6,
    radius: 3.3,
    splash: 7,
    batch: 1,
    art: 'assets/equipment/mod_magnetic_armor_v001.png',
  },
  grunt: {
    name: 'モスモコ',
    role: '歩兵',
    cost: 16,
    recharge: 0,
    hp: 85,
    damage: 13,
    interval: 1.5,
    range: 2,
    speed: 4.2,
    radius: 1.8,
    splash: 0,
    batch: 1,
    art: 'assets/world/enm_basic_v001.png',
  },
  runner: {
    name: 'ハナツノ',
    role: '突撃',
    cost: 18,
    recharge: 0,
    hp: 62,
    damage: 20,
    interval: 1.1,
    range: 2,
    speed: 8,
    radius: 1.6,
    splash: 0,
    batch: 1,
    art: 'assets/world/enm_rusher_v001.png',
  },
  spitter: {
    name: 'ホウシダケ',
    role: '範囲砲撃',
    cost: 28,
    recharge: 0,
    hp: 95,
    damage: 30,
    interval: 3.4,
    range: 25,
    speed: 2.8,
    radius: 2,
    splash: 7,
    batch: 1,
    art: 'assets/world/enm_artillery_v001.png',
  },
  brute: {
    name: 'ガレキガメ',
    role: '重装',
    cost: 35,
    recharge: 0,
    hp: 280,
    damage: 32,
    interval: 2,
    range: 3,
    speed: 2.8,
    radius: 3,
    splash: 3,
    batch: 1,
    art: 'assets/world/enm_heavy_v001.png',
  },
  commander: {
    name: '守備隊長',
    role: '戦線を吹き飛ばす',
    cost: 100,
    recharge: 0,
    hp: 620,
    damage: 66,
    interval: 3,
    range: 7,
    speed: 2.6,
    radius: 4,
    splash: 12,
    batch: 1,
    art: 'assets/world/enm_kawaii_fortress_v001.png',
  },
};
export const RELICS = {
  swarm: {
    name: '三つ子の量産工場',
    tag: 'SWARM',
    text: '壁が一度に3台出撃。1台の耐久は55%、出撃費は1.2倍、再出撃待ち1.4倍。数で砲車を守れ。',
    art: 'assets/equipment/mod_ammo_box_v001.png',
  },
  siege: {
    name: '超弩級の火薬庫',
    tag: 'SIEGE',
    text: '砲車の威力2.5倍、爆風1.6倍、射程+10。攻撃間隔1.8倍。壁が崩れる前に一発を通せ。',
    art: 'assets/equipment/mod_explosive_magazine_v001.png',
  },
  titan: {
    name: '一機当千の設計図',
    tag: 'TITAN',
    text: 'タイタンの耐久1.8倍、威力1.6倍、費用25%減。他の味方の耐久は70%。巨体に賭けろ。',
    art: 'assets/equipment/mod_magnetic_armor_v001.png',
  },
  volatile: {
    name: '全車・誘爆装甲',
    tag: 'KABOOM',
    text: '味方が倒れると周囲の敵へ爆発。味方耐久は80%。崩壊する前線を地雷原に変えろ。',
    art: 'assets/equipment/wpn_mine_launcher_v001.png',
  },
  salvage: {
    name: '賞金首エンジン',
    tag: 'BOUNTY',
    text: '撃破収入2.5倍、自然収入60%。敵を倒して次の軍団を買う、止まれない経済。',
    art: 'assets/equipment/mod_radar_v001.png',
  },
  drums: {
    name: '暴走パレード',
    tag: 'PACK',
    text: '近くの味方1台につき攻撃速度+12%、最大2.5倍。全車耐久80%。軍団が残るほど加速。',
    art: 'assets/equipment/mod_generator_v001.png',
  },
  glass: {
    name: '散弾バギー',
    tag: 'GLASS',
    text: 'バギーの威力2倍、攻撃が範囲化。耐久は45%。安い壁の後ろにガラスの火力を積め。',
    art: 'assets/equipment/wpn_scatter_cannon_v001.png',
  },
  reactor: {
    name: '禁制の砲撃炉',
    tag: 'CANNON',
    text: '母艦砲の充填2.2倍、自然収入80%。砲撃で敵の溜め攻撃を潰して前線を支えろ。',
    art: 'assets/equipment/mod_capacitor_v001.png',
  },
  ram: {
    name: '片道ロケット隊',
    tag: 'RAM',
    text: '壁の威力6倍。攻撃するたび自身の耐久を25消費。守りの壁を使い捨ての攻城部隊へ。',
    art: 'assets/equipment/wpn_flamethrower_v001.png',
  },
} as const;
export type Relic = keyof typeof RELICS;
export const STAGES = [
  'はじまりの廃道',
  '群れの料金所',
  '胞子の砲台',
  '鉄壁のジャンク港',
  '最後の補給線',
  'カワイイ・フォートレス',
] as const;
export const STEP = 1 / 30;
export const ALLY_BASE_X = 7;
export const ENEMY_BASE_X = 93;
export const BASE_HP = 600;
export const ARMY_LIMIT = 36;
export const ENEMY_LIMIT = 32;
