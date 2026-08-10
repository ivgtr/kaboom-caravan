import { SIMULATION_STEP_SECONDS } from './types';

const MAX_FRAME_SECONDS = 0.25;

export class FixedStepLoop {
  private accumulator = 0;
  private previousTime?: number;
  private animationFrame?: number;

  constructor(
    private readonly update: (deltaSeconds: number) => void,
    private readonly render: (alpha: number) => void,
  ) {}

  start(): void {
    if (this.animationFrame !== undefined) return;
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.animationFrame !== undefined) {
      cancelAnimationFrame(this.animationFrame);
    }
    this.animationFrame = undefined;
    this.previousTime = undefined;
    this.accumulator = 0;
  }

  private readonly frame = (timeMilliseconds: number): void => {
    const currentTime = timeMilliseconds / 1000;
    const elapsed = this.previousTime
      ? Math.min(currentTime - this.previousTime, MAX_FRAME_SECONDS)
      : 0;
    this.previousTime = currentTime;
    this.accumulator += elapsed;

    while (this.accumulator >= SIMULATION_STEP_SECONDS) {
      this.update(SIMULATION_STEP_SECONDS);
      this.accumulator -= SIMULATION_STEP_SECONDS;
    }

    this.render(this.accumulator / SIMULATION_STEP_SECONDS);
    this.animationFrame = requestAnimationFrame(this.frame);
  };
}
