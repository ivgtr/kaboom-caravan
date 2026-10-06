const MAX_PIXELS = 4_000_000;
const MAX_ENTRIES = 128;
interface PaintedSprite {
  canvas: HTMLCanvasElement;
  padding: number;
  width: number;
  height: number;
  key: string;
  variants: Map<string, PaintedSprite>;
}
interface SpriteCache {
  sources: WeakMap<HTMLCanvasElement, Map<string, PaintedSprite>>;
  recent: Set<PaintedSprite>;
  pixels: number;
}
const caches = new WeakMap<CanvasRenderingContext2D, SpriteCache>();

/** Cache soft halos at device size; always draw the original painted art unchanged. */
export function drawPaintedSprite(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const direct = () => ctx.drawImage(image, x, y, width, height);
  // Unusual compositing, filters and offset shadows retain their native draw.
  if (
    ctx.shadowBlur <= 0 ||
    ctx.globalCompositeOperation !== 'source-over' ||
    (ctx.filter && ctx.filter !== 'none') ||
    ctx.shadowOffsetX !== 0 ||
    ctx.shadowOffsetY !== 0 ||
    width <= 0 ||
    height <= 0
  )
    return direct();
  const m = ctx.getTransform();
  const sx = Math.hypot(m.a, m.b);
  const sy = Math.hypot(m.c, m.d);
  // A sheared or nearly collapsed FREEZE transform cannot preserve a circular
  // device-space blur through a cached local rectangle. Do the original draw.
  if (
    !Number.isFinite(sx + sy) ||
    width * sx < 2 ||
    height * sy < 2 ||
    Math.abs(m.a * m.c + m.b * m.d) > sx * sy * 0.000001
  )
    return direct();
  // Only soft halos are quantized; the original sprite keeps exact sampling.
  // Large cabinet glows need wider buckets to avoid a new canvas every frame
  // while they spring into view (up to 8px size / 1px blur tolerance).
  const bucket = Math.max(width * sx, height * sy) > 256 ? 16 : 4;
  const blurBucket = bucket === 16 ? 2 : 0.5;
  const pw = Math.max(bucket, Math.round((width * sx) / bucket) * bucket);
  const ph = Math.max(bucket, Math.round((height * sy) / bucket) * bucket);
  const blur = Math.round(ctx.shadowBlur / blurBucket) * blurBucket;
  if (blur === 0) return direct();
  const padding = Math.ceil(blur * 3 + 2);
  const pixels = 2 * (pw + padding * 2) * (ph + padding * 2);
  if (pixels > MAX_PIXELS) return direct();
  let cache = caches.get(ctx);
  if (!cache) {
    cache = { sources: new WeakMap(), recent: new Set(), pixels: 0 };
    caches.set(ctx, cache);
  }
  let variants = cache.sources.get(image);
  if (!variants) cache.sources.set(image, (variants = new Map()));
  const key = `${pw},${ph},${blur},${ctx.shadowColor},${ctx.imageSmoothingEnabled},${ctx.imageSmoothingQuality}`;
  let entry = variants.get(key);
  if (!entry) {
    const canvas = document.createElement('canvas');
    canvas.width = 2 * (pw + padding * 2);
    canvas.height = ph + padding * 2;
    const baked = canvas.getContext('2d');
    if (!baked) return direct();
    baked.imageSmoothingEnabled = ctx.imageSmoothingEnabled;
    baked.imageSmoothingQuality = ctx.imageSmoothingQuality;
    baked.shadowColor = ctx.shadowColor;
    baked.shadowBlur = blur;
    // Keep both source and shadow in bounds: some renderers cull offscreen
    // sources before producing their shadow. Only the right half is displayed.
    baked.shadowOffsetX = canvas.width / 2;
    baked.drawImage(image, padding, padding, pw, ph);
    entry = { canvas, padding, width: pw, height: ph, key, variants };
    while (
      cache.pixels + pixels > MAX_PIXELS ||
      cache.recent.size >= MAX_ENTRIES
    ) {
      const oldest = cache.recent.values().next().value!;
      cache.recent.delete(oldest);
      oldest.variants.delete(oldest.key);
      cache.pixels -= oldest.canvas.width * oldest.canvas.height;
    }
    variants.set(key, entry);
    cache.pixels += pixels;
  }
  cache.recent.delete(entry);
  cache.recent.add(entry);
  const dx = width / entry.width;
  const dy = height / entry.height;
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.drawImage(
    entry.canvas,
    entry.canvas.width / 2,
    0,
    entry.canvas.width / 2,
    entry.canvas.height,
    x - entry.padding * dx,
    y - entry.padding * dy,
    (entry.canvas.width / 2) * dx,
    entry.canvas.height * dy,
  );
  // Separate source-over draws preserve translucent shadow/source overlap.
  direct();
  ctx.restore();
}
