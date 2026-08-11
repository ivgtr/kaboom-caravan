# MVP自動バランス基準

- Date: 2026-08-11
- Simulation: fixed 60Hz
- Seeds: `1 / 42 / 2026`
- Initial build: Machine Cannon / Scatter Cannon
- Strategy: 装備の適正距離を維持し、敵弾・接触予兆へ迎撃パリィを使用
- Reward policy: 現在のSubより上位のRocket／Railgunを優先し、それ以外はModule
- Route policy: 3回ともHighwayを選択
- Command: `REPORT_BALANCE=1 npm test -- src/game/session/mvpRun.test.ts --reporter=verbose`

報酬選択の思考時間と演出待ち時間は含めない。ゲーム内のTIME SCOREも同じく、
各Combatの60Hz tickだけを合計する。数値は自動戦闘の回帰基準であり、人間の想定
プレイ時間ではない。

## 今回の調整意図

- Scatter Cannonを5 Pellet、Flamethrowerを8 Hit、Railgunを6体貫通へ変更し、武器ごとの爽快さと用途を明確化
- RocketをDamage 38 / 爆発半径10、MineをDamage 44 / 爆発半径9へ強化し、爆発武器を敵群への選択肢に変更
- Battle 1〜9へ計16体、Boss Phase 2へ計2体を追加し、後半ほど複数役割が重なる構成へ変更
- BossをHP 320から440へ増やしつつArmor 3を維持し、強化武器でも瞬殺されない耐久へ調整
- 緊急後退を0.42秒受付の迎撃パリィへ変更。成功時はDamage 30の反撃、Energy 30回復、Heat 30排出、Cooldown即時回復
- 弾薬上限を30から50へ増やし、増加した敵数に対してMainを継続使用できるよう変更
- Frontlineの自然後退を2.5から0.5へ抑え、見えない敗北より敵の接触・射撃を難易度の中心に変更
- Post-MVP Alphaの同一Weapon強化、Rarity、3種Supply Dropを通常ルート基準へ統合

## Run summary

| Seed | 戦闘時間 | 最低HP | 累積前進 | Main/Sub | 使用率 Main/Sub | 敵弾 発射/命中/回避 | Parry |
| ---- | -------- | ------ | -------- | -------- | --------------- | ------------------- | ----- |
| 1    | 146.617s | 100    | 665.365  | 217/33   | 86.8/13.2%      | 12/0/12             | 17    |
| 42   | 109.733s | 100    | 683.082  | 164/35   | 82.4/17.6%      | 10/0/10             | 10    |
| 2026 | 109.633s | 100    | 667.554  | 160/32   | 83.3/16.7%      | 9/0/9               | 9     |

## Encounter time

| Battle | Seed 1  | Seed 42 | Seed 2026 |
| ------ | ------- | ------- | --------- |
| 1      | 9.533s  | 9.533s  | 9.533s    |
| 2      | 10.367s | 10.367s | 10.367s   |
| 3      | 12.750s | 24.833s | 8.250s    |
| 4      | 38.917s | 8.767s  | 8.250s    |
| 5      | 10.167s | 10.300s | 8.183s    |
| 6      | 9.800s  | 8.683s  | 9.683s    |
| 7      | 7.850s  | 7.633s  | 7.850s    |
| 8      | 13.283s | 9.000s  | 12.467s   |
| 9      | 20.867s | 9.483s  | 21.283s   |
| 10     | 13.083s | 10.983s | 13.483s   |

## Findings for User Playtest

- 3 Seedすべてが全10戦を完走し、Boss戦は10.98〜13.48秒。同一Weapon強化を含むBuild差が討伐時間へ反映される。
- Seed 1のBattle 4は38.92秒まで伸びる。武器箱からのBuild分岐が序盤難易度を極端にしないか手動プレイで重点確認する。
- Seed 42／2026は約109.7秒、Seed 1は146.6秒。Supplyの回復・弾薬補充を含めてもSeed差が残るため、Drop率を上げる前に実操作で不足感を確認する。
- 最低HPは全Seed 100。固定戦略は攻撃到達を正確に予測するため、Eliteルートと手動パリィ失敗時の圧力を別途確認する。
- 自動戦闘時間は110〜147秒。人間操作でも目標10〜20分へ届かない場合は、HPの一括増加ではなくEncounter数またはWave構造を再検討する。

次の変更では、手動プレイのBattle別TIME SCOREと敗因をこの基準へ比較する。
