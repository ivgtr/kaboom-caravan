import { START_SPEED, MAX_SPEED } from './pacing';
import type { RunnerState, WeaponId } from './types';

/** Quiet mechanical movement under the short, readable action sounds. */
export class RunnerAudio {
  private context: AudioContext | null = null;
  private motor: OscillatorNode | null = null;
  private motorOvertone: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private motorFilter: BiquadFilterNode | null = null;
  private lastShot = 0;
  private lastTime = 0;
  private lastFireAt = -1;
  enabled = true;

  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional; a jump never waits for browser audio permission.
    }
  }

  private startMotor(context: AudioContext) {
    if (this.motor) return;
    this.motor = context.createOscillator();
    this.motorOvertone = context.createOscillator();
    this.motorGain = context.createGain();
    this.motorFilter = context.createBiquadFilter();
    this.motor.type = 'triangle';
    this.motorOvertone.type = 'sawtooth';
    this.motorFilter.type = 'lowpass';
    this.motorFilter.Q.value = 0.45;
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorFilter);
    this.motorOvertone.connect(this.motorFilter);
    this.motorFilter.connect(this.motorGain);
    this.motorGain.connect(context.destination);
    this.motor.start();
    this.motorOvertone.start();
  }

  /** Call every frame, including paused frames, so pause/mute always fades out. */
  update(state: RunnerState) {
    const context = this.context;
    if (state.time < this.lastTime) this.lastShot = 0;
    this.lastTime = state.time;
    const newest = state.shots.reduce<(typeof state.shots)[number] | null>(
      (last, shot) => (!last || shot.id > last.id ? shot : last),
      null,
    );
    const freshShot = newest && newest.id > this.lastShot;
    if (newest) this.lastShot = Math.max(this.lastShot, newest.id);
    if (!context || context.state !== 'running') return;
    const running = this.enabled && state.status === 'running';
    if (!running && !this.motor) return;
    this.startMotor(context);
    const now = context.currentTime;
    const pace = Math.max(
      0,
      Math.min(1, (state.speed - START_SPEED) / (MAX_SPEED - START_SPEED)),
    );
    const airborne = !state.player.grounded;
    const rev = 47 + pace * 21 + (airborne ? 10 : 0);
    this.motor!.frequency.setTargetAtTime(rev, now, 0.09);
    this.motorOvertone!.frequency.setTargetAtTime(rev * 2.015, now, 0.09);
    this.motorFilter!.frequency.setTargetAtTime(145 + pace * 70, now, 0.08);
    this.motorGain!.gain.setTargetAtTime(
      running ? (airborne ? 0.012 : 0.017) : 0,
      now,
      0.035,
    );
    if (running && freshShot && newest && now - this.lastFireAt > 0.075) {
      this.lastFireAt = now;
      this.fire(newest.weapon);
    }
  }

  private tone(
    from: number,
    to: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'triangle',
  ) {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const now = context.currentTime;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, now);
    oscillator.frequency.exponentialRampToValueAtTime(to, now + duration);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start();
    oscillator.stop(now + duration);
  }

  private fire(weapon: WeaponId) {
    const tones: Record<
      WeaponId,
      [number, number, number, number, OscillatorType]
    > = {
      machine: [180, 82, 0.055, 0.022, 'triangle'],
      scatter: [125, 43, 0.12, 0.037, 'triangle'],
      rocket: [105, 32, 0.2, 0.04, 'sawtooth'],
      rail: [850, 150, 0.16, 0.024, 'sine'],
      flame: [76, 46, 0.09, 0.017, 'sawtooth'],
      mine: [210, 63, 0.12, 0.025, 'triangle'],
    };
    this.tone(...tones[weapon]);
  }

  play(kind: string) {
    const tones: Record<string, [number, number, number, number]> = {
      jump: [220, 540, 0.11, 0.045],
      recover: [360, 760, 0.13, 0.044],
      land: [115, 40, 0.095, 0.045],
      pickup: [660, 990, 0.13, 0.05],
      hit: [130, 38, 0.19, 0.052],
      burst: [170, 48, 0.12, 0.036],
      pass: [550, 800, 0.12, 0.04],
      upgrade: [460, 1100, 0.2, 0.048],
    };
    const tone = tones[kind];
    if (tone) this.tone(...tone, kind === 'hit' ? 'sawtooth' : 'triangle');
  }

  close() {
    this.motor?.stop();
    this.motorOvertone?.stop();
    void this.context?.close().catch(() => {});
    this.context = null;
    this.motor = null;
    this.motorOvertone = null;
    this.motorGain = null;
    this.motorFilter = null;
  }
}
