import { FixedStepClock } from './FixedStepClock';

const MAX_FRAME_SECONDS = 0.25;

export class FixedStepLoop {
  private readonly clock = new FixedStepClock();
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
    this.clock.reset();
  }

  private readonly frame = (timeMilliseconds: number): void => {
    const currentTime = timeMilliseconds / 1000;
    const elapsed = this.previousTime
      ? Math.min(currentTime - this.previousTime, MAX_FRAME_SECONDS)
      : 0;
    this.previousTime = currentTime;
    const alpha = this.clock.advance(elapsed, this.update);
    this.render(alpha);
    this.animationFrame = requestAnimationFrame(this.frame);
  };
}
