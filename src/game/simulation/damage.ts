export function resolveDamage(rawDamage: number, armor: number): number {
  if (rawDamage <= 0) return 0;
  return Math.max(1, rawDamage - Math.max(0, armor));
}
