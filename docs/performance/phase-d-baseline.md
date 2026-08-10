# Phase D Performance Baseline

- Date: 2026-08-11
- Browser: Playwright Chromium / headless
- Command:
  `RUN_PERFORMANCE_BUDGETS=1 PLAYWRIGHT_PORT=4202 npx playwright test tests/e2e/performance.spec.ts --project=chromium --workers=1`
- Samples: warm load後の直近120 Canvas render samples

## Stress scenario

- Player Projectile: 100
- Enemy Projectile: 32
- Active Effect: 48
- Active Effect上限: 96
- Recycled Effect上限: 96
- Assetは全件Ready後に測定
- Effectが40件以上ではSecondary ParticleとShadow Blurだけを省略
- Projectile本体、Impact Core、Hit Flashは維持

## Result

| Viewport    | Render p95 | Budget  | Result |
| ----------- | ---------- | ------- | ------ |
| 1920 × 1080 | 16.3 ms    | < 20 ms | Pass   |
| 844 × 390   | 5.0 ms     | < 25 ms | Pass   |

数値は同一端末上の基準値であり、実機FPSを保証する値ではない。将来のAsset追加や
描画方式変更時は、同じ隔離条件・1 workerで再計測する。

## Quality gates

- `prefers-reduced-motion: reduce`でPulse、Shake、Particle、Exhaustを抑制
- Projectile、Attack Telegraph、Impact Core、Hit Flashは維持
- 画像decode失敗時も手続き描画FallbackでCanvasを継続
- Runtime Assetの通常読み込みでfailed source 0件
- Player／Enemy Projectileは最大寿命超過時にSimulationから除去
- Renderer dispose時にEffect、Motion、Asset参照を解放
