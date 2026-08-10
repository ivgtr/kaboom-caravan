export interface CameraShakeSpec {
  durationSeconds: number;
  amplitudePixels: number;
}

export interface CameraShakeOffset {
  x: number;
  y: number;
}

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

export function getEnemyHitStopDuration(
  damage: number,
  reducedMotion: boolean,
): number {
  const resolvedDamage = Math.max(0, damage);
  if (reducedMotion) {
    return clamp(0.022 + resolvedDamage * 0.0003, 0.022, 0.035);
  }
  return clamp(0.046 + resolvedDamage * 0.0009, 0.046, 0.08);
}

export function getPlayerDamageShake(
  damage: number,
  reducedMotion: boolean,
): CameraShakeSpec {
  const resolvedDamage = Math.max(0, damage);
  if (reducedMotion) {
    return {
      durationSeconds: 0.1,
      amplitudePixels: clamp(0.8 + resolvedDamage * 0.015, 0.8, 1.3),
    };
  }
  return {
    durationSeconds: clamp(0.17 + resolvedDamage * 0.0018, 0.17, 0.23),
    amplitudePixels: clamp(2.8 + resolvedDamage * 0.14, 3.2, 8),
  };
}

export function getCameraShakeOffset(
  ageSeconds: number,
  spec: CameraShakeSpec,
  phaseRadians: number,
): CameraShakeOffset {
  if (
    ageSeconds < 0 ||
    spec.durationSeconds <= 0 ||
    ageSeconds >= spec.durationSeconds
  ) {
    return { x: 0, y: 0 };
  }
  const progress = ageSeconds / spec.durationSeconds;
  const envelope = (1 - progress) ** 2;
  const amplitude = spec.amplitudePixels * envelope;
  return {
    x: Math.sin(ageSeconds * 92 + phaseRadians) * amplitude,
    y: Math.cos(ageSeconds * 117 + phaseRadians * 1.37) * amplitude * 0.62,
  };
}
