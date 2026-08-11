# Mobility VFX prompt v001

Generation source: OpenAI built-in `image_gen`

Reference assets:

- `public/assets/vfx/vfx_energy_pair_v001.png`
- `public/assets/vfx/vfx_explosive_pair_v001.png`
- `public/assets/animation/veh_player_chassis_v005.png`

The sheet was generated at 1254×1254 on a flat `#ff00ff` background, converted
to transparent PNG, and resized to 1024×1024 for runtime use.

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
