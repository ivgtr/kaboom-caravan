import { afterEach, describe, expect, it, vi } from 'vitest';
import { drawPaintedSprite } from './sprite';

function context() {
  const state = {
    shadowBlur: 8,
    shadowColor: '#ffc957',
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    filter: 'none',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'low',
    getTransform: vi.fn(() => ({ a: 1, b: 0, c: 0, d: 1 })),
    drawImage: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
  };
  let blur = state.shadowBlur;
  state.save.mockImplementation(() => {
    blur = state.shadowBlur;
  });
  state.restore.mockImplementation(() => {
    state.shadowBlur = blur;
  });
  return state as unknown as CanvasRenderingContext2D;
}
function setup() {
  const canvases: HTMLCanvasElement[] = [];
  const contexts: CanvasRenderingContext2D[] = [];
  const create = vi.spyOn(document, 'createElement').mockImplementation(() => {
    const baked = context();
    const canvas = {
      width: 1,
      height: 1,
      getContext: () => baked,
    } as unknown as HTMLCanvasElement;
    contexts.push(baked);
    canvases.push(canvas);
    return canvas;
  });
  const ctx = context();
  const image = {} as HTMLCanvasElement;
  const draw = (width = 20, height = 30) =>
    drawPaintedSprite(ctx, image, 10, 15, width, height);
  return { create, canvases, contexts, ctx, image, draw };
}
afterEach(() => vi.restoreAllMocks());

