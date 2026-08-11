# Mobility and parry VFX prompts v001

Generation source: OpenAI built-in `image_gen`

Reference assets:

- `public/assets/vfx/vfx_energy_pair_v001.png`
- `public/assets/vfx/vfx_explosive_pair_v001.png`
- `public/assets/animation/veh_player_chassis_v005.png`

Both sheets were generated at 1254×1254 on a flat `#ff00ff` background,
converted to transparent PNG, and resized to 1024×1024 for runtime use.
The parry runtime sheet also clears the center-seam safety band so fragments
from one pose cannot leak into the neighboring crop.

## Boost trail pair

```text
Use case: stylized-concept
Asset type: production 2D game VFX source sheet for Kaboom Caravan

Create exactly two isolated opaque cartoon boost-trail effects on one square
canvas, arranged as a strict 2-column by 1-row sprite sheet. Both cells show
a side-view velocity ribbon pointing right. LEFT CELL is a compact continuous
stream phase. RIGHT CELL is a slightly wider surge phase with a changed ribbon
silhouette.

Match the supplied Kaboom Caravan references: kawaii Japanese cartoon game
art, thick clean deep-navy outlines, rounded chunky shapes, soft toon shading,
warm-ivory highlights, cyan and mint energy ribbons, and a few warm-yellow
mechanical chevrons. It should feel like speed emitted by a cute armored
caravan, not anime speed lines painted across the entire screen.

Each effect is centered independently inside its half, occupies 70-78 percent
of the cell width and 34-44 percent of the cell height, keeps at least 12
percent safe margin, and never crosses the center seam. Both phases use the
same apparent scale and line weight. Shapes must remain readable at 80-190px.

Perfectly flat solid #ff00ff chroma-key background with no gradients, texture,
shadows, floor, reflections, lighting variation, or vignette. All main shapes
are opaque and crisp. No translucent outer glow. Do not use #ff00ff in the
effects.

Exactly two effects. No grid line, panel, text, letters, numbers, logo,
watermark, vehicle, wheel, weapon, character, scenery, photorealism, smoke
cloud wall, thin straight procedural lines, or motion blur touching the
background.
```

Generated master:
`artifacts/vfx/masters/vfx_boost_trail_pair_v001_chroma.png`

Runtime asset:
`public/assets/vfx/vfx_boost_trail_pair_v001.png`

## Parry pair

```text
Use case: stylized-concept
Asset type: production 2D game VFX source sheet for Kaboom Caravan
Input images: Image 1 and Image 2 are the exact runtime VFX style references;
Image 3 is the player caravan palette and scale reference.

Create exactly two isolated opaque cartoon parry effects on one square canvas,
arranged as a strict 2-column by 1-row sprite sheet.

LEFT CELL — PARRY READY: a compact front-facing mechanical energy guard
centered on the vehicle, built from a thick incomplete mint-and-cyan shield
ring, three chunky warm-ivory armor petals, small deep-navy mechanical joints,
and restrained warm-yellow charge sparks. It must read as a protective timing
window, not an explosion.

RIGHT CELL — PERFECT PARRY SUCCESS: a dramatically larger special-technique
impact combining a bright warm-ivory central counter-slash, shattered cyan/mint
shield petals, a coral-and-warm-yellow impact crown, deep-navy mechanical
fragments, and a strong circular shock silhouette. It must feel celebratory
and powerful, clearly distinct from ordinary weapon impact, cute mechanical
rather than magical.

Style/medium: Kawaii Japanese cartoon game VFX matching the references exactly:
thick clean deep-navy outlines, rounded chunky shapes, soft toon shading,
bright readable silhouette, cute mechanical garage aesthetic, no realism.

Composition/framing: Each effect is centered independently inside its half and
keeps at least 12 percent safe margin. Ready effect occupies 54-62 percent of
its cell. Success effect occupies 72-78 percent. Neither crosses the center
seam.

Runtime intent: Canvas will crop each cell, scale, rotate slightly, fade, flash
the screen, and add a subtle outer ring. Effects must remain readable at
100-260px runtime size.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local
background removal. Background is one uniform color with no gradients,
texture, shadows, floor, reflections, lighting variation, or vignette.

Constraints: all main shapes opaque and crisp for chroma removal; no
translucent outer glow; do not use #ff00ff inside the effects; exactly two
effects; no grid line; no panel; no text; no letters; no numbers; no logo; no
watermark; no character; no vehicle; no weapon; no scenery.

Avoid: generic bubble shield, plain circles and triangles, thin
procedural-looking rays, fantasy magic glyphs, cyberpunk HUD, realistic sparks,
grimdark military styling, skulls, blur touching the background.
```

Generated master:
`artifacts/vfx/masters/vfx_parry_pair_v001_chroma.png`

Runtime asset:
`public/assets/vfx/vfx_parry_pair_v001.png`
