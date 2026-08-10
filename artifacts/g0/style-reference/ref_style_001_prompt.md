# REF_STYLE_001 prompt

- Use case: `stylized-concept`
- Generator: OpenAI built-in `image_gen` tool（model identifierはツールから非公開）
- Generated at: 2026-08-10T21:41:05+09:00
- Candidate file: `ref_style_001_candidate_v001.png`
- SHA-256: `377aa5625a61cb9db72c68f8b492dfe29720f06c569e91d6a5b76b24fc0af9f6`

## Base generation prompt

```text
Use case: stylized-concept
Asset type: G0 game art direction Style Reference, not a directly shipped game asset
Primary request: Create one wide gameplay art-direction reference for a 2D layered-sprite vehicle combat roguelike. A cute compact armored caravan vehicle fights three equally cute hostile scrap vehicles on a sunny abandoned highway reclaimed by nature. The player vehicle carries a comically oversized machine cannon. One enemy is being hit by a large rounded cartoon explosion with star-shaped sparks. The scene must communicate “adorable machines with absurd firepower” without rendering any words.
Scene/backdrop: bright blue sky, large soft clouds, distant simplified rounded industrial ruins, mint-green grass, small colorful flowers, peach-beige cracked highway; keep background values restrained so silhouettes remain readable.
Subject: player vehicle on the left facing right; three distinct enemy scrap vehicles approaching from the right; one oversized machine cannon; large muzzle flash; one large non-gory explosion; rounded dust and smoke shapes.
Style/medium: polished Japanese game-inspired 2D illustration designed to be reproduced as separate layered raster sprites; faux-volume through clean cel shading, subtle dark outline impression, rounded chunky proportions, soft geometric forms, large simplified mechanical components, minimal surface noise, very limited wear; cute but not childish; toy-like readability without looking like children’s plastic toys.
Composition/framing: 16:9 landscape gameplay frame, fixed 2.5D three-quarter side view, clear horizontal battlefield, all vehicles on one consistent ground line, no dramatic cinematic perspective, strong readable silhouettes at small screen size, clear separation between foreground sprites, road layer, vegetation layer, and distant background layer; leave unobstructed space for future HUD overlays near the upper corners.
Lighting/mood: bright cheerful midday lighting, visually intense and slightly absurd combat, high clarity.
Color palette: sky blue, mint green, peach beige, coral pink player accents, cool blue-violet enemies, warm yellow-orange effects; strong subject/background value contrast.
Materials/textures: clean painted toon surfaces, flat-to-soft cel shading, minimal texture noise, large readable shapes.
Constraints: this is a single coherent gameplay screenshot reference for a future 2D sprite pipeline; every object should look feasible to redraw or extract as a separate 2D layer; player and enemies must be immediately distinguishable; oversized weapon and explosive effects must dominate without hiding silhouettes; no text, no logos, no watermark, no real-world military insignia, no humans.
Avoid: photorealism, realistic military imagery, grimdark, children’s toy advertising, human anime characters, excessive surface detail, realistic dirt, dark brown wasteland, cyberpunk, pixel art, painterly blur, isometric top-down view, extreme depth of field, complex perspective that prevents 2D sprite reuse, UI text.
```

## Correction prompt

```text
Remove only the small white cat/animal mascot sitting on top of the player vehicle and remove only the small pink flag and its pole behind it. Replace those areas with coherent armored vehicle equipment and bodywork matching the existing design. Preserve all other composition and style details. Do not add characters, mascots, flags, text, logos, insignia, or watermark.
```
