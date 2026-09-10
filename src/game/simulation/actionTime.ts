import type { PlayerCommand } from './types';

/**
 * ACTION TIME makes observation cheap and action expensive: the battlefield
 * crawls while the player is hands-off, then snaps back to real time as soon
 * as the player commits to a meaningful combat input.
 *
 * Timing metadata follows command identity instead of becoming another public
 * simulation field. Commands created directly by tests/tools therefore remain
 * 1x unless they explicitly opt in with `withActionTime`.
 */
export const ACTION_TIME_RULES = {
  idleTimeScale: 0.08,
  committedTimeScale: 1,
} as const;

const commandTimeScales = new WeakMap<PlayerCommand, number>();

export function isActionTimeCommitted(command: PlayerCommand): boolean {
  return (
    command.move !== 0 ||
    command.firePrimary ||
    command.fireSecondary ||
    command.activateSkill ||
    command.activateBreakthrough
  );
}

export function withActionTime(command: PlayerCommand): PlayerCommand {
  const timedCommand = { ...command };
  commandTimeScales.set(
    timedCommand,
    isActionTimeCommitted(command)
      ? ACTION_TIME_RULES.committedTimeScale
      : ACTION_TIME_RULES.idleTimeScale,
  );
  return timedCommand;
}

export function getActionTimeScale(command: PlayerCommand): number {
  return commandTimeScales.get(command) ?? ACTION_TIME_RULES.committedTimeScale;
}

export function scaleActionTimeDelta(
  command: PlayerCommand,
  deltaSeconds: number,
): number {
  if (!Number.isFinite(deltaSeconds) || deltaSeconds <= 0) return 0;
  return deltaSeconds * getActionTimeScale(command);
}