describe('painted sprite glow cache', () => {
  it('reuses halos across translation, rotation and flips', () => {
    const { ctx, image, create, contexts, draw } = setup();
    draw();
    vi.mocked(ctx.getTransform).mockReturnValue({
      a: 0,
      b: -1,
      c: -1,
      d: 0,
      e: 99,
      f: 77,
    } as DOMMatrix);
    draw();
    expect(create).toHaveBeenCalledTimes(1);
    expect(contexts[0]!.drawImage).toHaveBeenCalledExactlyOnceWith(
      image,
      26,
      26,
      20,
      32,
    );
    expect(ctx.shadowBlur).toBe(8);
    expect(ctx.getTransform()).toMatchObject({ a: 0, b: -1, c: -1, d: 0 });
  });

  it.each([12, 60, 80])(
    'bakes %ipx sources fully in bounds, outside the displayed halo region',
    (width) => {
      const { contexts, canvases, draw } = setup();
      draw(width, width);
      const canvas = canvases[0]!;
      const [, x, y, w, h] = vi.mocked(contexts[0]!.drawImage).mock
        .calls[0]! as unknown as [
        HTMLCanvasElement,
        number,
        number,
        number,
        number,
      ];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThan(canvas.width / 2);
      expect(y + h).toBeLessThan(canvas.height);
      expect(contexts[0]!.shadowOffsetX).toBe(canvas.width / 2);
    },
  );

  it('keeps the exact footprint with fractional size and nonuniform scale', () => {
    const { ctx, canvases } = setup();
    vi.mocked(ctx.getTransform).mockReturnValue({
      a: 0,
      b: -2,
      c: 3,
      d: 0,
    } as DOMMatrix);
    drawPaintedSprite(ctx, {} as HTMLCanvasElement, 12, -36, 24.2, 35.8);
    const [canvas, cropX, cropY, cropWidth, cropHeight, x, y, width, height] =
      vi.mocked(ctx.drawImage).mock.calls[0]! as unknown as [
        HTMLCanvasElement,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
    expect(canvas).toBe(canvases[0]);
    expect(cropX).toBe(canvas.width / 2);
    expect(cropY).toBe(0);
    expect(cropWidth).toBe(canvas.width / 2);
    expect(cropHeight).toBe(canvas.height);
    expect(x + (26 / cropWidth) * width).toBeCloseTo(12);
    expect(y + (26 / canvas.height) * height).toBeCloseTo(-36);
    expect((48 / cropWidth) * width).toBeCloseTo(24.2);
    expect((108 / canvas.height) * height).toBeCloseTo(35.8);
  });

  it('buckets nearby animation sizes and blur but retains exact destination bounds', () => {
    const { ctx, create, draw } = setup();
    draw(20.1, 30.1);
    ctx.shadowBlur = 8.1;
    draw(20.3, 30.3);
    expect(create).toHaveBeenCalledTimes(1);
    draw(23, 30);
    expect(create).toHaveBeenCalledTimes(2);
  });

  it('reuses a halo while applying changing alpha separately to shadow and source', () => {
    const { ctx, image, create, draw } = setup();
    const compositing: number[][] = [];
    vi.mocked(ctx.drawImage).mockImplementation(() => {
      compositing.push([ctx.globalAlpha, ctx.shadowBlur]);
    });
    ctx.globalAlpha = 0.58;
    draw();
    expect(ctx.drawImage).toHaveBeenLastCalledWith(image, 10, 15, 20, 30);
    ctx.globalAlpha = 0.8;
    draw();
    expect(create).toHaveBeenCalledTimes(1);
    expect(ctx.drawImage).toHaveBeenCalledTimes(4);
    expect(ctx.globalAlpha).toBe(0.8);
    expect(compositing).toEqual([
      [0.58, 0],
      [0.58, 0],
      [0.8, 0],
      [0.8, 0],
    ]);
    expect(ctx.shadowBlur).toBe(8);
  });

  it('supports browsers without a Canvas filter property', () => {
    const { ctx, create, draw } = setup();
    Object.assign(ctx, { filter: undefined });
    draw();
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('separates source identity, context, shadow color and sampling', () => {
    const { ctx, image, create, draw } = setup();
    draw();
    drawPaintedSprite(ctx, {} as HTMLCanvasElement, 10, 15, 20, 30);
    drawPaintedSprite(context(), image, 10, 15, 20, 30);
    ctx.shadowColor = '#ff0000';
    draw();
    ctx.imageSmoothingEnabled = false;
    draw();
    expect(create).toHaveBeenCalledTimes(5);
  });

  it.each([
    { shadowBlur: 0 },
    { shadowBlur: 0.1 },
    { globalCompositeOperation: 'lighter' },
    { filter: 'brightness(2)' },
    { shadowOffsetX: 2 },
    { shadowOffsetY: 2 },
  ])('retains the native draw and glow for unsupported state %o', (state) => {
    const { ctx, image, create, draw } = setup();
    Object.assign(ctx, state);
    draw();
    expect(create).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledExactlyOnceWith(
      image,
      10,
      15,
      20,
      30,
    );
    expect(ctx).toMatchObject(state);
  });

  it.each([
    { a: 1, b: 0, c: 0, d: 0.002 },
    { a: 1, b: 0, c: 0.5, d: 1 },
    { a: 0, b: 0, c: 0, d: 0 },
  ])(
    'keeps collapsed or sheared FREEZE transforms on the native path',
    (matrix) => {
      const { ctx, image, create, draw } = setup();
      vi.mocked(ctx.getTransform).mockReturnValue(matrix as DOMMatrix);
      draw();
      expect(create).not.toHaveBeenCalled();
      expect(ctx.drawImage).toHaveBeenCalledExactlyOnceWith(
        image,
        10,
        15,
        20,
        30,
      );
    },
  );

  it('bounds variant count and evicts the least recently used silhouette', () => {
    const { ctx, create, draw } = setup();
    for (let i = 0; i < 128; i++) {
      ctx.shadowColor = `color-${i}`;
      draw();
    }
    ctx.shadowColor = 'color-0';
    draw(); // Refresh the oldest entry before overflowing the cache.
    ctx.shadowColor = 'color-128';
    draw();
    ctx.shadowColor = 'color-0';
    draw();
    expect(create).toHaveBeenCalledTimes(129);
    ctx.shadowColor = 'color-1';
    draw();
    expect(create).toHaveBeenCalledTimes(130);
  });

  it('bounds total backing pixels and passes oversized sprites through', () => {
    const { ctx, image, create, draw } = setup();
    for (let i = 0; i < 4; i++) {
      ctx.shadowColor = `color-${i}`;
      draw(1000, 1000);
    }
    ctx.shadowColor = 'color-0';
    draw(1000, 1000);
    expect(create).toHaveBeenCalledTimes(5);
    draw(3000, 3000);
    expect(create).toHaveBeenCalledTimes(5);
    expect(ctx.drawImage).toHaveBeenLastCalledWith(image, 10, 15, 3000, 3000);
  });
});
