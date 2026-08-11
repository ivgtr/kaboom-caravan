# Supply Pickup Prompts v001

Generation source: OpenAI built-in `image_gen` (2026-08-11).

References:

- `artifacts/g0/style-reference/ref_style_001_candidate_v002.png`
- `public/assets/equipment/mod_ammo_box_v001.png`
- `public/assets/equipment/wpn_railgun_v001.png`

## Shared style lock

> Standalone 2D in-world pickup sprite for Kaboom Caravan, displayed at
> approximately 28–54 px. Match the approved overall style reference: polished
> kawaii Japanese cartoon game sprite, soft toon shading, thick clean deep-navy
> outline, rounded simplified mechanical construction, cute but not childish.
> Square 1024 × 1024 requested master, three-quarter view from slightly above,
> centered and fully visible with 72–78% subject occupancy and at least 12% safe
> margin. Perfectly flat solid `#ff00ff` chroma-key background with no shadow,
> gradient, texture, floor, reflection, or lighting variation. One complete
> physical object only. No text, logo, watermark, vehicle, character, rust,
> grime, military realism, cyberpunk styling, smoke, or particles.

## Repair kit

> Create a compact emergency repair-kit pickup as a complete physical object,
> not a UI icon or flat badge. A chunky rounded portable mechanic toolbox with a
> sturdy top handle, warm-ivory body, coral corner guards, deep-navy base and
> latches, one large simple repair cross inset on the front, and one small
> wrench-shaped side detail. Make the toolbox silhouette unmistakable at 32 px.
> Use restrained mint and cyan indicator accents. Do not use magenta in the
> object.

## Ammo crate

> Create a compact ammunition-supply pickup as a complete portable physical
> object, not a UI icon or flat badge. A squat rounded ammunition crate with a
> fold-down carry handle, warm-ivory shell, warm-yellow reinforced lid,
> deep-navy base, and one coral latch. The front has one large protected rack
> showing exactly three oversized golden cartridge silhouettes. Make its
> silhouette wider and lower than the repair toolbox and unmistakable at 32 px.
> Do not place loose ammunition outside the crate or use magenta in the object.

## Weapon cache

> Create a special weapon-cache pickup as a complete valuable physical object,
> not a UI icon, generic treasure chest, or flat badge. Use an asymmetric
> capsule-like silhouette with a sturdy top grip, warm-ivory armored shell, mint
> corner guards, deep-navy base, coral locking bands, and a large cyan glowing
> central viewing window. Inside the window show one bold abstract cannon
> silhouette without fine detail. Add a simple five-point reward-star metal lock
> below the window. It must read as rarer and more technologically valuable than
> ordinary repair and ammo crates at 32 px. No open lid, loose weapon, wooden
> chest, coins, or magenta in the object.

## Post-processing

The built-in output was 1254 × 1254. The installed chroma helper could not run
because this environment has neither Pillow nor `uv`, so the repository's
existing ImageMagick path was used: 30% magenta-key tolerance, alpha trim, and a
maximum runtime edge of 512 px. Transparent corners and runtime rendering were
reviewed after conversion.
