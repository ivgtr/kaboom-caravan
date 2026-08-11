# Supply Asset Registry

- Date: 2026-08-11
- Generation source: OpenAI built-in `image_gen`
- Prompt source:
  [`supply_pickup_prompts_v001.md`](../../artifacts/supply/prompts/supply_pickup_prompts_v001.md)

| asset_id                   | purpose                   | master resolution | runtime resolution | version | status                | used_by        |
| -------------------------- | ------------------------- | ----------------- | ------------------ | ------- | --------------------- | -------------- |
| `supply_repair_kit_v001`   | 耐久を回復する修理キット  | 1254 × 1254       | 512 × 458          | v001    | accepted / integrated | `GameRenderer` |
| `supply_ammo_crate_v001`   | 弾薬を補充する弾薬箱      | 1254 × 1254       | 512 × 477          | v001    | accepted / integrated | `GameRenderer` |
| `supply_weapon_cache_v001` | 戦闘内武器3択を開く武器箱 | 1254 × 1254       | 512 × 381          | v001    | accepted / integrated | `GameRenderer` |

## Runtime assignment

- Runtime alpha assets: `public/assets/supply/*.png`
- Chroma masters: `artifacts/supply/masters/*_chroma.png`
- Mapping: `src/render/supplyAssets.ts`
- Desktop review: `artifacts/ui/review/supply_drops_1184x689.png`
- Mobile weapon-cache review: `artifacts/ui/review/weapon_cache_844x390.png`

The runtime keeps a procedural fallback for image decode failures. Generated
art supplies the object body; Canvas continues to own grounding shadow, hover,
drop burst, collection ring, and type-colored light so animation remains
dynamic and resolution-independent.
