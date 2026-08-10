# Animation Asset Registry

Generated character motion assets are reviewed at master resolution, converted
from chroma-key to alpha, and then assigned in `src/render/animationAssets.ts`.

| asset_id                          | purpose                             | generation_source                            | resolution                 | version | status                | used_by        |
| --------------------------------- | ----------------------------------- | -------------------------------------------- | -------------------------- | ------- | --------------------- | -------------- |
| `veh_player_motion_v002`          | Player idle/move/brace/recoil poses | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_basic_motion_v002`           | モスモコ motion poses               | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_rusher_motion_v002`          | ハナツノ motion poses               | OpenAI built-in `image_gen`, corrective pass | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_heavy_motion_v002`           | ガレキガメ motion poses             | OpenAI built-in `image_gen`, corrective pass | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_artillery_motion_v002`       | ホウシダケ motion poses             | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_bomber_motion_v002`          | バクレツミ motion poses             | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |
| `enm_kawaii_fortress_motion_v002` | Boss motion poses                   | OpenAI built-in `image_gen`                  | 1254 master / 1024 runtime | v002    | accepted / integrated | `GameRenderer` |

Prompt source:
[`character_motion_prompts_v002.md`](../../artifacts/animation/prompts/character_motion_prompts_v002.md)

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
- Player, Basic, Artillery, Bomber and Boss passed the first generation review.
- Rusher was regenerated because it read as a generic fox-like creature.
- Heavy was regenerated because its shell read as a vehicle rather than a living
  tortoise.
- A narrow chroma-derived contact line remains on a few master poses; it is not
  visually dominant at runtime size and remains a future edge-cleanup task.
