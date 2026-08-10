# MVP手動プレイテスト・確認ゲート

- Status: User Playtest Required
- Date: 2026-08-11
- Automated baseline: seeds `1`, `42`, `2026`
- Detailed baseline: [MVP自動バランス基準](mvp-balance-baseline.md)

## 自動確認済み

- 3つの固定Seedで、実Simulationを10戦目のVictoryまで連続実行
- 各RunでRewardを9回選択し、次戦闘のBuildへ反映
- 同じSeedの戦績、報酬、最終Buildが再実行時に一致
- 勝利までのSimulation戦闘時間は126.400〜143.000秒
- 初期Subは近距離用Scatter Cannonで、報酬からRocket／Railgunへ更新できる
- Main／Sub使用率は約72／28〜79／21%、累積前進距離は811.831〜868.964
- 敵弾は各Run 12〜17発発射され、いずれも6発を後退とESCで回避
- Battle別TIMEとRun累積TIMEをCombat tickから算出し、Clear／Resultへ表示
- 敵は画面外から役割別の一定速度で進み、接近距離による減速を行わない
- Canvas 2Dを利用できない場合は、白画面ではなく再読み込み可能なError UIを表示
- Desktop、Tablet、Mobile Landscapeの操作領域とReward遷移をE2Eで確認

## 自動結果から残るリスク

自動戦略は入力とReward選択に思考時間を含まないため、上記時間をそのまま人間の
プレイ時間とは扱わない。ただし要件の10〜20分に対して戦闘テンポが短い可能性が高い。

代表戦略の最低HPは7〜61で、全Seedが完走する一方、Seed 2026はBoss終了時HP 7となる。
Bossは21.8〜26.6秒、Battle 9は18.9〜27.1秒で、従来のBossだけが突出するHP配分は解消した。
手動操作で通常戦の圧力とBossの回避余地が適切かを確認する。

## 確認手順

```sh
npm run dev
```

1. UI説明を見ずに前進・後退、MAIN、SUB、ESCを操作できるか
2. SAFEに留まる場合とDANGERへ前進する場合で、攻撃機会と危険の差を感じるか
3. Main／Subを押し続けるだけでなく、Heat・Energy・Ammoに応じた切り替えが必要か
4. Rewardで装備画像を見て候補を比較し、武器の装着先を迷わず選べるか
5. 装備した武器とModuleが次戦闘のCaravan外見へ反映されるか
6. 通常敵5種を、接近前にシルエットと色から区別できるか
7. 各Battle ClearのTIMEとRun TIME、被弾・前線圧力を記録する
8. 敗北後に別のBuildで再挑戦したいと感じるか

## User確認が必要な判断

- 1 Runの目標時間を要件どおり10〜20分へ伸ばすか
- 長距離維持へ対抗するPressure、Enemy攻撃、Reward倍率の強さ
- 初期ScatterからRocket／Railgunへ更新したい動機が十分か
- Bossの21〜27秒が短すぎず、HP壁にも感じないか
- 通常戦とBossのHP／Wave間隔／敵数のどれでテンポを調整するか
- 5つの体験合格条件を満たしているか

この確認までは数値を一括で引き延ばさない。手動所要時間と体感の記録を受けて、
HPだけを増やすのではなくWave間隔、敵役割、Resource回復をまとめて調整する。
