# REF_STYLE_001 V2 prompt

- Use case: `stylized-concept`
- Generator: OpenAI built-in `image_gen` tool（model identifierはツールから非公開）
- Generated at: 2026-08-10T21:52:19+09:00
- Candidate file: `ref_style_001_candidate_v002.png`
- SHA-256: `d1ad1618b7a38db162dd39a497b564596b4f9dc31559dc99b52d27618e22fcda`
- Reference: `ref_style_001_candidate_v001.png`（StyleとPaletteのみ）

## Generation prompt

```text
Use case: stylized-concept
Asset type: revised G0 gameplay Style Reference for a 2D layered-sprite combat roguelike
Input images: Image 1 is a style and palette reference only, not an edit target. Preserve its polished Japanese game-inspired 2D cel-shaded rendering, bright reclaimed-highway world, rounded shape language, fixed 2.5D side camera, and Coral/Mint/Blue-Violet/Orange harmony. Create a new coherent gameplay scene reflecting the revised art direction.
Primary request: The player is a compact armored caravan whose current build is visibly assembled from separate equipment layers. Show a coral-and-cream caravan base with clear modular attachment points: a comically oversized main machine cannon, a smaller roof-mounted secondary coil/rail weapon, an external cooling canister, and a side ammunition box. The silhouette must communicate that acquired weapons and modules physically accumulate on the caravan without becoming unreadable.
Enemies: Replace all enemy vehicles with three clearly organic fantasy monsters belonging to the same cheerful post-apocalyptic ecosystem. Show: one small round mint moss-and-scrap creature as the basic enemy; one lean coral flower-horned quadruped rushing forward; one large blue-violet rubble-shelled tortoise-like monster as the heavy enemy. They may incorporate tiny pieces of old-world scrap as natural armor, but must not look like vehicles, robots, humans, or soldiers. Cute and collectible-looking, yet dangerous rather than infantile.
Stage/background: a detailed sunny abandoned elevated highway reclaimed by mint grass and colorful flowers, layered distant rounded ruins, broken overpasses, roadside relics, parallax-friendly foreground vegetation, readable road cracks and lane remnants. Rich environmental storytelling but lower contrast and softer detail than gameplay subjects.
Effects: polished multi-layer combat VFX. The machine cannon has a white-hot core, yellow-orange jagged muzzle flash, a subtle shock ring, flying shell casing, and short rounded smoke trail. A monster is hit with bright hit sparks. Another is framed by a large non-gory explosion with white core, yellow and orange lobes, dark rounded smoke, small debris arcs, and ground dust. Effects must be dramatic but must not hide the caravan or monster silhouettes.
UI concept: include a refined game HUD frame integrated at the screen edges: an upper-left caravan status cluster with four icon-led resource bars, a top-center ten-battle route/progress strip, a compact upper-right stage/threat panel, and bottom-corner weapon/module slots with cooldown rings. Use decorative shapes, icons, bars, pips, and empty label spaces only; no readable words, letters, or numbers inside the generated image. Keep the central battlefield unobstructed.
Style/medium: polished 2D raster game illustration feasible to reproduce as separate sprites and UI panels; clean cel shading, subtle dark outlines, rounded chunky caravan machinery, soft organic monster shapes, strong small-screen silhouettes, moderate detail density, no painterly blur.
Composition/framing: 16:9 landscape, caravan on the left facing right, three monsters advancing from the right, all on a consistent ground line, fixed horizontal battlefield with no dramatic cinematic perspective. Leave clear separation between background, road, foreground, caravan base, each weapon/module, monsters, effects, and HUD layers.
Color palette: coral and warm cream for the player; mint and fresh greens for basic organic enemies and vegetation; blue-violet for heavy threats; white/yellow/orange for weapon effects; dark navy outlines and HUD structure.
Constraints: player is one modular caravan, not a single sports car or tank; every installed weapon and module must read as an added component; enemies are monsters, never vehicles; no humans, mascots, military insignia, logos, watermark, readable text, gore, realistic weapons, grimdark, cyberpunk, toy advertisement, pixel art, isometric top-down camera, or excessive surface noise.
```
