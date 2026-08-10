export class SpriteAssetManager {
  private readonly images = new Map<string, HTMLImageElement>();
  private readonly failedSources = new Set<string>();

  preload(sources: Iterable<string>): void {
    for (const source of sources) this.load(source);
  }

  get(source: string): HTMLImageElement | undefined {
    const image = this.images.get(source) ?? this.load(source);
    return image.complete && image.naturalWidth > 0 ? image : undefined;
  }

  getDiagnostics(): Readonly<{
    totalSources: number;
    readySources: number;
    failedSources: string[];
  }> {
    let readySources = 0;
    for (const image of this.images.values()) {
      if (image.complete && image.naturalWidth > 0) readySources += 1;
    }
    return {
      totalSources: this.images.size,
      readySources,
      failedSources: [...this.failedSources].sort(),
    };
  }

  dispose(): void {
    this.images.clear();
    this.failedSources.clear();
  }

  private load(source: string): HTMLImageElement {
    const existing = this.images.get(source);
    if (existing) return existing;
    const image = new Image();
    image.decoding = 'async';
    image.addEventListener(
      'load',
      () => {
        if (image.naturalWidth > 0) this.failedSources.delete(source);
        else this.failedSources.add(source);
      },
      { once: true },
    );
    image.addEventListener('error', () => this.failedSources.add(source), {
      once: true,
    });
    image.src = source;
    this.images.set(source, image);
    return image;
  }
}
