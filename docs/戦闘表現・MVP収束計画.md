# Kaboom Caravan 戦闘表現・MVP収束計画

- Status: Planned
- Version: 1.0
- Date: 2026-08-11
- Scope: Enemy Attack Readability / Hit / Death / Quality / Balance Gate
- Related:
  [MVP実装計画](実装計画書.md)、
  [2D Animation実装計画](アニメーション実装計画.md)、
  [MVP手動プレイテスト](playtest/mvp-readiness.md)、
  [2DレイヤーADR](adr/0003-2d-layered-presentation.md)

## 1. 目的

MVPの機能実装と主要Visual統合は完了している。残工程では機能を増やすのではなく、
次の戦闘因果をPlayerが文字なしで理解できる状態へ収束させる。

```text
敵が現れる
  → 移動／停止から役割を読む
  → 攻撃予兆を見る
  → 発射／接触を認識する
  → 回避または被弾する
  → Hit／Deathから結果を理解する
```

この因果が成立した後にPerformance確認と10戦Runの再計測を行い、最後にUser
Playtestでバランス値をFIXする。

## 2. 現状

### 完了済み

- 敵5種とBoss 1種のDefinition、Behavior、Wave、10戦Run
- 全敵の右画面外からのSimulation移動
- 近接型は接触時、遠距離型は射程内で攻撃する規則
- Playerの慣性、車輪軸、排煙、武器反動、Module Mount
- Monsterの`idle / move / anticipation / release` Pose
- Boss Phase 1–3 Core Auraと攻撃予兆
- Ballistic／Energy／Fire／Explosive VFX Family
- Combat／Reward／Battle ClearのPhase別UI
- Desktop／Tablet／Mobile Landscapeの自動E2E

### 残る問題

- 遠距離敵は`enemy-attacked`と`vehicle-hit`を同Tickで発生させ、弾の飛行時間がない
- Playerは被弾理由を位置関係とEvent表示から推測する必要がある
- 近接Hit、Enemy Hit、Deathの視覚的な時間軸が統一されていない
- Bomber自爆と通常Enemy Deathの区別が弱い
- Reduced Motion、Effect高負荷、Asset参照切れの検証が未完了
- 敵入場とUI変更後の10戦自動所要時間が再計測されていない
- 細かなUI位置とバランス値はUser Playtest前の仮値である

## 3. 今回の完了状態

1. Artillery／Bossの攻撃が`予兆 → 発射 → 飛行 → 着弾`で処理される
2. 近接型が`接触 → Release → Hit`の順序で処理される
3. Hit、Overheat、Deathが100ms以内に認識できる
4. 全VisualがSimulation Eventを読み、Damage Timingと矛盾しない
5. 主要Viewportと高負荷条件で入力・描画が安定する
6. 固定Seedの新しい基準値が記録される
7. User Playtestへ渡せるBuildと確認項目が揃う

## 4. 設計原則

### 4.1 Simulationを正とする

着弾前にDamageだけ発生させ、後から見た目の弾を飛ばす方式は禁止する。Projectileの
位置、寿命、Collision、Damage、Eventは固定60Hz Simulationで処理する。

### 4.2 敵弾をPlayer Weaponへ偽装しない

現在の`ProjectileState`は`weaponId`、距離補正、Trigger、Weapon Tagへ結合している。
敵弾へ架空のPlayer Weapon IDを割り当てず、次の専用型を追加する。

```ts
interface EnemyProjectileState {
  id: EntityId;
  ownerId: EntityId;
  previousPosition: number;
  position: number;
  velocity: number;
  radius: number;
  damage: number;
  maximumAgeSeconds: number;
  ageSeconds: number;
  visualId: 'spore' | 'boss-core' | 'boss-burst';
}
```

`SimulationState.enemyProjectiles`としてPlayer Projectileと分離し、Player Weaponの
Modifier、On Hit Trigger、Ammo、距離補正を適用しない。

### 4.3 Event順序を固定する

```text
enemy-attack-windup
  → enemy-projectile-fired / enemy-contact-released
  → vehicle-hit
  → enemy-attack-recovered
```

Presentationはこの順序を変更しない。Audioや画面揺れを後から追加する場合も同じEventを
利用する。

### 4.4 生成画像と手続き描画を分担する

- 生成画像: Projectile本体、着弾Core、Death Puffの大きなSilhouette
- Canvas: 軌跡、Flash、Ring、Dust、Debris、Fade、画面揺れ
- HTML / CSS: HP数値、警告文、Cooldownなどの動的情報

画面全体を生成した画像や、敵ごとに独立生成して形が揺れるDeath Frameは使用しない。

## 5. 実装フェーズ

### A. Enemy Attack Timeline基盤

Status: Completed

