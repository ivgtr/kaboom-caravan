# Animation Asset Registry

Generated character motion assets are reviewed at master resolution, converted
from chroma-key to alpha, and then assigned in `src/render/animationAssets.ts`.

| asset_id                          | purpose                                       | generation_source                            | resolution                 | version | status                | used_by        |
| --------------------------------- | --------------------------------------------- | -------------------------------------------- | -------------------------- | ------- | --------------------- | -------------- |
| `veh_player_motion_v002`          | Player pose sheet                             | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | superseded            | —              |
| `veh_player_rig_parts_v003`       | 3 exhaust stages; wheel cell unused           | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v003    | partially integrated  | `GameRenderer` |
| `veh_player_chassis_v004`         | Cohesive chassis with two built-in wheels     | OpenAI built-in `image_gen`, corrective pass | 1254 master / 1024 runtime | v004    | superseded            | —              |
| `veh_player_chassis_v005`         | Chassis with standard battery and module rail | OpenAI built-in `image_gen`, edit pass       | 1254 master / 1024 runtime | v005    | accepted / integrated | `GameRenderer` |
| `enm_basic_motion_v002`           | モスモコ motion poses                         | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_rusher_motion_v002`          | ハナツノ motion poses                         | OpenAI built-in `image_gen`, corrective pass | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_heavy_motion_v002`           | ガレキガメ motion poses                       | OpenAI built-in `image_gen`, corrective pass | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_artillery_motion_v002`       | ホウシダケ motion poses                       | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_bomber_motion_v002`          | バクレツミ motion poses                       | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_kawaii_fortress_motion_v002` | Boss motion poses                             | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `boss_phase_aura_v001`            | Boss Core aura for phases 1–3                 | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v001    | accepted / integrated | `GameRenderer` |

Prompt source:
[`character_motion_prompts_v002.md`](../../artifacts/animation/prompts/character_motion_prompts_v002.md)
and
[`player_rig_parts_prompt_v003.md`](../../artifacts/animation/prompts/player_rig_parts_prompt_v003.md)
and
[`player_chassis_prompt_v004.md`](../../artifacts/animation/prompts/player_chassis_prompt_v004.md)
and
[`player_chassis_prompt_v005.md`](../../artifacts/animation/prompts/player_chassis_prompt_v005.md)
and
[`boss_phase_aura_prompt_v001.md`](../../artifacts/animation/prompts/boss_phase_aura_prompt_v001.md)

## Review lock

- Kawaii and living silhouette lead the design.
- Stone, ruin and old-world accessories remain below 15 percent.
- No frame may introduce a different face, palette, scale or ground baseline.
- Runtime review is required at desktop and mobile-landscape sizes.
- Generated effects are not embedded in the character sheets.

## Review result

- Runtime masters: `artifacts/animation/masters/*_v002_chroma.png`
- Runtime alpha: `public/assets/animation/*_v002.png`
- Desktop review: `artifacts/animation/review/combat_motion_1440x900_v002.png`
- Mobile review: `artifacts/animation/review/combat_motion_844x390_v002.png`
- Inertia review: `artifacts/animation/review/caravan_inertia_1440x900_v003.png`
- Chassis review: `artifacts/animation/review/caravan_chassis_1440x900_v004.png`
- Wheel-axis review: `artifacts/animation/review/caravan_wheel_axes_1440x900_v004.png`
- Standard battery review: `artifacts/animation/review/caravan_battery_1440x900_v005.png`
- Mounted module review: `artifacts/animation/review/caravan_module_mounted_1440x900_v005.png`
- Boss aura master review: `artifacts/animation/review/boss_phase_aura_sheet_v001.png`
- Boss phase desktop comparison: `artifacts/animation/review/boss_phase_desktop_comparison_v001.png`
- Boss phase mobile comparison: `artifacts/animation/review/boss_phase_mobile_comparison_v001.png`
- Player, Basic, Artillery, Bomber and Boss passed the first generation review.
- Rusher was regenerated because it read as a generic fox-like creature.
- Heavy was regenerated because its shell read as a vehicle rather than a living
  tortoise.
- A narrow chroma-derived contact line remains on a few master poses; it is not
  visually dominant at runtime size and remains a future edge-cleanup task.
- Player locomotion no longer uses the v002 `move` pose. The v004 cohesive
  chassis is combined only with the v003 exhaust parts at runtime.
- v004 replaces the overlaid wheel approach. Its wheels and fenders are one
  cohesive illustration; only small Hub markers rotate at measured anchors.
- Runtime Hub centers at 1024px are Rear `(188.7, 782.5)` and Front
  `(547.7, 782.0)`. `debug=motion` draws their shared axis and center crosses.
- v005 restores the original cyan-cell/purple-box power unit as standard
  Caravan hardware. Acquired modules use four measured mounting positions and
  are trapped between a rear connector, cradle, coral retainers and cyan bolts;
  reward-card art is never drawn as a bare side decal.
- v005 Hub centers at 1024px are Rear `(187.8, 781.3)` and Front
  `(546.0, 780.8)`; runtime intentionally shares their averaged Y axis.
- Boss Phase 1–3 use one three-cell generated aura sheet. The runtime crops each
  square cell, anchors it to the pose-specific chest Core, and increases scale,
  alpha, pulse, and rotation speed by phase. `bossPhase=1|2|3` enables the
  presentation-only preview without changing Simulation state.
