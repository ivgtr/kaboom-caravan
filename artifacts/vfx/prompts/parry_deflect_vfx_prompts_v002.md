# Parry deflection VFX prompts v002

Generation source: OpenAI built-in `image_gen`

Reference assets:

- `public/assets/vfx/vfx_energy_pair_v001.png`
- `public/assets/vfx/vfx_explosive_pair_v001.png`
- `public/assets/animation/veh_player_chassis_v005.png`

The ready and success poses are intentionally generated as separate standalone
assets. They must not be recombined into a pair sheet because the previous
sheet allowed artwork from one cell to leak into the other.

## Active parry swipe

```text
Use case: stylized-concept
Asset type: production standalone 2D game VFX sprite for Kaboom Caravan
Input images: Image 1 and Image 2 are exact runtime VFX style references. Image
3 is the player caravan palette, scale, and right-facing direction reference.

Primary request: Create exactly ONE isolated cartoon active-parry swipe effect.
This is a quick mechanical counter-swipe that knocks an incoming attack away;
it is not a shield and not a protective barrier.

Subject: one compact diagonal deflection stroke beginning near the lower-left
contact point and sweeping sharply toward the upper-right, with a small
warm-ivory contact flash at the lower-left, two chunky cyan/mint swipe blades,
one short coral accent edge, and three restrained warm-yellow ricochet sparks
traveling upper-right. The silhouette must communicate “swat / knock away”
through a clear directional arc.

Style/medium: Kawaii Japanese cartoon game VFX matching the references: thick
clean deep-navy contour, rounded chunky shapes, soft toon shading, cute
mechanical garage aesthetic, bright readable silhouette, no realism.

Composition/framing: exactly one effect centered in a square canvas. Direction
lower-left to upper-right. Subject occupies 58-66 percent of canvas, with at
least 16 percent empty safe margin on every edge. All components form one
compact connected action cluster. Runtime size 90-180px.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local
removal, with no gradient, texture, shadow, floor, reflection, lighting
variation, or vignette.

Constraints: opaque crisp main shapes; no translucent outer glow; do not use
#ff00ff in the effect; exactly one effect; no second pose; no separated
alternate effect; no text; no logo; no watermark; no character; no vehicle; no
weapon; no scenery.

Avoid: circle, full ring, broken ring, shield, barrier, bubble, halo, radial
burst, centered explosion, armor petals, magic glyph, cyberpunk HUD, thin
procedural rays, random debris field, mirrored duplicate, two-column layout,
sprite sheet, grid, panel.
```

Generated master:
`artifacts/vfx/masters/vfx_parry_swipe_ready_v002_chroma.png`

Runtime asset:
`public/assets/vfx/vfx_parry_swipe_ready_v002.png`

## Perfect-parry deflection

```text
Use case: stylized-concept
Asset type: production standalone 2D perfect-parry success VFX sprite for
Kaboom Caravan
Input images: Image 1 and Image 2 are exact runtime VFX style references. Image
3 is the player caravan palette, scale, and right-facing direction reference.

Primary request: Create exactly ONE isolated cartoon perfect-parry deflection
impact. Show an incoming attack being struck at a compact contact point and
violently ricocheting toward the upper-right. This must read as “knocked away /
reflected,” not blocked by a shield and not as a centered explosion.

Subject: a small bright warm-ivory contact star positioned in the lower-left
third; a thick coral-and-warm-yellow counter-swipe cuts diagonally upward
through it; two broad cyan/mint deflection ribbons continue from the contact
toward the upper-right; four chunky sparks and three small deep-navy impact
chips all travel in the same upper-right direction. Use one clear asymmetric
directional silhouette, with strongest energy at the contact and a tapering
exit path.

Style/medium: Kawaii Japanese cartoon game VFX matching the references: thick
clean deep-navy contour, rounded chunky shapes, soft toon shading, cute
mechanical garage aesthetic, bright readable silhouette, no realism.

Composition/framing: exactly one effect centered in a square canvas. Strong
lower-left to upper-right motion. Subject occupies 68-76 percent of canvas and
keeps at least 12 percent safe margin. All pieces belong to one compact action
and must not resemble a second pose. Runtime size 140-260px.

Scene/backdrop: perfectly flat solid #ff00ff chroma-key background for local
removal, with no gradient, texture, shadow, floor, reflection, lighting
variation, or vignette.

Constraints: opaque crisp main shapes; no translucent outer glow; do not use
#ff00ff in the effect; exactly one effect; no second pose; no separated
alternate effect; no text; no logo; no watermark; no character; no vehicle; no
weapon; no scenery.

Avoid: circle, full ring, broken ring, shield, barrier, bubble, halo, radial
burst, centered explosion, armor petals, magic glyph, cyberpunk HUD, random
debris in every direction, mirrored duplicate, two-column layout, sprite sheet,
grid, panel.
```

Generated master:
`artifacts/vfx/masters/vfx_parry_deflect_success_v002_chroma.png`

Runtime asset:
`public/assets/vfx/vfx_parry_deflect_success_v002.png`