1. `EnemyProjectileState`と`enemyProjectiles`をSimulationへ追加
2. 敵攻撃のWindup／Release用StateまたはCooldown Phaseを定義
3. Artilleryの射程停止後、Windup完了時にSpore Projectileを生成
4. Boss PhaseごとにProjectile速度、数、Visual IDを定義
5. Enemy ProjectileとPlayer CircleのSegment Collisionを実装
6. Damageは着弾Tickだけで発生させる
7. Projectile残存中のWave完了条件を定義する

完了条件：遠距離敵のRelease EventとPlayer Damageの間に、距離に応じた飛行時間がある。

実装結果：

- Player Weapon系と分離した`EnemyProjectileState`／`enemyProjectiles`を追加
- 全Enemyへ明示的な`attackWindupSeconds`とWindup Stateを追加
- ArtilleryはSpore、Boss Phase 1–2はCore、Phase 3はBurst定義で敵弾を生成
- 敵弾のSegment Collision、Armor Damage、寿命切れを固定60Hzで処理
- `enemy-attack-windup`、`enemy-projectile-fired`、`enemy-projectile-hit`を追加
- 飛行中の敵弾が0件になるまでWave／Victoryを確定しない
- Phase B Asset導入まで、Simulation座標へ追従する高視認性の仮ProjectileをCanvas描画
- Unit 57件とE2E 16件で既存戦闘、Reward、Boss Preview、Responsiveを回帰確認

### B. Enemy Attack Visual

Status: Completed

最低限、次を生成または既存Assetから再利用する。

| asset_id                       | 用途                         | 方針                |
| ------------------------------ | ---------------------------- | ------------------- |
| `vfx_enemy_spore_v001`         | Artillery Projectile／Impact | 新規2-cell Graphic  |
| `vfx_enemy_boss_core_v001`     | Boss Projectile／Impact      | 新規2-cell Graphic  |
| `vfx_enemy_melee_contact_v001` | 通常近接Hit                  | 既存VFX＋Dust再利用 |
| `vfx_enemy_death_puff_v001`    | 通常Enemy Death              | 新規または共通化    |
| `vfx_enemy_bomber_burst_v001`  | Bomber自爆                   | Explosive VFX再利用 |

1. Artillery／BossのMuzzle AnchorをPose別に測定
2. Projectileへ速度方向のTrailを追加
3. 着弾時にPlayer Flash、短い押し、局所Ringを同期
4. Mobile LandscapeでProjectileが背景へ埋もれない輪郭を確認
5. Asset Prompt、Master、Runtime、採否をRegistryへ記録

完了条件：Event文やHP数値を見なくても、どの敵から何が飛来したか判断できる。

実装結果：

- Artillery Spore、Boss Core、Boss Phase 3 BurstのProjectile／Impactを同一Style Lockで生成
- 3×2 Masterから各Familyを透過2-cell Runtime Assetへ分割し、Fallback付きで統合
- Artilleryは半径の0.48、Bossは半径の0.92だけPlayer側へ寄せた発射Anchorへ補正
- 速度方向を持つ生成Trailと、着弾Core＋局所Ring／粒子をSimulation Eventへ同期
- 被弾時のCaravanに短い押し戻しとBrightness Flashを適用
- 通常近接Hitは既存Impact／Dust、通常DeathとBomber自爆は既存Explosive Familyを再利用
- 1184×689と844×390で全3系統を比較し、背景上の輪郭と強度差を確認
- Prompt、Master、Runtime、Review画像、採否をVFX Registryへ記録

### C. Melee／Hit／Death

Status: Completed

1. 近接敵は接触前にReleaseへ入らず、接触Tickで攻撃を開始
2. Rusherは角、Heavyは甲羅、Basicは体当たりのContact Pointを分ける
3. Player HitはFlash、2〜5pxの押し、Attachmentの遅れで表現
4. Enemy Hitは短い逆方向OffsetとFlashを適用
5. 通常DeathはSquash／Fade／Puffを0.25〜0.45秒で再生
6. Bomberは接触Release後に本体を消し、爆発をDamage Eventと同期
7. Boss Deathは通常PuffではなくCore停止→大型爆発→Fadeとする

完了条件：Hitした対象、攻撃方向、Enemy消滅理由を100ms以内に判別できる。

実装結果：

- 接触後のEvent順序を`enemy-contact-released → enemy-attacked → vehicle-hit`へ固定
- Contact PositionをSimulation Eventへ保持し、描画側の推測座標を廃止
- BasicはBody Ring、RusherはHorn Chevron、HeavyはShell Arcで接触Silhouetteを分離
- Player／Enemyへ100〜120msのFlashと逆方向Offsetを適用
- 通常Deathを本体Squash／Fadeから生成Puffへつなぐ0.42秒のSequenceとして実装
- Bomberは接触Release後に本体を消し、既存Explosive ImpactをDamage Eventへ同期
- Boss Deathは本体Fade、Core停止、Explosive Impact、拡張Ringを1.05秒で再生
- 1184×689と844×390で接触3種、Bomber、通常Death、Boss Deathを比較確認
- Prompt、Master、Runtime、Review画像、採否をVFX Registryへ記録

