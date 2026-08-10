import { SIMULATION_STEP_SECONDS } from './types';

const STEP_EPSILON = 1e-10;

export class FixedStepClock {
  private accumulator = 0;

  advance(
    elapsedSeconds: number,
    update: (deltaSeconds: number) => void,
  ): number {
    this.accumulator += elapsedSeconds;

    while (this.accumulator + STEP_EPSILON >= SIMULATION_STEP_SECONDS) {
      update(SIMULATION_STEP_SECONDS);
      this.accumulator -= SIMULATION_STEP_SECONDS;
    }

    return Math.min(1, Math.max(0, this.accumulator / SIMULATION_STEP_SECONDS));
  }

  reset(): void {
    this.accumulator = 0;
  }
}
