# Rendering Performance Review

## Scope and evidence

- React 19.2.8。Virtualization／Profiler補助Packageは未導入。
- `GameApp`はSimulationを`sessionRef`に保持し、60Hz更新をReact stateへ流していない。
- Canvas描画は`GameRenderer`へ分離され、HUD snapshotだけを6 tick間隔で更新する。
- React上の固定Listは戦闘進行10件、Reward最大3件で、Virtual Scroll対象はない。
- Context Provider、大規模filter／sort、入力連動の重いList描画はない。

## Measured Canvas baseline

隔離したPlaywright Chromium 1 workerで、100 Player Projectile、32 Enemy
Projectile、48 Effectを120 frame計測した。

| Viewport    | Render p95 | Budget  |
| ----------- | ---------- | ------- |
| 1920 × 1080 | 16.3 ms    | < 20 ms |
| 844 × 390   | 5.0 ms     | < 25 ms |

初回Desktop計測は20.0msだった。Effect 40件以上でSecondary ParticleとShadow
Blurを省略するAdaptive Detail後は16.3msとなった。主要Projectile／Impact／Flashは
維持している。

## Memoization assessment

現時点で`memo`、`useMemo`、`useCallback`を追加する根拠はない。固定長Listと小さなHUD
構造のため、Hookコストと複雑性を増やさない。

今後UI更新が増えた場合のみ、React DevTools Profilerで各操作あたりのcommit回数と
durationを測る。After profiling confirms repeated child renders per HUD update, consider
stable callbacks or component-level memoization.

## Virtual scroll and concurrent features

- Virtual scroll候補なし。
- `useTransition`／`useDeferredValue`候補なし。
- Reward選択は最大3件で同期処理が小さい。

## Canvas assessment

- 高頻度SimulationはReact stateを迂回しており適切。
- Active／Recycled Effectを各96件に制限。
- Reduced Motionと高負荷Adaptive DetailをCanvas側へ実装。
- Asset decode失敗を診断可能にし、手続き描画Fallbackを維持。

## Recommended follow-up

新しい最適化はunconfirmed — profile first。次の描画Asset追加時に同じStress Gateを
再実行し、p95悪化が再現した場合だけ個別PRで対処する。
