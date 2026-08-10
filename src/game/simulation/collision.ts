export function isWithinRange(
  sourcePosition: number,
  targetPosition: number,
  range: number,
): boolean {
  return Math.abs(targetPosition - sourcePosition) <= range;
}

export function circlesOverlap1d(
  leftPosition: number,
  leftRadius: number,
  rightPosition: number,
  rightRadius: number,
): boolean {
  return Math.abs(rightPosition - leftPosition) <= leftRadius + rightRadius;
}

export function segmentIntersectsCircle1d(
  segmentStart: number,
  segmentEnd: number,
  circlePosition: number,
  circleRadius: number,
): boolean {
  const minimum = Math.min(segmentStart, segmentEnd) - circleRadius;
  const maximum = Math.max(segmentStart, segmentEnd) + circleRadius;
  return circlePosition >= minimum && circlePosition <= maximum;
}
