# Kaboom Caravan

かわいい装甲車へ過剰な火力を積み、距離と前線を管理して戦うブラウザ向け2.5Dローグライクです。

## 現在の開発範囲

最初のMVPは、固定された約10戦を順番に攻略し、各戦闘後に3択報酬を受け取る構成とします。ルートマップ、ショップ、キャラバン複数車両、永続アンロックは、コア戦闘とビルド選択が成立した後に追加します。

MVPの合格条件は、[要件書](docs/要件書.md)にある次の体験です。

- ランごとに異なるビルドになる
- 装備の3択で悩める
- ビルドにより戦闘方法が変化する
- 戦闘中に前進・後退の判断がある
- 敗北後に別構成で再挑戦したくなる

## 技術構成

- Vite / TypeScript / React
- Canvas 2D（表示専用）
- Pure TypeScript Simulation（ゲームルール）
- Vitest

依存方向は `React UI → Session → Simulation` とし、Canvas 2DはSimulationの結果だけを描画します。描画オブジェクトやReactの状態からゲームルールを直接変更しません。

## セットアップ

Node.js 24以上とnpmを使用します。

```sh
npm install
npm run dev
```

主な確認コマンド：

```sh
npm run lint
npm test
npm run build
npm run check
```

開発中の操作は、`A` / `←`で後退、`D` / `→`で前進、`Space`で主武器、`E` / `Shift`で副武器、`Q`で緊急後退・排熱です。これはフェーズ2のプレイ感を確認するための仮設定です。

## 資料

- [要件書](docs/要件書.md)：ゲーム体験と機能要件の正本
- [技術設計書](docs/技術設計書.md)：アーキテクチャの正本
- [デザイン設計書](docs/デザイン設計書.md)：世界観とアート方針の正本
- [グラフィック指示書](docs/グラフィック指示書.md)：生成アセット制作工程の正本
- [MVP判断記録](docs/adr/0001-mvp-scope.md)：実装開始時の仮決定と保留事項
- [戦闘ロードアウト判断記録](docs/adr/0002-combat-loadout.md)：装備枠、共有リソース、特殊能力の確定事項
- [2D Presentation判断記録](docs/adr/0003-2d-layered-presentation.md)：2Dレイヤー描画への方針変更
- [2D素材設計書](docs/2D素材設計書.md)：Sprite分割、Anchor、透明素材、保管方法
- [MVP実装計画書](docs/実装計画書.md)：実装フェーズ、要件トレーサビリティ、完了条件
- [フェーズ2プレイテスト](docs/playtest/phase2.md)：距離、前線、武器、リソースの確認手順
- [G0開始前チェックポイント](docs/playtest/g0-readiness.md)：実アセット生成前の承認事項
- [G0 Asset manifest](docs/assets/g0-manifest.md)：生成素材の出典、条件、採否記録
