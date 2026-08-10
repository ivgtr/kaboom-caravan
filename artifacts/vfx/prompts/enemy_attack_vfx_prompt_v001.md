# Enemy Attack VFX Prompt v001

Use case: stylized-concept  
Asset type: production 2D game VFX sprite-sheet master for Kaboom Caravan

Input images:

- Image 1 is a style and palette reference for the kawaii mushroom artillery monster only.
- Image 2 is a style, palette, and glowing-core reference for the kawaii guardian boss only.
- Do not draw either character.

## Primary request

Create exactly SIX isolated combat VFX graphics arranged as a strict 3-row by
2-column grid. Every cell must have the same square safe area, identical center
alignment, and generous separation. Left column is the flying PROJECTILE. Right
column is the matching IMPACT burst.

### Row 1 — Artillery Spore

Left: one compact mint-and-cyan glowing spore orb traveling toward the left,
rounded readable silhouette, two or three soft leaf-like energy fins and a short
right-side trail.

Right: matching spore impact, circular mint/cyan splash with lavender accent
petals and a hollow readable center; no smoke cloud.

### Row 2 — Boss Core

Left: one dense cyan core projectile traveling toward the left, warm-ivory
mechanical collar fragments, deep-navy outline, small coral accent, short
right-side energy trail.

Right: matching cyan core impact ring, rounded mechanical energy arcs,
warm-yellow sparks, coral accent; powerful but clean.

### Row 3 — Boss Phase 3 Burst

Left: one overdrive projectile traveling toward the left, coral and warm-yellow
outer blades around a cyan core, deep-navy hardware, short right-side speed
trail.

Right: matching overdrive impact, larger coral/yellow starburst plus cyan core
ring, strongest intensity of all rows, still kawaii and readable.

## Style lock

Stylized kawaii Japanese cartoon game VFX. Cute mechanical garage aesthetic.
Thick consistent deep-navy outlines, chunky rounded shapes, soft toon shading,
bold silhouette, minimal surface noise. Kawaii 60%, mechanical 25%, hardcore
15%. Same visual family as the references. Bright and playful, not childish.
Effects must remain readable at 24–48 px.

## Layout

Square canvas. Exact 3x2 grid. No grid lines or panels. Each subject occupies
about 58–68 percent of its cell. At least 12 percent safe margin inside every
cell. No overlap between cells. Keep projectile trails inside their own cells.
All six graphics must be fully visible and centered.

## Background

Perfectly flat solid chroma-key magenta `#ff00ff` across the entire canvas and
every gap, including hollow centers. No shadows, gradients, texture, reflections,
floor plane, or lighting variation in the background. Do not use `#ff00ff` inside
any effect.

## Constraints

No characters. No weapons. No environment. No text, letters, numbers, logo,
watermark, UI frame, screen mockup, realistic fire, realistic smoke,
photorealism, stone, rust, grime, military HUD, or tiny debris noise.

## Generation record

- Source: OpenAI built-in `image_gen`
- Generated master: 1254 × 1254 PNG
- Reference assets:
  - `public/assets/animation/enm_artillery_motion_v002.png`
  - `public/assets/animation/enm_kawaii_fortress_motion_v002.png`
- Master archive:
  `artifacts/vfx/masters/vfx_enemy_attack_families_v001_chroma.png`
