# Combat VFX prompts v001

Generation source: OpenAI built-in `image_gen`

All four assets use the same production lock:

```text
Use case: stylized-concept
Asset type: production 2D VFX source sheet for Kaboom Caravan

Create exactly two isolated opaque cartoon combat effects on one square canvas,
arranged as a strict 2-column by 1-row sheet. LEFT CELL is a side-view muzzle
effect pointing right. RIGHT CELL is a centered impact effect.

Kawaii Japanese cartoon game VFX, cute mechanical garage aesthetic, bold clean
silhouette, thick deep-navy contour accents, soft toon shading, visually
compatible with warm ivory/coral Kaboom Caravan art.

Each effect is centered independently inside its half, occupies 58-66 percent
of its cell, keeps at least 14 percent safe margin, never overlaps the center
seam, and uses the same apparent scale and line weight.

These are master key poses animated later by Canvas scale, rotation, alpha,
glow, and particles. Keep the main shapes opaque and crisp for chroma removal.
Do not paint translucent outer glow.

Perfectly flat solid #ff00ff chroma-key background with no gradients, texture,
shadows, floor, reflections, lighting variation, or vignette. Do not use
#ff00ff in either effect.

Exactly two effects. No grid line, panel, frame, text, letters, numbers, weapon,
character, environment, watermark, photorealism, or blur touching background.
```

## Family additions

### Ballistic

- Muzzle: warm-white core, warm-yellow starburst, coral flame lobes, three
  deep-navy smoke pellets trailing left.
- Impact: warm-white core, sharp yellow petals, coral sparks, deep-navy debris.

### Energy

- Muzzle: white core, cyan/mint energy petals, deep-navy shock ring, electrical
  chips trailing left.
- Impact: white core, cyan radial blades, broken mint rings, navy fragments.

### Fire

- Muzzle: white ignition core, rounded yellow/coral flame tongues, soot pellets.
- Impact: white-hot center, rounded flame petals, coral tongues, navy embers.

### Explosive

- Muzzle: white core, yellow flash cone, coral pressure petals, navy shock ring
  and smoke pellets.
- Impact: oversized yellow/coral blast cloud with navy smoke and debris; heavier
  and rounder than Ballistic.
