# ADR 0004: Modular CaravanとMonsterの対立構図

- Status: Accepted
- Date: 2026-08-10

## 決定

画面上の主役を、獲得した武器とModuleが外見へ積み上がる1台のCaravanとする。敵は車両・兵士ではなく、自然に覆われた旧文明で独自に進化したMonsterとする。

既存のデザイン設計書にある「ライバル車両文化」はMVPへ適用せず、本ADRが敵のPresentationについて優先する。敵のゲーム上の役割、Behavior、数値、IDは維持する。

## Caravan

- Vehicle Base、主武器、副武器、Module 0〜3を独立Spriteにする
- 報酬で装備を得た直後に外見へ反映する
- 武装が増えるほど過剰で楽しいSilhouetteになる
- Attachmentが重なって主砲、車輪、進行方向を隠さない
- 初期状態でも輸送・生活・修理用のCaravanらしい荷物と設備を持つ

## Monster生態系

Monsterは植物、獣、胞子、果実、瓦礫、旧文明の小さな残骸を組み合わせる。ただし車輪・運転席・砲塔を持つ敵車両には見せない。

| ID                | 表示名                 | 形と役割                              |
| ----------------- | ---------------------- | ------------------------------------- |
| `basic`           | モスモコ               | 苔と小石をまとう丸い群体Monster       |
| `rusher`          | ハナツノ               | 花角を伏せて突進する細身の四足Monster |
| `heavy`           | ガレキガメ             | 瓦礫を甲羅へ取り込んだ重装Monster     |
| `artillery`       | ホウシダケ             | 傘から胞子弾を放つ遠距離Monster       |
| `bomber`          | バクレツミ             | 爆裂果を抱えて接近する小型Monster     |
| `kawaii-fortress` | カワイイ・フォートレス | 遺跡と巨大生物が一体化した要塞Monster |

## VFX

VFXは単色の円ではなく、意味を持つ複数レイヤーで構成する。

- Muzzle: 白熱Core、Weapon色のFlash、Shock Ring、薬莢、短いSmoke
- Hit: 接触Flash、放射Spark、短いHit Stop表現
- Explosion: Startup、白熱Core、黄・橙Lobe、濃色Smoke、Debris、Ground Dust、Decay
- Overheat: Caravanの赤熱Tint、排気口Smoke、Heat警告Pulse
- Skill: 後方Dust、Speed Line、Heat排出

Simulation Eventから発生させ、VFXからゲーム状態を変更しない。

## StageとUI

- Stageは遠景、中景、Road、前景植生のParallax可能な層へ分ける
- 背景へ旧文明の高架道路、遺跡、標識跡、植生を置き、戦闘対象よりContrastを下げる
- HUDはHP、Heat、Energy、Ammo、10戦進行、前線Risk、Threat、主副武器、Module枠を常時読めるようにする
- HUDの枠はDark Navy、Player情報はCoral、回復・安全はMint、危険とExplosionはOrangeを基準にする
- 中央の戦闘領域をUIで塞がない
