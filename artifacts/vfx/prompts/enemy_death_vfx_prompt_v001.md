# Enemy Death VFX Prompt v001

Use case: stylized-concept  
Asset type: production 2D death VFX pair sheet for Kaboom Caravan

Input images:

- Image 1 is a style, outline, palette, and soft organic-shape reference for the small kawaii monsters only.
- Image 2 is a style, palette, and cyan mechanical-core reference for the kawaii guardian boss only.
- Do not draw either character.

## Primary request

Create exactly TWO isolated game VFX graphics arranged as a strict 1-row by
2-column grid. Both cells must have identical square safe areas, center
alignment, scale discipline, and generous separation.

### Left cell — Normal Monster Death Puff

A compact rounded mint-and-warm-ivory cartoon disappearance puff, made from five
to seven soft cloud lobes, two small leaf-shaped wisps, a few coral and
warm-yellow star sparks, and three tiny deep-navy rounded debris pebbles.
Hollow/airy center so it reads as a creature vanishing rather than an explosion.
No monster body, no face, no realistic smoke.

### Right cell — Boss Core Collapse

A larger cyan mechanical energy core shutting down and collapsing inward.
Deep-navy rounded mechanical ring segments, warm-ivory collar fragments, dim
cyan center, two coral warning sparks, and a restrained outer lavender energy
ripple. It must read as core power stopping before a later large explosion, not
as a projectile and not as a fiery explosion.

## Style lock

Stylized kawaii Japanese cartoon game VFX. Cute mechanical garage aesthetic.
Kawaii 60%, mechanical 25%, hardcore 15%. Thick consistent deep-navy outlines,
chunky rounded shapes, soft toon shading, bold readable silhouettes, minimal
surface noise. Bright and playful, not childish. Same visual family as the
references and existing Kaboom Caravan VFX. Readable at 32–96 px.

## Layout

Square canvas, exact 1x2 grid, no grid line or panels. Each effect occupies
58–68 percent of its cell. At least 14 percent safe margin inside each cell. No
overlap. Both effects fully visible and centered.

## Background

Perfectly flat solid chroma-key magenta `#ff00ff` across the entire canvas and
every gap, including hollow centers. No shadows, gradients, texture, reflections,
floor plane, or lighting variation in the background. Do not use `#ff00ff` inside
either effect.

## Constraints

No characters, faces, bodies, weapons, environment, text, letters, numbers,
logo, watermark, UI frame, screen mockup, realistic fire, realistic smoke,
photorealism, stone texture, rust, grime, military HUD, skulls, bones, gore, or
tiny debris noise.

## Generation record

- Source: OpenAI built-in `image_gen`
- Generated master: 1774 × 887 PNG
- Runtime: 1024 × 512 transparent PNG
- Reference assets:
  - `public/assets/animation/enm_basic_motion_v002.png`
  - `public/assets/animation/enm_kawaii_fortress_motion_v002.png`
- Master archive:
  `artifacts/vfx/masters/vfx_enemy_death_pair_v001_chroma.png`
