# Kaboom Caravan

ドパガキ向けのチャリ走ライク。

[ブラウザで遊ぶ](https://ivgtr.github.io/kaboom-caravan/)

## 遊び方

移動と攻撃は自動。宝箱で能力を集め、敵や箱を壊してフィーバーをつなぎ、ハイスコアを狙います。

- タップ / Space / ↑ / W でジャンプ。長押しで高く跳び、空中でもう一度だけ跳べます
- Esc / P または一時停止ボタンでポーズ

## 開発

Node.js 24以降。

```bash
npm ci
npm run dev
```

- `npm run build`: 本番用ビルド
- `npm run check`: lint・テスト・ビルド・フォーマットの確認
