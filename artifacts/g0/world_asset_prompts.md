# Kaboom Caravan World Asset Prompt Set v001

Generated with the built-in image generation tool on 2026-08-10. Every asset
used `artifacts/g0/style-reference/ref_style_001.png` as a style-only reference.

## Shared sprite lock

```text
Use case: stylized-concept
Asset type: production 2D game sprite
Preserve the reference's Kaboom Caravan visual language, fixed side-view camera,
proportions, bright palette, thick deep-navy linework, and soft toon shading.
Strict orthographic side view, full subject visible, centered, readable silhouette,
minimum 12 percent safe margin. Cute but not childish.
Perfectly flat solid #ff00ff chroma-key background with no shadow, gradient,
texture, floor, reflection, text, logo, watermark, photorealism, or 3D render.
```

## Player

One weaponless compact mobile-garage caravan facing right. Warm ivory body,
coral cabin, navy chassis, mint/cyan utility accents. Visible hardpoints for a
large front main weapon, roof secondary weapon, and four rear/side modules.

## Monsters

- `enm_basic`: Mint moss-and-pebble colony monster, round body and tiny feet.
- `enm_rusher`: Lean coral four-legged monster with an oversized flower horn.
- `enm_heavy`: Low indigo tortoise with a huge rubble-and-moss shell.
- `enm_artillery`: Tall lavender mushroom with a spore-launching umbrella cap.
- `enm_bomber`: Small orange-red fruit monster with a swollen explosive fruit body.
- `enm_kawaii_fortress`: Colossal lavender quadruped fused with ivory ruins,
  vines, flowers, and multiple cyan organic cores.

All monsters face left and must remain organic creatures: no wheels, cockpit,
vehicle body, soldier, or held weapon.

## Background

16:9 sunny reclaimed post-collapse highway landscape. Pale cyan sky, large soft
clouds, low-contrast rounded concrete ruins, broken elevated roads, and lush
vegetation. No foreground road, characters, UI, weapons, or explosions.

## Road

2:1 horizontal roadway tile made of warm-beige cracked concrete slabs with sparse
mint grass and tiny coral/yellow flowers. Flat readable play line, low detail,
no focal object, characters, UI, or sky.

## Integrated 2:1 Background v002

Generated with the built-in image generation tool on 2026-08-11. No input
image was supplied. The exact production prompt follows.

```text
Use case: stylized-concept
Asset type: production game environment background for Kaboom Caravan
Primary request: Create one cohesive fixed 2:1 landscape background for a colorful 2D side-view vehicle combat roguelike. This replaces separate sky and road layers, so the sky, distant environment, vegetation, and playable road must feel like one naturally illustrated scene.
Scene/backdrop: a bright post-apocalyptic overgrown highway outside a softly ruined Japanese-inspired city; rounded concrete ruins and broken elevated roadway in the far distance, reclaimed by mint-green plants; broad warm stone-and-concrete driving lane in the foreground with subtle cracks, grass at the edges, and a few small stones.
Style/medium: polished kawaii Japanese cartoon game background, hand-painted 2D animation background, soft toon shading, thick but restrained clean outlines, rounded friendly shapes, cute but not childish, same visual world as adorable armored caravans carrying absurd oversized weapons.
Composition/framing: exact 2:1 ultra-wide side-view composition, designed for a fixed gameplay viewport. Sky occupies roughly top 45 percent. Distant ruins and vegetation occupy roughly 25 percent. The playable road begins around 62 percent from the top and continues to the bottom. Keep the horizontal gameplay lane around 64 to 75 percent visually quiet and unobstructed so vehicles and monsters remain readable. Ground perspective must be coherent with a strict side-view camera, with no top-down tilt. Distribute details asymmetrically but evenly so there is no obvious central focal object and no visible tiling seam.
Lighting/mood: clear cheerful late-morning daylight, soft atmospheric perspective, gentle warm sunlight from upper left, subtle cool distance haze, energetic and hopeful rather than melancholic.
Color palette: cyan sky, warm ivory clouds, soft sage and mint foliage, warm beige-pink concrete, small coral and yellow flower accents, deep navy only in sparse shadow details.
Materials/textures: simplified weathered concrete with tasteful cracks and moss, soft painted foliage, minimal surface noise.
Output intent: production-ready full-frame raster background, master composition 2048 by 1024 pixels, all artwork extending to every canvas edge.
Constraints: no characters, no vehicles, no monsters, no weapons, no projectiles, no foreground props that block the gameplay lane, no UI, no text, no logo, no watermark. Avoid photorealism, 3D rendering, pixel art, grimdark military styling, realistic rust, muddy colors, extreme blur, excessive bloom, generic flat gradient sky, duplicated buildings, mismatched perspective, separate floating ground strip, obvious seams, and vignette.
```

V002 was rejected because its Japanese temple architecture, stronger saturation,
and higher scenic density changed the established world rather than extending it.

## Integrated 2:1 Background v003

Generated with the built-in image generation tool on 2026-08-11. Image 1 was
the original accepted background edit target. Image 2 was the original accepted
road and was used only as a material reference.

```text
Use case: compositing
Asset type: production fixed 2:1 game environment background for Kaboom Caravan
Input images:
- Image 1: EDIT TARGET and absolute world-style anchor. Preserve its landscape identity, architecture, atmosphere, palette, lighting, cloud language, and soft low-contrast rendering.
- Image 2: SUPPORTING INSERT reference only for the warm cracked road surface, small grass tufts, rocks, flowers, line weight, and material rendering.
Primary request: Reformat Image 1 into an exact 2:1 side-view gameplay background by naturally integrating a quiet foreground road based on Image 2 into only the lower portion. This is a conservative extension/composite, not a redesign.
Composition/framing: retain the broad pale cyan sky and the same distant rounded overgrown concrete ruins from Image 1 across the top approximately 62 percent. Place the playable road from approximately 62 percent to the bottom. The vehicle contact line is around 68 percent from the top. Keep the horizontal lane from 62 to 78 percent quiet, flat, and readable. Use a strict side-view presentation; adapt Image 2's stone pattern so it reads as a gently foreshortened lateral road rather than a top-down surface. Exact 2:1 ultra-wide full-frame canvas.
Preserve invariants:
- Preserve Image 1's anonymous rounded post-collapse concrete towers and broken elevated highways.
- Preserve Image 1's pale cyan, warm ivory, misty mint, soft sage, and muted beige palette.
- Preserve Image 1's bright diffuse daylight and strong atmospheric haze.
- Preserve Image 1's low contrast and sparse, calm visual density.
- Preserve the original soft painterly kawaii cartoon background style; do not increase outline thickness, saturation, sharpness, or detail density.
- Use Image 2's road material and vegetation details without copying its top-down camera angle.
Change only:
- change the canvas to exact 2:1;
- replace/extend only the lower foreground with a naturally blended playable road;
- make the transition from distant vegetation to road continuous and believable.
Hard prohibitions: no Japanese temple, pagoda, castle roof, shrine, torii, or culturally specific architecture; no new city design; no architectural restyling; no large foreground buildings; no high-saturation blue; no crisp cinematic concept-art finish; no dramatic focal landmark; no characters, vehicles, monsters, weapons, UI, text, logo, or watermark.
Avoid: changing the world setting, changing the time of day, adding decorative spectacle, strong shadows, excessive flowers, photorealism, 3D rendering, grimdark elements, seams, bands, separate floating road layer, or mismatched perspective.
Output intent: one cohesive production background whose world is immediately recognizable as Image 1, with only the necessary road integration from Image 2.
```
