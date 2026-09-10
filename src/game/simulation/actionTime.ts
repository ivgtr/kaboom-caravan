import type { PlayerCommand } from './types';

/**
 * ACTION TIME makes observation cheap and action expensive: the battlefield
 * crawls while the player is hands-off, then snaps back to real time as soon
 * as the player commits to a meaningful combat input.
 *
 * The scale is intentionally attached to commands produced by the live input
 * layer. Commands created directly by simulation tests/tools remain 1x unless
 * they opt in with `withActionTime`, which keeps the physics layer useful in
 * isolation.
 */
export const ACTION_TIME_RULES = {
  idleTimeScale: 0.08,
  committedTimeScale: 1,
} as const;

export interface ActionTimedPlayerCommand extends PlayerCommand {
  readonly worldTimeScale: number;
}

export function isActionTimeCommitted(command: PlayerCommand): boolean {
  return (
    command.move !== 0 ||
    command.firePrimary ||
    command.fireSecondary ||
    command.activateSkill ||
    command.activateBreakthrough
  );
}

export function withActionTime(
  command: PlayerCommand,
): ActionTimedPlayerCommand {
  return {
    ...command,
    worldTimeScale: isActionTimeCommitted(command)
      ? ACTION_TIME_RULES.committedTimeScale
      : ACTION_TIME_RULES.idleTimeScale,
  };
}

export function getActionTimeScale(command: PlayerCommand): number {
  const scale = (command as Partial<ActionTimedPlayerCommand>).worldTimeScale;
  if (typeof scale !== 'number' || !Number.isFinite(scale)) {
    return ACTION_TIME_RULES.committedTimeScale;
  }
  return Math.min(1, Math.max(0, scale));
}

export function scaleActionTimeDelta(
  command: PlayerCommand,
  deltaSeconds: number,
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return deltaSeconds * getActionTimeScale(command);
}
