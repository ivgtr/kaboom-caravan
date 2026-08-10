# Kaboom Caravan UI監査・実装計画

- Status: Implemented（細部UI調整は後続）
- Date: 2026-08-10
- Theme: Kawaii Garage UI
- Visual source: [REF_STYLE_001 V2](../../artifacts/g0/style-reference/ref_style_001_candidate_v002.png)

## 1. 現状監査

### Combat画面・HUD

- Canvasは全画面だが、上部HUD、Frontline Panel、Weapon Panel、操作説明、Feedback、Debugが独立したWeb Panelとして重なる
- HP、Heat、Energy、Ammo、Enemy、10戦進行を一つの大きな上部Panelへ常時表示している
- Heat、Energy、Ammo、Cooldownが操作UIから離れている
- Frontline、Pressure、Reward倍率、Nearest Enemyを文章と数値で説明し、フィールド上のRisk Zoneと重複している
- Main / Sub / Escapeは操作Buttonではなく、Keyboard Shortcutの状態一覧である
- Combat中に最初に目へ入るのがWorldではなく上部HUDになりやすい

### Reward画面

- 3枚のCardは表示名、説明文、Action Buttonだけで構成され、Equipment Visualがない
- Weapon / Moduleの差がLabelと色だけで、形状上の区別が弱い
- Combat UIが背面へ残り、Rewardへ視線が集中しない
- Mobileでは1列へ落ちるだけで、横画面向けのSnap Scrollになっていない

### Input

- `InputManager`はKeyboardの押下状態だけを所有する
- Pointer / Touch Actionを注入するAPIがない
- Mobile Landscapeで両手親指操作できるButtonが存在しない

### Game Phase

- `combat`、`reward`、`victory`、`defeat`はSimulationとSessionで分離済み
- Battle Clear専用Presentation Phaseがなく、勝利直後にRewardへ切り替わる
- Reward中のCombat Control非表示規則がない

### Responsive Layout

- `max-width: 720px`だけを基準にするため、`932×430`と`844×390`の一般的なMobile Landscapeへ適用されない
- MobileでWeapon Panelが消えるが、代替操作UIがない
- HUD高さが限られたLandscape画面のWorldを圧迫する

### Asset・Component・CSS

- Runtime UI画像は0件。画像はG0 Style Referenceだけで、ゲームから読み込まない
- `GameApp.tsx`へHUD、Reward、Result、Event文言が集中している
- `game.css`は一つだが、Phase別Root classやUI Tokenがない
- Border、Gradient、Panel装飾をCSSだけで担い、専用ゲームUIのArt Directionが弱い

### Debug・Desktop / Touch切替

- TickとPositionがDesktop製品UIへ常時表示される
- Keyboard操作説明が画面下へ常時表示される
- Debug ModeとTutorial表示状態が存在しない
- Desktop / Touchの切替はCSSにもStateにも存在しない

## 2. 残すUI

- React UI → Session → Simulationの依存方向
- CanvasをGame Worldの主役にする全画面構造
- HP、Heat、Energy、Ammo、Enemy Count、Frontline、Cooldownのデータ
- 10戦進行、Combat Feedback、Reward選択、Victory / Defeat、Restart
- Keyboard InputとARIA Label

## 3. 廃止するUI

- 巨大な上部総合HUD
- 文章中心のFrontline独立Panel
- Keyboard一覧型のWeapon Panel
- 常時表示の操作説明
- 製品UI内のDebug Panel
- Combat UIを背面へ残したReward表示
- Mobileで単にUIを非表示にするResponsive処理

## 4. 新規UI

- 左上のCompact HP Garage Gauge
- 上中央の10 Battle Run Progress Strip
- 小型Enemy Count Sticker
- 左下のForward / Back Touch Controls
- 右下のMain / Sub / Escape Control Cluster
- Button内部へWeapon Image、Cooldown、Ammo、Heat、Energyを統合
- UI専用Battle Clear Presentation
- Equipment Visual中心のReward CardとMobile Snap Carousel
- `?debug=1`だけで表示するDebug Overlay
- DesktopではButton内へShortcut Hint、Touch DeviceではShortcutを隠す

