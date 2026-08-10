const ENEMY_ENTRY_SECONDS = 0.8;

export function getEnemyEntryX(
  targetX: number,
  viewportWidth: number,
  spriteSize: number,
  spawnAgeSeconds: number,
): number {
  const progress = Math.min(
    1,
    Math.max(0, spawnAgeSeconds / ENEMY_ENTRY_SECONDS),
  );
  const easedProgress = 1 - (1 - progress) ** 3;
  const outsideRightX = viewportWidth + spriteSize * 0.55 + 12;
  return outsideRightX + (targetX - outsideRightX) * easedProgress;
}
