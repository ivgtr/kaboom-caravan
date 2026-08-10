type RuntimeAssetPath = `assets/${string}`;

export function runtimeAssetUrl(path: RuntimeAssetPath): string {
  return `${import.meta.env.BASE_URL}${path}`;
}
