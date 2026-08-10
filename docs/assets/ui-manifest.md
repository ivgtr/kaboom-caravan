# Kawaii Garage UI Asset Registry

| asset_id | purpose | generation_source | master resolution | runtime | version | status | used_by |
| --- | --- | --- | --- | --- | --- | --- | --- |
| ui_control_frame | Touch/keyboard control family | built-in imagegen + approved G0 reference | 1254×1254 | 384×384 RGBA | v001 | adopted | Main/Sub/Escape/Move |
| ui_hud_ornament | Compact HP shell | built-in imagegen + approved G0 reference | 1774×887 | 1024×512 RGBA | v001 | adopted | CombatHud |
| ui_reward_frame | Reusable reward base card | built-in imagegen + approved G0 reference | 1024×1536 | 512×768 RGBA | v001 | adopted | RewardCard |
| ui_battle_clear_frame | Phase transition decoration | built-in imagegen + approved G0 reference | 1672×941 | 1024×576 RGBA | v001 | adopted | BattleClear |

Prompt set: `artifacts/ui/prompts/ui_asset_prompts.md`.

Equipment illustrations are code-native SVG renders so all sixteen definitions share the same camera, palette and silhouette rules without AI shape drift. Small icons, dynamic rings, text and rarity treatment are also SVG/CSS. This is the intentional responsibility split recorded in `docs/ui/UIアセット仕様.md`.
