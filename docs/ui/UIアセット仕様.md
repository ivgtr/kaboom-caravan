# Kaboom Caravan UI Asset仕様

- Status: Planned
- Date: 2026-08-10
- Generator: built-in `image_gen`
- Style reference: `artifacts/g0/style-reference/ref_style_001_candidate_v002.png`

## UI STYLE LOCK

```text
Stylized kawaii cartoon game UI asset for Kaboom Caravan.
Japanese game-inspired visual design.
Cute mechanical garage aesthetic with rounded chunky shapes, warm ivory panels, deep navy mechanical details, coral, mint, cyan and warm yellow accents.
Soft toon shading, thick clean outlines, bold readable silhouettes, simplified mechanical construction.
Cute but not childish. Mechanical but not realistic military.
Bright and playful rather than dark or grim.
Designed for a colorful 2D vehicle combat roguelike where one adorable modular caravan uses absurdly oversized weapons against ecosystem monsters.
Minimal surface noise.
No photorealism. No realistic rust. No grimdark military interface. No modern military HUD. No cyberpunk interface.
No readable text unless explicitly requested. No logo. No watermark.
```

## Generated Asset一覧

| Asset ID           | Master    | Runtime表示  | Background         | Safe Area | Used by                |
| ------------------ | --------- | ------------ | ------------------ | --------- | ---------------------- |
| `ui_control_frame` | 1024×1024 | 76〜152px    | Chroma Key → Alpha | 12%       | Main / Sub / Escape    |
| `ui_hud_ornament`  | 2048×512  | 可変         | Chroma Key → Alpha | 中央60%   | HP / Enemy / Frontline |
| `ui_reward_frame`  | 1024×1536 | 260〜360px高 | Chroma Key → Alpha | 中央50%   | Weapon / Module Card   |
| `ui_battle_clear`  | 1600×600  | 500〜800px幅 | Chroma Key → Alpha | 中央55%   | Battle Clear           |
| `wpn_*` 6種        | 1024×1024 | 52〜240px    | Chroma Key → Alpha | 12%       | Control / Reward       |
| `mod_*` 10種       | 1024×1024 | 48〜220px    | Chroma Key → Alpha | 12%       | Reward / Loadout       |

## 透明化Contract

- UIとEquipmentにMint / Cyanを使うためChroma Keyは`#ff00ff`
- Backgroundは完全な単色で、影、Gradient、Texture、Floor、Reflectionを含めない
- 被写体に`#ff00ff`を使用しない
- Cast Shadowは含めない
- Alpha変換後に四隅Alpha 0、Fringe、主体占有率を検査する
- Runtime Assetは`public/assets/ui/`と`public/assets/equipment/`へ保存する
- MasterとPromptは`artifacts/ui/`へ保存する

## Registry Contract

```text
asset_id
purpose
prompt
generation_source
resolution
version
status
used_by
sha256
```

動的Text、数値、Cooldown、Bar、Shortcutは画像へ焼き込まない。