## 5. Asset責務

### 画像生成する

| Asset                  | 理由                          | 再利用                       |
| ---------------------- | ----------------------------- | ---------------------------- |
| Control Button Frame   | Kawaii Garageの立体的な機械枠 | Main / Sub / Escapeで共用    |
| HUD Ornament Frame     | CSS Panelへ専用世界観を追加   | HP / Enemy / Frontlineで共用 |
| Reward Card Base Frame | Rewardをゲーム固有画面へする  | Weapon / Moduleで共用        |
| Battle Clear Banner    | Phase演出の主役               | 通常戦共用                   |
| Weapon Render 6種      | RewardとControl Buttonの主役  | Reward / Combat共用          |
| Module Render 10種     | RewardとLoadoutの主役         | Reward / Loadout共用         |

### SVG / CSSで作る

- HP、Heat、Energy、Ammo、Enemy、Frontline、Main、Sub、Escape、Weapon、Module、Tag Icon
- Forward / Back Arrow
- Cooldown / Heat / Energy Ring
- Dynamic Bar、数値、Text、Shortcut、Progress Pip
- Rare / Epic / Legendary GlowとCorner Overlay
- 9-slice相当のStretch、Hover、Focus、Selected、Disabled State

理由は32pxでの可読性、動的な色変更、Animation、ARIA対応を優先するため。生成Iconをそのまま縮小する方式は採用しない。

## 6. 実装順

1. UI Token、Phase Root、Component分割、Touch Input API
2. UI Asset Registryと生成Prompt
3. Frame / Banner生成、透明化、縮小検証
4. Weapon / Module Render生成、透明化、Registry接続
5. Combat HUDとControl Cluster
6. Field-integrated Frontline
7. Battle Clear Presentation
8. Reward Card / Mobile Carousel
9. Debug分離、Tutorial整理、旧UI削除
10. Desktop / Tablet / Mobile Landscapeの実画面検証

## 7. 完了判定

- Game WorldがUIより先に見える
- TouchとKeyboardが同じCommand境界を使う
- Main / Sub / Escapeの操作位置と状態表示位置が一致する
- Reward Card面積の45%以上をEquipment Visualが占める
- Combat / Battle Clear / Rewardで表示UIが切り替わる
- 生成AssetがControl、Reward、Battle Clear、Equipmentへ実際に使われる
- Dynamic情報と小型IconはCSS / SVGのまま読みやすい
- 5つの対象解像度で中央戦闘領域を塞がない
- Gameplay Logicへ変更を入れない

## 8. 実装結果

- 生成UIフレーム4種と装備Render 16種をRuntimeへ登録
- Combat / Battle Clear / Rewardの表示切替を実戦闘経路でE2E検証
- Rewardでは3枚すべてに固有Equipment Visualを表示
- Module 4枠時は、各Reward Cardへ交換される最古Module名を表示
- 844×390ではHorizontal Snap Carousel、Desktopでは3列表示
- Gameplay Logicは維持し、変更はPresentation / Input / Testへ限定
- ボタン位置などの細部UI調整はユーザー確認後に別途FIXする

## 9. Combat UI責務の再整理

- Game World: Player、Enemy、Projectile、地形と低彩度Risk Zoneを表示する
- 左上: Caravan HPだけを表示する
- 上中央: 空間上のFrontlineではなく、10戦のRun進行とSalvage倍率を表示する
- 右上: 現在のEnemy Countだけを表示する
- 左下: 前進／後退操作だけを表示する
- 右下: Main／Sub／Escapeと、それぞれに直接関係する状態だけを表示する
- Combat Feedback: Wave開始やHitなど短時間のEventだけを通知する

Frontlineの正確な座標は内部ルールとして維持するが、旗、縦線、Paintで常時表示しない。
危険度は道路へ溶け込む色味と敵との実際の距離で伝える。
