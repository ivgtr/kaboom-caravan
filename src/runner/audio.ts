export class RunnerAudio {
  private context: AudioContext | null = null;
  enabled = true;

  unlock() {
    if (!this.enabled) return;
    try {
      this.context ??= new AudioContext();
      void this.context.resume().catch(() => {});
    } catch {
      // Audio is optional; the jump never waits for browser audio permission.
    }
  }

  play(kind: string) {
    const context = this.context;
    if (!this.enabled || !context || context.state !== 'running') return;
    const tones: Record<string, [number, number, number]> = {
      jump: [330, 640, 0.1],
      land: [100, 65, 0.05],
      pickup: [660, 990, 0.13],
      hit: [130, 45, 0.17],
      burst: [260, 80, 0.12],
      pass: [550, 800, 0.12],
    };
    const tone = tones[kind];
    if (!tone) return;
    const [from, to, duration] = tone;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = kind === 'hit' ? 'sawtooth' : 'triangle';
    oscillator.frequency.setValueAtTime(from, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      to,
      context.currentTime + duration,
    );
    gain.gain.setValueAtTime(
      kind === 'land' ? 0.025 : 0.065,
      context.currentTime,
    );
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration,
    );
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  }

  close() {
    void this.context?.close().catch(() => {});
    this.context = null;
  }
}
