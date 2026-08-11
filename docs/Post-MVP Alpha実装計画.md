# Kaboom Caravan Post-MVP Alpha実装計画

- Date: 2026-08-11
- Status: 実装・自動検証完了、手動バランス確認待ち
- Goal: 1ラン終了後に、別の初期Build・進行先・Weapon強化を試す理由を作る
- Baseline: MVPの10戦、決定論的Simulation、Combat／Reward／Result分離を維持する

## 1. Alpha Scope

### Weapon成長

- 装備中WeaponもReward候補へ戻す
- 同一Weapon取得時はslot選択を行わずLv.を上げる
- Lv.1〜3とし、最大Lv.は候補から除外する
- Lv.でDamage、Cooldown、RangeとWeapon固有挙動を強化する
- Rare／Epic Weaponは取得時のLv.上昇量を増やす

### Treasure Drop

- Enemy撃破時にSeedとEnemy IDからDropを決定する
- 地面へ落下したTreasureはCaravan接近時に吸着・回収する
- 未回収品はBattle Clear時に50%相当で回収する
- Treasure量はReward RarityとReroll獲得数へ反映する
- EliteとBossはTreasureを確定Dropする

### Route

- Battle 4、7、10の直前に2択を表示する
- Highway: 通常戦
- Elite: HP／Damage／Pressure強化、Treasure確定
- Repair: 次戦前にHP回復
- Salvage: TreasureとRerollを獲得

### Initial Loadout

- Standard: Machine Cannon／Scatter Cannon
- Close Range: Scatter Cannon／Flamethrower
- Explosive: Rocket Launcher／Mine Launcher
- ExplosiveはVictoryまたはTreasure累計15で解禁する

### Meta Progression／Result

- Version付きLocal Storageへ保存する
- 永続的な数値強化は行わない
- Run数、Treasure累計、Best Time、直近10Runを保存する
- Resultへ討伐数、Parry、Damage、Treasure、Best Timeを表示する

### Audio

- Browser入力後にAudioContextを解禁する
- Fire、Hit、Kill、Treasure、Parry、Victory／DefeatへSFXを割り当てる
- Combat中だけ低音量の機械的Ambientを再生する
- 常時Mute切替を提供する

## 2. Responsibility

- Simulation: Weapon Lv.、Loot Entity、Elite補正、決定論
- Session: Garage、Route、Reward、Reroll、Run戦績
- Progression: Save Migration、Unlock、History
- Presentation: Loot、Elite Aura、Garage／Route／Result UI、Audio

## 3. Acceptance

- 同一Weapon選択で装着先確認を挟まずLv.が上がる
- Lv.3でWeapon固有挙動が変わる
- EnemyからTreasureが見える形でDropし、Caravanへ吸着する
- Treasure 3以上でReroll、5以上で追加Rerollを得る
- 3回のRoute選択が1ランへ反映される
- 3つのInitial Loadoutがあり、ExplosiveはUnlock条件を持つ
- Resultと再起動後にBest／Unlockが維持される
- Audioをユーザー操作で開始・停止できる
- Fixed Seed、Unit、E2E、Performance Gateを維持する

## 4. Verification

- `npm run check`: lint、81 Unit Test、TypeScript Build、Formatを実行
- `npm run test:e2e`: Desktop／Mobile Landscapeを含むUI・操作回帰を実行
- Fixed Seed `1 / 42 / 2026`: 通常ルート選択時の10戦完走と最終Buildを固定
- 追加の手動確認対象: Elite難易度、Treasure吸着の気持ちよさ、Audio音量バランス、3初期Buildの勝率差
