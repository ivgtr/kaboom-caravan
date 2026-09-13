import type { Effect } from '../../game/siege/simulation';

/** A tiny gesture-unlocked synth. No network, persistent settings, or audio while paused. */
export class SiegeAudio {
  private context?: AudioContext;
  private gain?: GainNode;
  private muted = false;
  private lastAt = -1;

  async unlock(): Promise<void> {
    if (typeof AudioContext === 'undefined') return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.gain = this.context.createGain();
        this.gain.gain.value = this.muted ? 0 : 0.16;
        this.gain.connect(this.context.destination);
      }
      if (this.context.state === 'suspended') await this.context.resume();
    } catch {
      /* Audio is optional; rejected autoplay must not interrupt a command. */
    }
  }
  setMuted(value: boolean): void {
    this.muted = value;
    if (this.gain && this.context)
      this.gain.gain.setTargetAtTime(
        value ? 0 : 0.16,
        this.context.currentTime,
        0.015,
      );
  }
  play(type: Effect['type']): void {
    const c = this.context;
    if (!c || !this.gain || this.muted || c.state !== 'running') return;
    if (type !== 'cannon' && c.currentTime - this.lastAt < 0.08) return;
    this.lastAt = c.currentTime;
    const oscillator = c.createOscillator();
    const envelope = c.createGain();
    const low = type === 'blast' || type === 'cannon';
    const duration = type === 'cannon' ? 0.4 : low ? 0.18 : 0.065;
    oscillator.type = low ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(
      low ? 120 : type === 'deploy' ? 420 : 240,
      c.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      low ? 32 : 150,
      c.currentTime + duration,
    );
    envelope.gain.setValueAtTime(0.0001, c.currentTime);
    envelope.gain.exponentialRampToValueAtTime(
      low ? 0.45 : 0.3,
      c.currentTime + 0.008,
    );
    envelope.gain.exponentialRampToValueAtTime(
      0.0001,
      c.currentTime + duration,
    );
    oscillator.connect(envelope).connect(this.gain);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start();
    oscillator.stop(c.currentTime + duration);
  }
  dispose(): void {
    void this.context?.close().catch(() => undefined);
    this.context = undefined;
  }
}
