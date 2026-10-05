import { START_SPEED } from './pacing';
import type { RunnerState, WeaponId } from './types';

type Bus = 'music' | 'effects';
type Voice = {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  end: number;
  bus: Bus;
};

// An original D-Dorian loop. Reward notes share its key, rather than competing
// with the score. The bed stays deliberately smaller than the chest reveals.
const CHORDS = [
  [62, 65, 69, 72],
  [62, 67, 71, 74],
  [60, 64, 67, 71],
  [60, 64, 69, 72],
];
const ROOTS = [38, 43, 36, 45];
const MELODY = [0, -1, 2, 1, -1, 3, 2, -1];
const REWARD_NOTES = [74, 77, 81, 84];
const MAX_VOICES = 28;
const MUSIC_VOICES = 14;
const LOOK_AHEAD = 0.085;
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));

/** Gesture-unlocked, frame-scheduled audio. No timers survive pause or retry. */
export class RunnerAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private motor: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private pending = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  private lastShot = 0;
  private lastTime = 0;
  private lastFireAt = -1;
  private lastEvent = 0;
  private lastReel = 0;
  private lastRevealed = 0;
  private lastLevel = 0;
  private frozen = false;
  private sounding = false;
  private step = 0;
  private nextBeat = 0;
  private duckUntil = 0;
  private _enabled = true;
  private disposed = false;

  constructor() {
    // RAF can stop completely in the background, so silence independently.
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get enabled() {
    return this._enabled;
  }

  set enabled(value: boolean) {
    this._enabled = value;
    if (!value) this.silence();
  }

  private onVisibility = () => {
    if (document.hidden) this.silence();
  };

  unlock() {
    if (!this.enabled || this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.createGraph(this.context);
      }
      void this.context.resume().catch(() => {});
    } catch {
      // A blocked/unsupported audio device must never block play.
    }
  }

  private createGraph(context: AudioContext) {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.music = context.createGain();
    this.music.gain.value = 0.48;
    this.effects = context.createGain();
    this.effects.gain.value = 0.85;
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 14;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.16;
    const ceiling = context.createWaveShaper();
    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = 0.72 * Math.tanh(x * 1.4);
    }
    ceiling.curve = curve;
    ceiling.oversample = '2x';
    this.music.connect(compressor);
    this.effects.connect(compressor);
    compressor.connect(ceiling);
    ceiling.connect(this.master);
    this.master.connect(context.destination);

    // A short, quiet echo gives the plucks some space without a sample download.
    const delay = context.createDelay(0.5);
    const feedback = context.createGain();
    const wet = context.createGain();
    delay.delayTime.value = 0.19;
    feedback.gain.value = 0.16;
    wet.gain.value = 0.13;
    this.music.connect(delay);
    delay.connect(feedback);
    feedback.connect(delay);
    delay.connect(wet);
    wet.connect(compressor);

    this.motor = context.createOscillator();
    this.motor.type = 'triangle';
    this.motorGain = context.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorGain);
    this.motorGain.connect(this.music);
    this.motor.start();

    this.noise = context.createBuffer(
      1,
      context.sampleRate,
      context.sampleRate,
    );
    const samples = this.noise.getChannelData(0);
    let seed = 73531;
    for (let i = 0; i < samples.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      samples[i] = (seed / 4294967296) * 2 - 1;
    }
  }

  /** Call on every frame, including pause/mute, so stale cues never accumulate. */
  update(state: RunnerState) {
    if (this.disposed) return;
    if (state.time < this.lastTime) {
      this.silence();
      this.lastShot = this.lastEvent = this.lastReel = this.lastRevealed = 0;
      this.lastFireAt = -1;
      this.lastLevel = 0;
      this.cooldowns.clear();
      this.step = 0;
      this.frozen = false;
    }
    this.lastTime = state.time;
    let newest: (typeof state.shots)[number] | undefined;
    for (const shot of state.shots) {
      if (!newest || shot.id > newest.id) newest = shot;
    }
    const freshShot = newest && newest.id > this.lastShot;
    if (newest) this.lastShot = Math.max(this.lastShot, newest.id);

    const fever = state.fever;
    const level = fever.hyperTime > 0 ? 2 : fever.rushTime > 0 ? 1 : 0;
    const raisedLevel = level > this.lastLevel;
    this.lastLevel = level;
    const freeze = fever.freeze > 0;
    const released = this.frozen && !freeze;
    this.frozen = freeze;
    const reel = fever.reel;
    const newReel = !!reel && reel.id !== this.lastReel;
    const newReveal =
      !!reel && reel.revealed > (newReel ? 0 : this.lastRevealed);
    this.lastReel = reel?.id ?? 0;
    this.lastRevealed = reel?.revealed ?? 0;
    const event = fever.event;
    const newEvent = !!event && event.id !== this.lastEvent;
    this.lastEvent = event?.id ?? 0;

    const context = this.context;
    const running =
      this.enabled && state.status === 'running' && !document.hidden;
    if (!running || freeze || !context || context.state !== 'running') {
      this.silence();
      return;
    }
    const now = context.currentTime;
    if (!this.sounding) {
      this.sounding = true;
      this.nextBeat = now + 0.025;
      this.master!.gain.setTargetAtTime(0.7, now, 0.015);
    }
    const pace = clamp(
      Math.log2(Math.max(1, state.speed / START_SPEED)) / Math.log2(5),
      0,
      1,
    );
    const tempo = 108 + pace * 26 + level * 7;
    this.motor!.frequency.setTargetAtTime(
      48 + pace * 38 + (state.player.grounded ? 0 : 8),
      now,
      0.09,
    );
    this.motorGain!.gain.setTargetAtTime(0.009 + pace * 0.004, now, 0.06);

    if (released) {
      this.stopVoices();
      this.step = 0;
      this.nextBeat = now + 0.02;
      this.pending.clear();
      this.reward('jackpot', now);
    } else {
      if (newReel) this.pending.set('chest', 1);
      if (newReveal) this.pending.set('reveal', Math.min(4, reel.revealed));
      if (raisedLevel) this.pending.set(level === 2 ? 'hyper' : 'rush', 1);
      if (newEvent && ['chain', 'rush', 'hyper'].includes(event.kind))
        this.pending.set(event.kind, 1);
    }
    this.flush(now);
    if (freshShot && newest && now - this.lastFireAt > 0.095) {
      this.lastFireAt = now;
      this.fire(newest.weapon, now);
    }
    this.music!.gain.setTargetAtTime(
      now < this.duckUntil ? 0.18 : reel ? 0.29 : 0.48,
      now,
      0.07,
    );

    // Never catch up missed bars after a background stall or suspended device.
    if (this.nextBeat < now - 0.12) this.nextBeat = now + 0.025;
    let scheduled = 0;
    while (this.nextBeat < now + LOOK_AHEAD && scheduled++ < 3) {
      this.musicStep(this.step++, this.nextBeat, tempo, level, !!reel);
      this.nextBeat += 30 / tempo;
    }
  }

  private musicStep(
    step: number,
    at: number,
    tempo: number,
    level: number,
    reel: boolean,
  ) {
    const eighth = 30 / tempo;
    const bar = Math.floor(step / 8) % CHORDS.length;
    const beat = step % 8;
    const chord = CHORDS[bar]!;
    const root = ROOTS[bar]!;
    if (beat === 0) {
      for (const note of chord)
        this.note(note - 12, at, eighth * 3.5, 0.026, 'sine', 'music', 0.08);
    }
    if (beat % 2 === 0) {
      this.note(
        root + (beat === 6 ? 12 : 0),
        at,
        eighth * 0.82,
        0.1,
        'triangle',
        'music',
      );
      if (beat === 0 || beat === 4 || (level > 0 && beat === 6))
        this.sweep(105, 44, at, 0.13, 0.085, 'sine', 'music');
    }
    if (beat === 2 || beat === 6) {
      this.hiss(at, 0.075, 0.035, 1500, 'music');
      this.note(50, at, 0.065, 0.025, 'triangle', 'music');
    }
    if (beat % 2 === 1 || level === 2)
      this.hiss(at, 0.03, level === 2 ? 0.016 : 0.011, 6200, 'music');
    const melody = MELODY[beat]!;
    if (melody >= 0 && !reel) {
      this.note(
        chord[melody]! + 12,
        at,
        eighth * 1.25,
        0.036,
        'triangle',
        'music',
      );
      if (level === 2 && beat === 0)
        this.note(
          chord[melody]!,
          at + eighth * 0.5,
          eighth,
          0.024,
          'sine',
          'music',
        );
    }
    if (reel && beat % 2 === 1)
      this.note(REWARD_NOTES[beat % 4]!, at, 0.035, 0.022, 'sine', 'music');
  }

  /** Aggregate particle/bullet bursts into one cue of each kind per frame. */
  play(kind: string) {
    if (!this.enabled || !this.sounding || this.frozen || document.hidden)
      return;
    this.pending.set(kind, Math.min(8, (this.pending.get(kind) ?? 0) + 1));
  }

  private flush(now: number) {
    // The prominent cue wins; dozens of defeated objects cannot become a chord
    // of dozens of explosions or mask a reel reveal.
    const priority = [
      'hyper',
      'rush',
      'reveal',
      'chest',
      'chain',
      'upgrade',
      'slam',
      'hit',
      'gold',
      'pickup',
      'guard',
      'recover',
      'jump',
      'land',
      'pass',
      'burst',
    ];
    let played = 0;
    for (const kind of priority) {
      const count = this.pending.get(kind);
      if (!count || played >= 3) continue;
      const cooldown = ['burst', 'gold', 'pickup', 'pass'].includes(kind)
        ? 0.15
        : 0.075;
      if (now - (this.cooldowns.get(kind) ?? -10) < cooldown) continue;
      this.cooldowns.set(kind, now);
      this.effect(kind, now, count);
      played++;
    }
    this.pending.clear();
  }

  private effect(kind: string, now: number, count: number) {
    if (
      ['chest', 'reveal', 'rush', 'hyper', 'chain', 'upgrade'].includes(kind)
    ) {
      this.reward(kind, now, count);
      return;
    }
    const cues: Record<string, [number, number, number, number]> = {
      jump: [220, 440, 0.11, 0.05],
      recover: [349, 698, 0.13, 0.05],
      land: [110, 45, 0.085, 0.045],
      pickup: [698, 1047, 0.095, 0.034],
      gold: [880, 1397, 0.09, 0.039],
      hit: [130, 38, 0.17, 0.07],
      burst: [160, 48, 0.105, 0.04],
      guard: [698, 220, 0.14, 0.046],
      pass: [523, 698, 0.11, 0.034],
      slam: [150, 36, 0.25, 0.09],
    };
    const cue = cues[kind];
    if (cue) this.sweep(cue[0], cue[1], now, cue[2], cue[3], 'triangle');
    if (kind === 'slam' || kind === 'hit') this.hiss(now, 0.12, 0.045, 950);
  }

  private reward(kind: string, now: number, count = 1) {
    if (kind === 'reveal') {
      const note = REWARD_NOTES[clamp(count - 1, 0, 3)]!;
      this.note(note, now, 0.19, 0.085);
      this.note(note + 12, now + 0.015, 0.12, 0.025, 'sine');
      this.duckUntil = Math.max(this.duckUntil, now + 0.24);
      return;
    }
    if (kind === 'chest') {
      this.sweep(110, 220, now, 0.12, 0.085);
      this.hiss(now, 0.07, 0.04, 2200);
      [69, 74, 77].forEach((note, i) =>
        this.note(note, now + i * 0.045, 0.14, 0.057),
      );
      this.duckUntil = Math.max(this.duckUntil, now + 0.35);
      return;
    }
    if (kind === 'chain') {
      this.note(81, now, 0.13, 0.052);
      this.note(86, now + 0.055, 0.2, 0.065);
      return;
    }
    const jackpot = kind === 'jackpot';
    const hyper = jackpot || kind === 'hyper';
    const notes = hyper ? [74, 77, 81, 84, 86] : [69, 74, 77, 81];
    const spacing = jackpot ? 0.09 : 0.065;
    this.sweep(
      135,
      38,
      now,
      jackpot ? 0.38 : 0.22,
      jackpot ? 0.15 : 0.09,
      'sine',
    );
    if (hyper) this.hiss(now, 0.24, 0.055, 2800);
    notes.forEach((note, i) =>
      this.note(note, now + i * spacing, 0.32, hyper ? 0.095 : 0.065),
    );
    const end = now + notes.length * spacing;
    for (const note of [62, 69, 74, 77])
      this.note(
        note,
        end,
        jackpot ? 0.9 : 0.45,
        jackpot ? 0.065 : 0.035,
        'sine',
        'effects',
        0.02,
      );
    this.duckUntil = Math.max(this.duckUntil, end + (jackpot ? 0.85 : 0.35));
  }

  private fire(weapon: WeaponId, now: number) {
    const tones: Record<WeaponId, [number, number, number, number]> = {
      machine: [180, 82, 0.045, 0.025],
      scatter: [125, 43, 0.1, 0.043],
      rocket: [105, 32, 0.16, 0.045],
      rail: [880, 147, 0.12, 0.029],
      flame: [76, 46, 0.07, 0.022],
      mine: [220, 65, 0.1, 0.035],
    };
    const [from, to, duration, volume] = tones[weapon];
    this.sweep(
      from,
      to,
      now,
      duration,
      volume,
      weapon === 'rail' ? 'sine' : 'triangle',
    );
  }

  private note(
    note: number,
    at: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'triangle',
    bus: Bus = 'effects',
    attack = 0.005,
  ) {
    this.sweep(hz(note), hz(note), at, duration, volume, type, bus, attack);
  }

  private sweep(
    from: number,
    to: number,
    at: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'triangle',
    bus: Bus = 'effects',
    attack = 0.005,
  ) {
    const context = this.context;
    if (!context || !this.reserve(bus)) return;
    const source = context.createOscillator();
    source.type = type;
    source.frequency.setValueAtTime(from, at);
    source.frequency.exponentialRampToValueAtTime(
      Math.max(20, to),
      at + duration,
    );
    this.connectVoice(
      source,
      at,
      duration,
      volume,
      bus,
      type === 'sine' ? 10000 : 4300,
      attack,
    );
  }

  private hiss(
    at: number,
    duration: number,
    volume: number,
    frequency: number,
    bus: Bus = 'effects',
  ) {
    const context = this.context;
    if (!context || !this.noise || !this.reserve(bus)) return;
    const source = context.createBufferSource();
    source.buffer = this.noise;
    this.connectVoice(
      source,
      at,
      duration,
      volume,
      bus,
      frequency,
      0.002,
      'bandpass',
    );
  }

  private reserve(bus: Bus) {
    for (const voice of this.voices) {
      if (voice.end <= this.context!.currentTime) this.voices.delete(voice);
    }
    if (
      bus === 'music' &&
      [...this.voices].filter((v) => v.bus === 'music').length >= MUSIC_VOICES
    )
      return false;
    // Reserve half the budget for prominent rewards. Do not steal a voice and
    // briefly exceed the physical cap while its release envelope is playing.
    return this.voices.size < MAX_VOICES;
  }

  private connectVoice(
    source: AudioScheduledSourceNode,
    at: number,
    duration: number,
    volume: number,
    bus: Bus,
    frequency: number,
    attack: number,
    filterType: BiquadFilterType = 'lowpass',
  ) {
    const context = this.context!;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    filter.Q.value = 0.55;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(
      clamp(volume, 0.001, 0.16),
      at + Math.min(attack, duration / 3),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    gain.gain.linearRampToValueAtTime(0, at + duration + 0.01);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(bus === 'music' ? this.music! : this.effects!);
    const voice: Voice = {
      source,
      gain,
      filter,
      end: at + duration + 0.015,
      bus,
    };
    this.voices.add(voice);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
      this.voices.delete(voice);
    };
    source.start(at);
    source.stop(voice.end);
  }

  private stopVoice(voice: Voice) {
    const now = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0, now, 0.004);
    voice.end = Math.min(voice.end, now + 0.025);
    voice.source.stop(voice.end);
    // Keep release tails in the budget even if pause/resume is spammed.
  }

  private stopVoices() {
    for (const voice of this.voices) this.stopVoice(voice);
  }

  private silence() {
    this.pending.clear();
    if (!this.context || !this.sounding) return;
    this.sounding = false;
    const now = this.context.currentTime;
    this.master?.gain.setTargetAtTime(0, now, 0.007);
    this.motorGain?.gain.setTargetAtTime(0, now, 0.007);
    this.stopVoices();
    this.nextBeat = 0;
    this.duckUntil = 0;
  }

  close() {
    this.silence();
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    this.motor?.stop(this.context?.currentTime ?? 0);
    void this.context?.close().catch(() => {});
    this.context = null;
    this.master = this.music = this.effects = this.motorGain = null;
    this.motor = null;
    this.noise = null;
    this.voices.clear();
  }

  dispose() {
    this.close();
  }
}
