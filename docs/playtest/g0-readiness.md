# G0開始前チェックポイント

- Status: Awaiting Approval
- Date: 2026-08-10
- 対象実装: `3883aad`

## 現在地

プレースホルダ表示のまま、MVPの戦闘・ビルド・敵・報酬・10戦ランを一通り実装した。自動検証は武器6、Module 10、通常敵5、Boss 1、固有Wave 10と参照整合性を確認する。

次のフェーズでは、量産前のG0として次だけを制作し、同じ画面へ並べてStyleを判断する。

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
- 3D生成サービスの選定とGLB化はStyle Reference承認後に行う
- 生成元、日時、プロンプト、採用判断、利用条件を[Asset manifest](../assets/g0-manifest.md)へ残す
- 高解像度の生成Masterと将来のGLBはGit LFS、実行時に最適化した小さな画像は通常Gitで管理する

## 開始に必要な承認

次の推奨案を一括で承認後、Style Reference 1枚の生成から開始する。

1. G0の2D生成に、この環境の画像生成機能を使用する
2. 生成サービスの利用条件を確認し、Asset manifestに出典と生成条件を記録する
3. 高解像度MasterとGLBへGit LFSを導入する
4. 3D生成サービスの選定は2D Style承認後まで保留する

この承認はG0の少数生成だけを対象とし、全アセット量産の承認を含まない。

## G0合格条件

- 「かわいい世界 × 過剰な火力」が1画面で伝わる
- Player、Basic Enemy、Machine Cannon、Road / Backgroundが同一作品に見える
- 横方向の戦闘でPlayer、敵、弾、前線を瞬時に識別できる
- Playerと敵のシルエットが小さい表示でも区別できる
- 配色、輪郭、カメラ、デフォルメ率をSTYLE LOCKとして固定できる
