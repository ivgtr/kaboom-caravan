import type { SessionPhase } from '../game/session/GameSession';
import type { CombatEvent } from '../game/simulation/types';

export class AudioDirector {
  private context?: AudioContext;
  private ambient?: OscillatorNode;
  private ambientGain?: GainNode;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.ambientGain) this.ambientGain.gain.value = muted ? 0 : 0.018;
  }

  async unlock(): Promise<void> {
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === 'suspended') await this.context.resume();
  }

  setPhase(phase: SessionPhase): void {
    if (!this.context || this.muted) return;
    if (phase !== 'combat') {
      this.stopAmbient();
      return;
    }
    if (this.ambient) return;
    this.ambient = this.context.createOscillator();
    this.ambientGain = this.context.createGain();
    this.ambient.type = 'triangle';
    this.ambient.frequency.value = 82;
    this.ambientGain.gain.value = 0.018;
    this.ambient.connect(this.ambientGain).connect(this.context.destination);
    this.ambient.start();
  }

  handleEvents(events: readonly CombatEvent[]): void {
    if (!this.context || this.muted) return;
    for (const event of events) {
      switch (event.type) {
        case 'weapon-fired':
          this.tone(event.weaponId === 'railgun' ? 180 : 110, 0.045, 'square');
          break;
        case 'projectile-hit':
          this.tone(70, 0.035, 'sawtooth');
          break;
        case 'loot-collected':
          this.tone(620 + event.value * 70, 0.09, 'sine', 0.045);
          break;
        case 'attack-parried':
          this.tone(980, 0.16, 'triangle', 0.09, 340);
          break;
        case 'vehicle-hit':
          this.tone(48, 0.12, 'sawtooth', 0.06);
          break;
        case 'enemy-killed':
          this.tone(150, 0.07, 'square', 0.035, 75);
          break;
        case 'combat-ended':
          this.tone(
            event.result === 'victory' ? 520 : 72,
            0.32,
            'triangle',
            0.07,
          );
          break;
        default:
          break;
      }
    }
  }

  playUiConfirm(): void {
    this.tone(440, 0.08, 'sine', 0.04, 660);
  }

  dispose(): void {
    this.stopAmbient();
    void this.context?.close();
  }

  private stopAmbient(): void {
    this.ambient?.stop();
    this.ambient?.disconnect();
    this.ambientGain?.disconnect();
    this.ambient = undefined;
    this.ambientGain = undefined;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    volume = 0.025,
    endFrequency = frequency * 0.72,
  ): void {
    if (!this.context || this.muted) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      now + duration,
    );
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
}
