# VFX Asset Registry

| asset_id                  | purpose                   | generation_source           | resolution                 | version | status                | used_by        |
| ------------------------- | ------------------------- | --------------------------- | -------------------------- | ------- | --------------------- | -------------- |
| `vfx_ballistic_pair_v001` | Ballistic muzzle / impact | OpenAI built-in `image_gen` | 1254 master / 1024 runtime | v001    | accepted / integrated | `GameRenderer` |
| `vfx_energy_pair_v001`    | Energy muzzle / impact    | OpenAI built-in `image_gen` | 1254 master / 1024 runtime | v001    | accepted / integrated | `GameRenderer` |
| `vfx_fire_pair_v001`      | Fire muzzle / impact      | OpenAI built-in `image_gen` | 1254 master / 1024 runtime | v001    | accepted / integrated | `GameRenderer` |
| `vfx_explosive_pair_v001` | Explosive muzzle / impact | OpenAI built-in `image_gen` | 1254 master / 1024 runtime | v001    | accepted / integrated | `GameRenderer` |

Prompt source:
[`combat_vfx_prompts_v001.md`](../../artifacts/vfx/prompts/combat_vfx_prompts_v001.md)

## Runtime assignment

- Machine Cannon / Scatter Cannon: Ballistic
- Railgun: Energy
- Flamethrower: Fire
- Rocket Launcher / Mine Launcher: Explosive
- Weapon-independent enemy death: Explosive impact

Each pair sheet is cropped to a centered square within its left or right half.
Canvas adds scale, rotation, alpha, glow, shock ring, smoke, debris and ground
dust. Generated assets do not contain baked translucent glow.

## Review

- Family sheet: `artifacts/vfx/review/vfx_family_sheet_v001.png`
- Desktop combat: `artifacts/vfx/review/combat_ballistic_1184x689_v001.png`
- Mobile combat: `artifacts/vfx/review/combat_ballistic_844x390_v001.png`
