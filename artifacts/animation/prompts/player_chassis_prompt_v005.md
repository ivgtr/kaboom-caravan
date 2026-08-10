# Player chassis v005 prompt

Generation source: OpenAI built-in `image_gen`

## Battery and module-rail integration pass

```text
Use case: precise-object-edit
Asset type: production 2D side-view player vehicle sprite for Kaboom Caravan
Input images: Image 1 is the exact edit target and geometry lock. Image 2 is a
supporting reference only for the original rear battery assembly.

Edit Image 1 only by restoring a cohesive rear external power unit inspired by
Image 2: one vertical glowing cyan battery cell plus one compact purple
protective power box mounted at the back-left of the caravan. Integrate both
into the vehicle silhouette with visible dark-navy steel mounting rails, two
chunky coral clamps, a short thick cable entering the body, consistent
occlusion, and contact shadows. Add a compact vertical modular mounting rail
immediately around the rear power unit with four small clearly separated
dark-navy connector sockets, but do not install any collectible modules.

Preserve Image 1's exact vehicle body, roof socket, front, door, windows,
palette, line weight, two wheels only, wheel centers, wheel baseline, overall
1024x1024 canvas, side-view/three-quarter camera, scale, position, and empty
roof weapon socket. The front points right. Keep all new hardware behind the
rear wheel and physically attached to the body. Do not alter either wheel.

Kawaii Japanese cartoon garage vehicle, rounded chunky mechanical shapes,
warm ivory and coral body, deep navy outlines, soft toon shading. The rear
power unit must feel manufactured as part of the same vehicle, not pasted on.

Entire vehicle fully visible with generous padding; same footprint and ground
baseline as Image 1. Perfectly flat solid #ff00ff chroma-key background.
Do not use #ff00ff in the subject.

No separate floating items, sticker decals, tiny reward-card illustrations,
third wheel, cargo pile, weapon, text, logo, watermark, realistic military
styling, rust, dirt, cast shadow, or ground shadow.
```

The generated rail contains three clearly readable rear sockets. Runtime uses
those three rear positions plus one roof auxiliary cradle to support all four
MVP module slots.
