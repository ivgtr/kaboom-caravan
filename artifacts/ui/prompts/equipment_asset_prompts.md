# Equipment Asset Prompts v001

Generation source: Codex built-in `imagegen` (2026-08-10). Reference:
`artifacts/g0/style-reference/ref_style_001_candidate_v002.png`.

Each asset was generated in a separate built-in call. The following invariant block was preserved:

> Standalone polished kawaii cartoon 2D equipment cutout for Kaboom Caravan. Match the approved reference palette, outline and proportions. Soft toon shading, thick clean deep-navy outline, chunky rounded simplified mechanical shapes. Square master, three-quarter view, centered, fully visible, 68–76% subject occupancy and 10–14% safe margin. Bright soft lighting and a silhouette readable at 64px. Perfectly flat `#ff00ff` background with no shadow, gradient, floor or texture. Warm ivory, coral, deep navy, mint, cyan and warm yellow. No vehicle, character, text, logo, watermark, military realism, rust, grime or cyberpunk styling.

## Subject prompts

| asset_id               | subject correction                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| wpn_machine_cannon     | One short automatic cannon; bold barrel, coral receiver, ivory plates, mint ammunition feed |
| wpn_scatter_cannon     | Exactly three short fan-arranged muzzles; squat receiver and yellow shell drum              |
| wpn_flamethrower       | Flared nozzle, twin fuel canisters and restrained heat bands; no active flame               |
| wpn_rocket_launcher    | Exactly four dominant launcher tubes on a compact swivel; no rockets or smoke               |
| wpn_railgun            | Long tapered cannon, three cyan coil segments and compact power cell; no beam               |
| wpn_mine_launcher      | Tilted three-mine drum and downward deployment chute; no loose mines                        |
| mod_cooling_fan        | Five-blade mint fan inside an ivory protective ring                                         |
| mod_generator          | Cyan coil window with twin cylinder housings and energy cells                               |
| mod_ammo_box           | Ivory storage case with three oversized yellow shells in an open rack                       |
| mod_armor              | Three curved physical armor plates with shock absorbers                                     |
| mod_shield_generator   | Cyan energy disk in an ivory emitter ring; no surrounding force field                       |
| mod_radar              | Mint radar dish on a rounded swivel base                                                    |
| mod_heat_recycler      | Coral heat intake feeding three mint pipes into a cyan recovery cell                        |
| mod_capacitor          | Two oversized cyan capacitor cylinders with coral clamps                                    |
| mod_magnetic_armor     | Curved plates around large cyan electromagnet coils                                         |
| mod_explosive_magazine | Reinforced coral drum overstuffed with three yellow explosive shells                        |

Chroma masters are under `artifacts/ui/masters/`. Runtime files were keyed, trimmed and resized to a maximum 512×512 with ImageMagick because the environment did not provide Pillow for the skill helper.
