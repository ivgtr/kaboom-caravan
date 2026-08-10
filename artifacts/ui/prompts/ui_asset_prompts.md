# UI Asset Prompts v001

Generation source: Codex built-in `imagegen` (2026-08-10). Reference image:
`artifacts/g0/style-reference/ref_style_001_candidate_v002.png`.

All prompts used the following unchanged style lock:

> Stylized kawaii cartoon game UI asset for Kaboom Caravan. Japanese game-inspired visual design. Cute mechanical garage aesthetic with rounded chunky shapes, warm ivory panels, deep navy mechanical details, coral, mint, cyan and warm yellow accents. Soft toon shading, thick clean outlines, bold readable silhouettes, simplified mechanical construction. Cute but not childish. Mechanical but not realistic military. Bright and playful rather than dark or grim. Match the attached approved Kaboom Caravan style reference exactly. Minimal surface noise. No photorealism, realistic rust, grimdark military interface, modern military HUD, cyberpunk interface, readable text, logo, or watermark.

## Control frame

Standalone reusable circular mechanical control frame. Square master; warm ivory shell, deep navy inner well, coral/mint/cyan/yellow accents; 58% clean center; few chunky bolts; supports a programmatic cooldown ring; intended display 76–152 px. Flat `#ff00ff` background. No weapon or text.

## HUD ornament

Standalone horizontal rounded HUD ornament. Warm ivory shell, deep navy outline and small coral/mint/cyan/yellow side caps. Large clean center, detail restricted to edges, reusable with CSS sizing. Flat `#ff00ff` background. No text or icons.

## Reward frame

Standalone portrait 2:3 reward frame. Thick rounded warm-ivory mechanical shell and deep-navy inner outline. Upper-middle 52% clean for equipment, clean name/effect and action zones, decoration restricted to outer 12%. Shared base for weapons/modules and programmatic rarity decoration. Flat `#ff00ff` background. No equipment or text.

## Battle Clear frame

Standalone wide 8:3 celebratory frame. Rounded ivory/coral mechanical sticker, deep navy outline, mint/cyan/yellow accents, small explosion puffs and star sparks at the ends. Central 62% × 55% kept clean for dynamic Japanese text. Flat `#ff00ff` background. No text, characters or scene.

The generated chroma masters are retained under `artifacts/ui/masters/`. Runtime assets were chroma-keyed with ImageMagick and resized; all dynamic labels, icons, equipment glyphs and meters remain SVG/CSS/HTML.
