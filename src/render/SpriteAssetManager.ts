export class SpriteAssetManager {
  private readonly images = new Map<string, HTMLImageElement>();

  preload(sources: Iterable<string>): void {
    for (const source of sources) this.load(source);
  }

  get(source: string): HTMLImageElement | undefined {
    const image = this.images.get(source) ?? this.load(source);
    return image.complete && image.naturalWidth > 0 ? image : undefined;
  }

  private load(source: string): HTMLImageElement {
    const existing = this.images.get(source);
    if (existing) return existing;
    const image = new Image();
    image.decoding = 'async';
    image.src = source;
    this.images.set(source, image);
    return image;
  }
}