### D. Quality／Performance

Status: Pending

1. `prefers-reduced-motion`でPulse、Shake、Secondary Motionを弱める
2. 攻撃予兆、Projectile、Hit FlashはReduced Motionでも残す
3. 100 Player Projectile、32 Enemy Projectile、48 EffectでFrame時間を計測
4. Effect PoolとProjectile cleanupに上限・寿命漏れがないか確認
5. Animation／VFX画像の404、decode失敗、未Load時Fallbackをテスト
6. 1920×1080、1440×900、1280×720、1024×768、932×430、844×390を確認
7. 不要になった即時遠距離Damage分岐と旧描画Fallbackを削除

暫定Performance Budget：

- Desktop Chrome: 60 FPS目標、Frame p95 20ms未満
- Mobile Landscape相当Viewport: Frame p95 25ms未満
- Effect Instance: 通常48以下、上限96
- 参照切れ: Runtime Console Error 0件

### E. 自動バランス基準の更新

Status: Pending

1. Seed `1 / 42 / 2026`で10戦Runを再実行
2. 戦闘ごとの所要時間、Player HP、前進距離、主副武器使用率を記録
3. Enemy Projectile発射数、命中数、回避数を記録
4. Reward選択と最終Buildの決定性を確認
5. 結果を`docs/playtest/mvp-readiness.md`へ反映

このフェーズではHPだけを一括で増やさない。10〜20分へ伸ばす判断はUser Playtest後に行う。

### F. User Playtest Gate

Status: User Confirmation Required

確認項目：

1. 敵種と攻撃方向を文章なしで理解できるか
2. 遠距離弾を見て移動または緊急離脱を判断できるか
3. 近接接触と被弾の因果が一致しているか
4. Main／Sub／Escapeの切替が必要か
5. SAFE寄りと前進時で危険・報酬の差を感じるか
6. Rewardで装備を比較し、Buildが外見と戦い方へ反映されるか
7. Bossまでの時間、Bossの圧力、再挑戦意向は妥当か

User確認後にFIXする値：

- 1 Runの目標時間
- Enemy Entry Speed、射程、Windup、Projectile速度
- HP、Damage、Wave間隔、敵数
- Heat、Energy、Ammoの回復と消費
- Reward倍率とFrontline Pressure

## 6. 今回は行わないこと

- ボタン位置、Reward余白、細かなTypographyの最終FIX
- 分岐ルート、Shop、Event、Save
- 複数Areaや新しいEnemy Roleの追加
- 通常敵すべての長尺Full-frame Animation
- Audio／BGMの本実装
- バランス根拠なしの全HP・全Damage一括変更

## 7. 自動検証

### Unit / Simulation

- 射程外ではWindupとProjectile生成が起きない
- Windup前にDamageが発生しない
- ProjectileがPlayerへ到達したTickだけDamageが発生する
- Projectileが外れた場合はDamage 0で寿命終了する
- 近接型は接触前に攻撃Eventを出さない
- Enemy ProjectileへPlayer Weapon Triggerが発火しない
- Boss PhaseごとのProjectile定義と決定性が一致する
- Death中EntityがPressure、Collision、Rewardへ二重計上されない

### E2E / Visual

- Artillery発射からPlayer Hitまで進行できる
- Boss Phase 1–3の攻撃が表示される
- Combat／Reward／ResultのPhase切替が維持される
- 主要ViewportでHUD、Player、Enemy Projectileが重ならない
- Reduced Motionでも攻撃予兆を確認できる
- Canvas 2D未対応時の回復可能Error UIが維持される

## 8. Commit単位

1. `feat: add hostile projectile simulation`
2. `art: add enemy attack visual families`
3. `feat: render telegraphed enemy attacks`
4. `feat: add hit and death presentation`
5. `test: cover combat presentation stress cases`
6. `docs: refresh mvp playtest baseline`

各Commit前に`npm run check`を実行する。Visual変更はDesktopと844×390を最低限確認する。

## 9. 最終Definition of Done

- 遠距離Damageが目に見えるProjectile着弾と一致する
- 近接Damageが接触と攻撃Poseに一致する
- 通常敵5種とBossの攻撃意図を文字なしで区別できる
- Hit、Overheat、Deathを100ms以内に理解できる
- Simulationの固定Seed決定性を維持する
- 主要Viewportで戦闘領域と操作UIが破綻しない
- Performance Budgetを満たすか、未達理由と計測値を記録する
- 10戦Runを勝利／敗北から再開まで完走できる
- User Playtestの判断項目と記録様式が揃っている
