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
- Post-MVP Alphaの同一Weapon強化、Rarity、Treasureを通常ルート基準へ統合

## Run summary

| Seed | 戦闘時間 | 最低HP | 累積前進 | Main/Sub | 使用率 Main/Sub | 敵弾 発射/命中/回避 | Parry |
| ---- | -------- | ------ | -------- | -------- | --------------- | ------------------- | ----- |
| 1    | 115.967s | 100    | 652.248  | 191/41   | 82.3/17.7%      | 14/0/14             | 14    |
| 42   | 116.850s | 100    | 685.387  | 188/29   | 86.6/13.4%      | 7/0/7               | 7     |
| 2026 | 100.250s | 100    | 678.214  | 135/33   | 80.4/19.6%      | 7/0/7               | 7     |

## Encounter time

| Battle | Seed 1  | Seed 42 | Seed 2026 |
| ------ | ------- | ------- | --------- |
| 1      | 9.533s  | 9.533s  | 9.533s    |
| 2      | 10.367s | 10.367s | 10.367s   |
| 3      | 12.050s | 24.833s | 7.950s    |
| 4      | 16.467s | 8.767s  | 7.883s    |
| 5      | 9.700s  | 10.067s | 10.067s   |
| 6      | 10.133s | 8.683s  | 8.683s    |
| 7      | 9.300s  | 7.633s  | 7.633s    |
| 8      | 11.383s | 11.417s | 13.300s   |
| 9      | 12.867s | 12.200s | 11.350s   |
| 10     | 14.167s | 13.350s | 13.483s   |

## Findings for User Playtest

- 3 Seedすべてが全10戦を完走し、Boss戦は13.35〜14.17秒。同一Weapon強化を含むBuild差が討伐時間へ反映される。
- Battle 3は7.95〜24.83秒とSeed差が大きい。Reward RarityとWeapon Lv.を含め、手動プレイで序盤の振れ幅を重点確認する。
- Seed 2026はRocket Lv.3、Railgun Lv.2へ成長し100.25秒で最短。武器を重ねる更新動機が成立している。
- 最低HPは全Seed 100。固定戦略は攻撃到達を正確に予測するため、Eliteルートと手動パリィ失敗時の圧力を別途確認する。
- 自動戦闘時間は100〜117秒。人間操作でも目標10〜20分へ届かない場合は、HPの一括増加ではなくEncounter数またはWave構造を再検討する。

次の変更では、手動プレイのBattle別TIME SCOREと敗因をこの基準へ比較する。
