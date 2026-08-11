# Kawaii Garage UI Asset Registry

| asset_id              | purpose                       | generation_source                         | master resolution | runtime       | version | status  | used_by                   |
| --------------------- | ----------------------------- | ----------------------------------------- | ----------------- | ------------- | ------- | ------- | ------------------------- |
| ui_control_frame      | Touch/keyboard control family | built-in imagegen + approved G0 reference | 1254×1254         | 384×384 RGBA  | v001    | adopted | Main/Sub/Parry/Move/Boost |
| ui_hud_ornament       | Compact HP shell              | built-in imagegen + approved G0 reference | 1774×887          | 1024×512 RGBA | v001    | adopted | CombatHud                 |
| ui_reward_frame       | Reusable reward base card     | built-in imagegen + approved G0 reference | 1024×1536         | 512×768 RGBA  | v001    | adopted | RewardCard                |
| ui_battle_clear_frame | Phase transition decoration   | built-in imagegen + approved G0 reference | 1672×941          | 1024×576 RGBA | v001    | adopted | BattleClear               |

Prompt set: `artifacts/ui/prompts/ui_asset_prompts.md`.

The sixteen generated equipment renders are registered in `docs/assets/equipment-manifest.md`. Small icons, dynamic rings, text and rarity treatment remain SVG/CSS for legibility and state control.
