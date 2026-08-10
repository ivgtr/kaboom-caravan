# G0開始前チェックポイント

- Status: G0 Integrated
- Date: 2026-08-10
- 対象実装: `3883aad`

## 現在地

プレースホルダ表示のまま、MVPの戦闘・ビルド・敵・報酬・10戦ランを一通り実装した。自動検証は武器6、Module 10、通常敵5、Boss 1、固有Wave 10と参照整合性を確認する。

次のフェーズでは、量産前のG0として次だけを制作し、同じ画面へ並べてStyleを判断する。Presentationは[ADR 0003](../adr/0003-2d-layered-presentation.md)により、3Dモデルを使わない2Dレイヤー方式へ変更した。

1. Style Reference 1枚
2. Player Vehicle基準デザイン
3. Basic Enemy基準デザイン
4. Machine Cannon基準デザイン
5. Road / Background基準デザイン

Railgun、Heavy、Explosion、HUDは上記のStyle承認後に追加する。ほかの武器・敵・ModuleはG0承認前に量産しない。

## 推奨する開始方法

- リポジトリの[グラフィック指示書](../グラフィック指示書.md)を固定プロンプトの正本にする
- 最初は画像生成でStyle Referenceと2D Conceptのみを作る
- 1アセットにつき少数案に制限し、採用・修正・却下を記録する
- Style Reference承認後、車体・武器・敵・背景・VFXを独立した2D素材として生成する
- 生成元、日時、プロンプト、採用判断、利用条件を[Asset manifest](../assets/g0-manifest.md)へ残す
- 生成MasterとPromptを`artifacts/g0/`、実行時に最適化した画像を`public/assets/`で管理する

## 開始に必要な承認

次の推奨案を一括で承認後、Style Reference 1枚の生成から開始する。

1. G0の2D生成に、この環境の画像生成機能を使用する
2. 生成サービスの利用条件を確認し、Asset manifestに出典と生成条件を記録する
3. G0は通常Gitで管理し、Master総量が増える前にGit LFS導入を再判断する
4. 3D素材・GLB・3D生成サービスをMVP対象外とする

上記は2026-08-10に承認済み。Monster方針と2D素材方針の追加確認後、
`REF_STYLE_001_CANDIDATE_V002`を`REF_STYLE_001`へ昇格した。Player、全Enemy、
Background、Roadを分離生成し、Canvas描画へ統合済み。

## G0合格条件

- 「かわいい世界 × 過剰な火力」が1画面で伝わる
- Player、Basic Enemy、Machine Cannon、Road / Backgroundが同一作品に見える
- 横方向の戦闘でPlayer、敵、弾、前線を瞬時に識別できる
- Playerと敵のシルエットが小さい表示でも区別できる
- 配色、輪郭、カメラ、デフォルメ率をSTYLE LOCKとして固定できる

## 現在の候補レビュー

`artifacts/g0/style-reference/ref_style_001_candidate_v002.png`を確認対象とする。V1は敵車両を描いていたため、Monster方針を反映したV2で置き換えた。

- Pass: 巨大な機関砲とExplosionが画面の主役になる
- Pass: Vehicle Base、主砲、副砲、冷却器、弾薬箱が別部品として読める
- Pass: モスモコ、ハナツノ、ガレキガメを形と色で即座に区別できる
- Pass: 背景の明度とDetail Densityが車両を邪魔しない
- Pass: 固定横視点とGround Lineが2Dレイヤー化に適している
- Pass: Muzzle、薬莢、Hit、Explosion、Smoke、Dustが多層VFXとして読める
- Pass: HP・Heat・Energy・Ammo、10戦進行、Threat、武器・Module枠のHUD構造が成立する
- Pass: 小さい表示でもCaravan、Monster、砲身、ExplosionのSilhouetteが読める
- User review: Kawaiiの強さが幼児向けに寄りすぎていないか
- User review: Modular Caravan、Monster生態系、詳細HUDをこの画面の方向でSTYLE LOCKしてよいか

上の2点は承認済み。候補を`artifacts/g0/style-reference/ref_style_001.png`
へ昇格し、分離素材の生成とG0実装へ進んだ。
