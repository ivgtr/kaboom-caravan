import type { ModuleId } from './ids';
import type { ModuleDefinition } from '../build/types';

export const MODULE_DEFINITIONS: Readonly<Record<ModuleId, ModuleDefinition>> =
  {
    'cooling-fan': {
      id: 'cooling-fan',
      displayName: '大型冷却ファン',
      description: '毎秒の冷却量を増やし、継続射撃を支える。',
      assetId: 'mod_cooling_fan',
      modifiers: [
        {
          target: 'player',
          stat: 'coolingPerSecond',
          operation: 'additive',
          value: 6,
        },
      ],
      triggers: [],
    },
    generator: {
      id: 'generator',
      displayName: '追加発電機',
      description: '毎秒の電力回復量を増やす。',
      assetId: 'mod_generator',
      modifiers: [
        {
          target: 'player',
          stat: 'energyPerSecond',
          operation: 'additive',
          value: 5,
        },
      ],
      triggers: [],
    },
    'ammo-box': {
      id: 'ammo-box',
      displayName: '大型弾薬庫',
      description: '最大弾薬を増やす。',
      assetId: 'mod_ammo_box',
      modifiers: [
        {
          target: 'player',
          stat: 'maximumAmmo',
          operation: 'additive',
          value: 12,
        },
      ],
      triggers: [],
    },
    armor: {
      id: 'armor',
      displayName: '追加装甲',
      description: '被ダメージを安定して軽減する。',
      assetId: 'mod_armor',
      modifiers: [
        {
          target: 'player',
          stat: 'armor',
          operation: 'additive',
          value: 3,
        },
      ],
      triggers: [],
    },
    'shield-generator': {
      id: 'shield-generator',
      displayName: 'シールド発生器',
      description: '最大耐久を増やすが、電力回復を少し低下させる。',
      assetId: 'mod_shield_generator',
      modifiers: [
        {
          target: 'player',
          stat: 'maximumHitPoints',
          operation: 'additive',
          value: 25,
        },
        {
          target: 'player',
          stat: 'energyPerSecond',
          operation: 'additive',
          value: -2,
        },
      ],
      triggers: [],
    },
    radar: {
      id: 'radar',
      displayName: '戦術レーダー',
      description: 'すべての武器射程を拡張する。',
      assetId: 'mod_radar',
      modifiers: [
        {
          target: 'weapon',
          stat: 'maximumRange',
          operation: 'multiplicative',
          value: 1.2,
        },
      ],
      triggers: [],
    },
    'heat-recycler': {
      id: 'heat-recycler',
      displayName: '廃熱回収炉',
      description: 'Overheat発生時に電力を25回復する。',
      assetId: 'mod_heat_recycler',
      modifiers: [],
      triggers: [
        {
          sourceId: 'heat-recycler',
          event: 'onOverheat',
          effects: [{ type: 'addResource', resource: 'energy', amount: 25 }],
        },
      ],
    },
    capacitor: {
      id: 'capacitor',
      displayName: '違法コンデンサ',
      description: '電力が空になった瞬間に電力を20回復する。',
      assetId: 'mod_capacitor',
      modifiers: [],
      triggers: [
        {
          sourceId: 'capacitor',
          event: 'onEnergyEmpty',
          effects: [{ type: 'addResource', resource: 'energy', amount: 20 }],
        },
      ],
    },
    'magnetic-armor': {
      id: 'magnetic-armor',
      displayName: '磁気装甲',
      description: '被弾時に弾薬を1回収する。',
      assetId: 'mod_magnetic_armor',
      modifiers: [],
      triggers: [
        {
          sourceId: 'magnetic-armor',
          event: 'onDamage',
          effects: [{ type: 'addResource', resource: 'ammo', amount: 1 }],
        },
      ],
    },
    'explosive-magazine': {
      id: 'explosive-magazine',
      displayName: '爆薬庫',
      description: '爆発武器のDamageを40%増やすが、装甲が1低下する。',
      assetId: 'mod_explosive_magazine',
      modifiers: [
        {
          target: 'weapon',
          stat: 'damage',
          requiredTag: 'explosive',
          operation: 'multiplicative',
          value: 1.4,
        },
        {
          target: 'player',
          stat: 'armor',
          operation: 'additive',
          value: -1,
        },
      ],
      triggers: [],
    },
  };
