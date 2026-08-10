# VFX Asset Registry

| asset_id                         | purpose                            | generation_source           | resolution                         | version | status                | used_by        |
| -------------------------------- | ---------------------------------- | --------------------------- | ---------------------------------- | ------- | --------------------- | -------------- |
| `vfx_ballistic_pair_v001`        | Ballistic muzzle / impact          | OpenAI built-in `image_gen` | 1254 master / 1024 runtime         | v001    | accepted / integrated | `GameRenderer` |
| `vfx_energy_pair_v001`           | Energy muzzle / impact             | OpenAI built-in `image_gen` | 1254 master / 1024 runtime         | v001    | accepted / integrated | `GameRenderer` |
| `vfx_fire_pair_v001`             | Fire muzzle / impact               | OpenAI built-in `image_gen` | 1254 master / 1024 runtime         | v001    | accepted / integrated | `GameRenderer` |
| `vfx_explosive_pair_v001`        | Explosive muzzle / impact          | OpenAI built-in `image_gen` | 1254 master / 1024 runtime         | v001    | accepted / integrated | `GameRenderer` |
| `vfx_enemy_spore_pair_v001`      | Artillery projectile / impact      | OpenAI built-in `image_gen` | 1254 family master / 1024 runtime  | v001    | accepted / integrated | `GameRenderer` |
| `vfx_enemy_boss_core_pair_v001`  | Boss phase 1–2 projectile / impact | OpenAI built-in `image_gen` | 1254 family master / 1024 runtime  | v001    | accepted / integrated | `GameRenderer` |
| `vfx_enemy_boss_burst_pair_v001` | Boss phase 3 projectile / impact   | OpenAI built-in `image_gen` | 1254 family master / 1024 runtime  | v001    | accepted / integrated | `GameRenderer` |
| `vfx_enemy_death_pair_v001`      | Normal death puff / Boss core stop | OpenAI built-in `image_gen` | 1774×887 master / 1024×512 runtime | v001    | accepted / integrated | `GameRenderer` |

Prompt source:
[`combat_vfx_prompts_v001.md`](../../artifacts/vfx/prompts/combat_vfx_prompts_v001.md)

Enemy attack prompt source:
[`enemy_attack_vfx_prompt_v001.md`](../../artifacts/vfx/prompts/enemy_attack_vfx_prompt_v001.md)

Enemy death prompt source:
[`enemy_death_vfx_prompt_v001.md`](../../artifacts/vfx/prompts/enemy_death_vfx_prompt_v001.md)

## Runtime assignment

- Machine Cannon / Scatter Cannon: Ballistic
- Railgun: Energy
- Flamethrower: Fire
- Rocket Launcher / Mine Launcher: Explosive
- Weapon-independent enemy death: Explosive impact
- Artillery: Enemy Spore projectile / impact
- Boss phase 1–2: Enemy Boss Core projectile / impact
- Boss phase 3: Enemy Boss Burst projectile / impact
- Normal enemy death: Enemy Death Puff
- Boss death: Boss Core Collapse followed by the reusable Explosive impact
- Bomber contact death: reusable Explosive impact

Each pair sheet is cropped to a centered square within its left or right half.
Canvas adds scale, rotation, alpha, glow, shock ring, smoke, debris and ground
dust. Generated assets do not contain baked translucent glow.

## Review

- Family sheet: `artifacts/vfx/review/vfx_family_sheet_v001.png`
- Desktop combat: `artifacts/vfx/review/combat_ballistic_1184x689_v001.png`
- Mobile combat: `artifacts/vfx/review/combat_ballistic_844x390_v001.png`
- Enemy family sheet: `artifacts/vfx/review/vfx_enemy_attack_families_v001.png`
- Enemy Desktop comparison: `artifacts/vfx/review/enemy_attack_desktop_comparison_v001.png`
- Enemy Mobile Landscape comparison: `artifacts/vfx/review/enemy_attack_mobile_comparison_v001.png`
- Contact / death family sheet: `artifacts/vfx/review/vfx_enemy_death_pair_v001.png`
- Contact / death Desktop comparison: `artifacts/vfx/review/enemy_contact_death_desktop_comparison_v001.png`
- Contact / death Mobile comparison: `artifacts/vfx/review/enemy_contact_death_mobile_comparison_v001.png`
