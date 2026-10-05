import { JACKPOT_FREEZE, MAX_ABILITY_LEVEL, REEL_FIRST_REVEAL } from './fever';
import { START_SPEED } from './pacing';
import type { AbilityId, FeverReel, RunnerState, WeaponId } from './types';

type Bus = 'music' | 'effects' | 'tension' | 'reward';
type Timbre = OscillatorType | 'brass' | 'chime';
type Envelope = 'pluck' | 'hold' | 'rise';
type Voice = {
  source: AudioScheduledSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  end: number;
  bus: Bus;
};
type Phrase = { at: number; sound: (at: number) => void };
type FreezeVoice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  end: number;
};

// Decode before the start screen becomes playable. Offline decoding does not
// unlock a device or autoplay; all instances share the exact approved WAV.
let freezeBufferPromise: Promise<AudioBuffer> | null = null;
function loadFreezeBuffer() {
  freezeBufferPromise ??= fetch(
    `${import.meta.env.BASE_URL}assets/audio/freeze-compact-dry-cut.wav`,
  )
    .then(async (response) => {
      if (!response.ok) throw new Error('FREEZE entry audio failed to load');
      const bytes = await response.arrayBuffer();
      const decoder = new OfflineAudioContext(1, 1, 48000);
      return decoder.decodeAudioData(bytes);
    })
    .catch((error: unknown) => {
      freezeBufferPromise = null;
      throw error;
    });
  return freezeBufferPromise;
}

// Original D-Dorian writing: the small running bed leaves space for the machine.
// Mechanical anticipation, confirmed wins and the rare FREEZE have separate roles.
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
const BACKGROUND_VOICES = 12;
const LOOK_AHEAD = 0.065;
const hz = (note: number) => 440 * 2 ** ((note - 69) / 12);
const clamp = (n: number, low: number, high: number) =>
  Math.max(low, Math.min(high, n));

/** Gesture-unlocked synthesis plus the user's unprocessed FREEZE entry sample. */
export class RunnerAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private effects: GainNode | null = null;
  private tension: GainNode | null = null;
  private rewardBus: GainNode | null = null;
  private motor: OscillatorNode | null = null;
  private motorGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private brass: PeriodicWave | null = null;
  private chime: PeriodicWave | null = null;
  private freezeBuffer: AudioBuffer | null = null;
  private freezeVoice: FreezeVoice | null = null;
  private voices = new Set<Voice>();
  private phrases: Phrase[] = [];
  private pending = new Map<string, number>();
  private cooldowns = new Map<string, number>();
  private lastState: RunnerState | null = null;
  private lastShot = 0;
  private lastTime = 0;
  private lastFireAt = -1;
  private lastEvent = 0;
  private lastReward = 0;
  private lastReel = 0;
  private lastFreezeReel = 0;
  private lastRevealed = 0;
  private lastLevel = 0;
  private lastAbilities: Record<AbilityId, number> = {
    boost: 0,
    slam: 0,
    gold: 0,
    magnet: 0,
  };
  private frozen = false;
  private armedJackpot = 0;
  private resync = false;
  private sounding = false;
  private acceptEffects = false;
  private step = 0;
  private nextBeat = 0;
  private nextRatchet = 0;
  private ratchetStep = 0;
  private duckUntil = 0;
  private protectedUntil = 0;
  private jackpotUntil = 0;
  private _enabled = true;
  private disposed = false;
  private blurred = false;

  constructor() {
    // RAF can stop entirely in the background. Silence without waiting for it.
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('blur', this.onBlur);
    window.addEventListener('focus', this.onFocus);
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

  private onBlur = () => {
    this.blurred = true;
    this.silence();
  };

  private onFocus = () => {
    this.blurred = false;
  };

  /** Await with artwork before enabling Start. Failure never starts a late cue. */
  async preload() {
    // Devices without Web Audio can retain the existing silent-play fallback.
    if (typeof AudioContext === 'undefined') return true;
    try {
      const buffer = await loadFreezeBuffer();
      if (this.disposed) return false;
      this.freezeBuffer = buffer;
      return true;
    } catch {
      return false;
    }
  }

  unlock() {
    if (!this.enabled || this.disposed) return;
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.createGraph(this.context);
      }
      void this.context.resume().catch(() => {});
    } catch {
      // A blocked or unsupported audio device must never block play.
    }
  }

  private createGraph(context: AudioContext) {
    this.master = context.createGain();
    this.master.gain.value = 0;
    this.music = context.createGain();
    this.music.gain.value = 0.4;
    this.effects = context.createGain();
    this.effects.gain.value = 0.85;
    this.tension = context.createGain();
    this.tension.gain.value = 0.75;
    this.rewardBus = context.createGain();
    this.rewardBus.gain.value = 0.85;
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
    for (const bus of [this.music, this.effects, this.tension, this.rewardBus])
      bus.connect(compressor);
    compressor.connect(ceiling);
    ceiling.connect(this.master);
    this.master.connect(context.destination);

    // Dry buses ensure the FREEZE and reveal ducking also silence every tail.
    this.motor = context.createOscillator();
    this.motor.type = 'triangle';
    this.motorGain = context.createGain();
    this.motorGain.gain.value = 0;
    this.motor.connect(this.motorGain);
    this.motorGain.connect(this.music);
    this.motor.start();
    this.brass = context.createPeriodicWave(
      new Float32Array(12),
      new Float32Array([
        0, 1, 0.48, 0.24, 0.1, 0.13, 0.06, 0.04, 0.03, 0.02, 0.01, 0.01,
      ]),
    );
    this.chime = context.createPeriodicWave(
      new Float32Array(10),
      new Float32Array([0, 1, 0.08, 0.36, 0.03, 0.18, 0.02, 0.1, 0.01, 0.06]),
    );
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

  /** Consume every state change even while muted/paused; never replay a backlog. */
  update(state: RunnerState) {
    if (this.disposed) return;
    if (
      (this.lastState && this.lastState !== state) ||
      state.time < this.lastTime
    ) {
      this.silence();
      this.lastShot =
        this.lastEvent =
        this.lastReward =
        this.lastReel =
        this.lastFreezeReel =
        this.lastRevealed =
          0;
      this.lastFireAt = -1;
      this.lastLevel = 0;
      this.cooldowns.clear();
      this.step = 0;
      this.frozen = false;
    }
    this.lastState = state;
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
    const newFreeze =
      freeze && !!reel?.jackpot && reel.id !== this.lastFreezeReel;
    // Consume the edge even when muted, paused, not decoded, or unavailable.
    // Neither resuming nor completion of a pending fetch may replay it.
    if (newFreeze) this.lastFreezeReel = reel.id;
    const newReel = !!reel && reel.id !== this.lastReel;
    const previousReveal = newReel ? 0 : this.lastRevealed;
    const newReveal = !!reel && reel.revealed > previousReveal;
    this.lastReel = reel?.id ?? 0;
    this.lastRevealed = reel?.revealed ?? 0;
    const reward = fever.rewardCue;
    const newReward = !!reward && reward.id !== this.lastReward;
    this.lastReward = reward?.id ?? 0;
    const previousAbilities = this.lastAbilities;
    this.lastAbilities = { ...fever.abilities };
    const event = fever.event;
    const newEvent = !!event && event.id !== this.lastEvent;
    this.lastEvent = event?.id ?? 0;

    const context = this.context;
    const running =
      this.enabled &&
      state.status === 'running' &&
      !document.hidden &&
      !this.blurred;
    if (!running || !context || context.state !== 'running') {
      this.silence();
      return;
    }
    if (freeze) {
      const playEntry = newFreeze && !this.resync;
      // Resume during a still-visible FREEZE can arm its remaining release.
      // Returning after it ended cannot: this branch must actually be observed.
      this.armedJackpot = reel?.jackpot ? reel.id : 0;
      this.resync = false;
      this.silence(true);
      if (playEntry) this.freezeEntry(context.currentTime);
      return;
    }
    this.stopFreezeEntry();
    const now = context.currentTime;
    const skipCues = this.resync;
    this.resync = false;
    this.acceptEffects = !skipCues;
    if (!this.sounding) {
      this.sounding = true;
      this.nextBeat = now + 0.025;
      this.nextRatchet = now + 0.07;
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

    const jackpot =
      !skipCues && released && reel?.jackpot && this.armedJackpot === reel.id;
    if (released) this.armedJackpot = 0;
    if (jackpot) {
      this.step = 0;
      this.nextBeat = now + 0.08;
      this.jackpot(now);
    }
    if (!skipCues) {
      if (newReel && !reel.jackpot) this.chest(now);
      if (newReveal) {
        // All stops are driven by APPLIED rewards, including a frame containing
        // several actual reveals. No precomputed result is announced early.
        for (let i = previousReveal; i < reel.revealed; i++) {
          const entry = reel.rewards[i];
          if (!entry) continue;
          const capped = previousAbilities[entry.kind] >= MAX_ABILITY_LEVEL;
          previousAbilities[entry.kind] = Math.min(
            MAX_ABILITY_LEVEL,
            previousAbilities[entry.kind] + entry.count,
          );
          this.award(
            now + (i - previousReveal) * 0.035,
            i + 1,
            capped,
            entry.count > 1,
          );
        }
      } else if (newReward) {
        // A whole reel can finish in one simulation batch. rewardCue survives
        // both reel removal and an unrelated combat event overwriting event.
        this.award(now, 1, reward.text.includes(' MAX → '), false);
      }
      // A promotion is already visible; do not stack another entry fanfare over
      // the rare jackpot answer or defer it into a stale announcement.
      if (raisedLevel && now >= this.jackpotUntil) this.entry(level, now);
      if (newEvent && event.kind === 'chain') this.pending.set('chain', 1);
    }
    if (reel && !skipCues) this.ratchet(reel, now, newReel || newReveal);
    this.flush(now);
    this.flushPhrases(now);
    if (
      !skipCues &&
      freshShot &&
      newest &&
      now >= this.protectedUntil &&
      now - this.lastFireAt > 0.095
    ) {
      this.lastFireAt = now;
      this.fire(newest.weapon, now);
    }
    this.music!.gain.setTargetAtTime(
      now < this.duckUntil ? 0.07 : reel ? 0.22 : 0.4,
      now,
      now < this.duckUntil ? 0.009 : 0.12,
    );
    this.effects!.gain.setTargetAtTime(
      now < this.protectedUntil ? 0.08 : 0.85,
      now,
      0.008,
    );
    this.tension!.gain.setTargetAtTime(
      now < this.protectedUntil ? 0.14 : 0.75,
      now,
      0.012,
    );

    // Never catch up bars after a background stall or a suspended audio device.
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
  }

  /** Routine effects aggregate; reward state has a single authoritative source. */
  play(kind: string) {
    if (
      !this.enabled ||
      !this.sounding ||
      !this.acceptEffects ||
      this.frozen ||
      document.hidden ||
      ['chest', 'reveal', 'rush', 'hyper', 'jackpot'].includes(kind)
    )
      return;
    this.pending.set(kind, Math.min(8, (this.pending.get(kind) ?? 0) + 1));
  }

  private flush(now: number) {
    if (now < this.protectedUntil) {
      this.pending.clear();
      return;
    }
    const priority = [
      'upgrade',
      'slam',
      'hit',
      'guard',
      'chain',
      'gold',
      'pickup',
      'recover',
      'jump',
      'land',
      'pass',
      'burst',
    ];
    let played = 0;
    for (const kind of priority) {
      if (!this.pending.has(kind) || played >= 2) continue;
      const cooldown = ['burst', 'gold', 'pickup', 'pass', 'chain'].includes(
        kind,
      )
        ? 0.16
        : 0.075;
      if (now - (this.cooldowns.get(kind) ?? -10) < cooldown) continue;
      this.cooldowns.set(kind, now);
      this.effect(kind, now);
      played++;
    }
    this.pending.clear();
  }

  private effect(kind: string, now: number) {
    if (kind === 'chain' || kind === 'upgrade') {
      this.note(kind === 'chain' ? 81 : 74, now, 0.08, 0.035, 'chime');
      if (kind === 'upgrade') this.note(81, now + 0.06, 0.13, 0.035);
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

  private protect(now: number, attack: number, duck: number) {
    this.protectedUntil = Math.max(this.protectedUntil, now + attack);
    this.duckUntil = Math.max(this.duckUntil, now + duck);
  }

  private chest(now: number) {
    this.protect(now, 0.12, 0.28);
    this.ratchetStep = 0;
    this.sweep(170, 70, now, 0.09, 0.075, 'triangle', 'reward');
    this.hiss(now, 0.045, 0.075, 2600, 'reward');
    // A latch, a questioning two-note call, then a rising mechanical intake.
    this.later(now + 0.045, (at) =>
      this.note(69, at, 0.105, 0.065, 'brass', 'reward'),
    );
    this.later(now + 0.145, (at) =>
      this.note(74, at, 0.14, 0.065, 'brass', 'reward'),
    );
    this.hiss(now + 0.1, 0.45, 0.035, 600, 'tension', 'rise');
  }

  private ratchet(reel: FeverReel, now: number, reset: boolean) {
    if (reset) this.nextRatchet = now + 0.065;
    if (reel.revealed >= reel.rewards.length || now < this.nextRatchet) return;
    const first = reel.jackpot ? JACKPOT_FREEZE + 0.16 : REEL_FIRST_REVEAL;
    const interval = reel.revealInterval;
    const start =
      reel.revealed === 0
        ? reel.jackpot
          ? JACKPOT_FREEZE
          : 0
        : first + (reel.revealed - 1) * interval;
    const end = first + reel.revealed * interval;
    const remaining = end - reel.elapsed;
    if (remaining <= 0.025) return;
    const progress = clamp((reel.elapsed - start) / (end - start), 0, 1);
    const frequency = 570 + progress * 1500 + reel.revealed * 130;
    // The ratchet actually accelerates toward EACH scheduled stop. It never
    // schedules beyond that stop and does not promise an unearned extra reward.
    this.hiss(
      now,
      0.017,
      0.032 + progress * 0.013,
      2300 + progress * 1800,
      'tension',
    );
    this.sweep(
      frequency,
      frequency * 0.57,
      now,
      0.026,
      0.022,
      this.ratchetStep++ % 3 === 0 ? 'square' : 'triangle',
      'tension',
    );
    this.nextRatchet = now + Math.min(remaining, 0.105 - progress * 0.076);
  }

  private award(
    now: number,
    ordinal: number,
    capped: boolean,
    merged: boolean,
  ) {
    this.stopVoices('tension');
    this.protect(now, 0.2, 0.42);
    const note = REWARD_NOTES[clamp(ordinal - 1, 0, 3)]!;
    // The dry physical stop leads the tonal body, rather than another soft ping.
    this.hiss(now, 0.025, 0.095, 2900, 'reward');
    this.sweep(210, 72, now, 0.047, 0.075, 'square', 'reward');
    this.sweep(150, 52, now + 0.008, 0.16, 0.11, 'sine', 'reward');
    if (capped) {
      // Capped ranks really convert to points: a falling coin cadence, distinct
      // from the rising phrase that says a new rank or additional award landed.
      [86, 81, 77, 74].forEach((pitch, i) =>
        this.later(now + 0.035 + i * 0.045, (at) =>
          this.note(pitch, at, 0.13, 0.066, 'chime', 'reward'),
        ),
      );
      return;
    }
    this.note(note, now + 0.012, 0.25, 0.105, 'brass', 'reward', 0.004, 'hold');
    this.note(note + 12, now + 0.02, 0.32, 0.044, 'chime', 'reward');
    if ((ordinal > 1 || merged) && now >= this.jackpotUntil) {
      // This phrase is earned at the SECOND real stop, never on opening a chest
      // whose hidden outcome happens to contain multiple rewards.
      [note - 5, note, note + 7].forEach((pitch, i) =>
        this.later(now + 0.055 + i * 0.055, (at) =>
          this.note(pitch, at, 0.15, 0.062, 'brass', 'reward', 0.003, 'hold'),
        ),
      );
      this.later(now + 0.235, (at) =>
        this.note(note + 12, at, 0.3, 0.05, 'chime', 'reward'),
      );
      this.protect(now, 0.27, 0.52);
    }
  }

  private entry(level: number, now: number) {
    this.protect(now, level === 2 ? 0.48 : 0.3, level === 2 ? 0.86 : 0.55);
    this.sweep(level === 2 ? 155 : 125, 43, now, 0.24, 0.115, 'sine', 'reward');
    this.hiss(now, level === 2 ? 0.16 : 0.07, 0.06, 2300, 'reward');
    const pitches = level === 2 ? [74, 77, 81, 86] : [62, 69, 74];
    const times = level === 2 ? [0, 0.075, 0.15, 0.29] : [0, 0.075, 0.2];
    pitches.forEach((pitch, i) =>
      this.later(now + times[i]!, (at) => {
        this.note(pitch, at, 0.19, 0.09, 'brass', 'reward', 0.004, 'hold');
        this.note(pitch + 12, at + 0.012, 0.15, 0.025, 'chime', 'reward');
      }),
    );
    if (level === 2)
      this.later(now + 0.46, (at) => {
        for (const pitch of [62, 69, 77, 86])
          this.note(pitch, at, 0.43, 0.043, 'brass', 'reward', 0.012, 'hold');
      });
  }

  private freezeEntry(now: number) {
    const context = this.context;
    if (
      !context ||
      !this.freezeBuffer ||
      !this.enabled ||
      this.disposed ||
      this.blurred ||
      document.hidden
    )
      return;
    this.stopFreezeEntry();
    if (!this.reserve('reward')) return;
    const source = context.createBufferSource();
    const gain = context.createGain();
    source.buffer = this.freezeBuffer;
    // A is already mastered. Preserve its native level, timing, and zero tail:
    // no envelope, filter, compressor, waveshaper, or synthesized reinforcement.
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(context.destination);
    const voice = { source, gain, end: now + this.freezeBuffer.duration };
    this.freezeVoice = voice;
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      if (this.freezeVoice === voice) this.freezeVoice = null;
    };
    source.start(now);
    source.stop(voice.end);
  }

  private stopFreezeEntry() {
    const voice = this.freezeVoice;
    if (!voice || !this.context) return;
    const now = this.context.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(0, now);
    voice.source.stop(Math.min(now, voice.end));
    this.freezeVoice = null;
  }

  private jackpot(now: number) {
    this.pending.clear();
    this.phrases = [];
    this.protect(now, 1.05, 1.5);
    this.jackpotUntil = now + 1.5;
    // Reserved for an observed FREEZE release: sub impact, dry crack, inharmonic
    // struck metal, a wide original brass answer, and a ringing upper crown.
    this.sweep(190, 35, now, 0.42, 0.16, 'sine', 'reward');
    this.sweep(88, 44, now, 0.5, 0.09, 'triangle', 'reward');
    this.hiss(now, 0.035, 0.13, 3500, 'reward');
    this.hiss(now + 0.025, 0.48, 0.075, 6800, 'reward');
    for (const [ratio, volume] of [
      [1, 0.07],
      [2.76, 0.043],
      [4.07, 0.026],
    ])
      this.sweep(
        587 * ratio!,
        582 * ratio!,
        now,
        0.6,
        volume!,
        'sine',
        'reward',
      );
    this.note(74, now, 0.18, 0.12, 'brass', 'reward', 0.004, 'hold');
    [81, 84, 86].forEach((pitch, i) =>
      this.later(now + [0.12, 0.25, 0.4][i]!, (at) => {
        this.note(pitch, at, 0.23, 0.105, 'brass', 'reward', 0.005, 'hold');
        this.note(pitch - 12, at, 0.19, 0.05, 'brass', 'reward');
      }),
    );
    this.later(now + 0.59, (at) => {
      this.sweep(95, 49, at, 0.5, 0.11, 'sine', 'reward');
      for (const pitch of [62, 69, 77, 86])
        this.note(pitch, at, 0.65, 0.065, 'brass', 'reward', 0.015, 'hold');
      this.note(98, at, 0.78, 0.037, 'chime', 'reward');
      this.hiss(at, 0.28, 0.038, 7200, 'reward');
    });
    this.later(now + 0.9, (at) =>
      this.note(93, at, 0.38, 0.033, 'chime', 'reward'),
    );
    this.later(now + 1.08, (at) =>
      this.note(98, at, 0.4, 0.03, 'chime', 'reward'),
    );
  }

  private later(at: number, sound: Phrase['sound']) {
    if (this.phrases.length < 64) this.phrases.push({ at, sound });
  }

  private flushPhrases(now: number) {
    const due = this.phrases.filter((phrase) => phrase.at <= now + LOOK_AHEAD);
    this.phrases = this.phrases.filter(
      (phrase) => phrase.at > now + LOOK_AHEAD,
    );
    due.sort((a, b) => a.at - b.at);
    for (const phrase of due) {
      if (phrase.at >= now - 0.1) phrase.sound(Math.max(now, phrase.at));
    }
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
    type: Timbre = 'triangle',
    bus: Bus = 'effects',
    attack = 0.005,
    envelope: Envelope = 'pluck',
  ) {
    this.sweep(
      hz(note),
      hz(note),
      at,
      duration,
      volume,
      type,
      bus,
      attack,
      envelope,
    );
  }

  private sweep(
    from: number,
    to: number,
    at: number,
    duration: number,
    volume: number,
    type: Timbre = 'triangle',
    bus: Bus = 'effects',
    attack = 0.005,
    envelope: Envelope = 'pluck',
  ) {
    const context = this.context;
    if (!context || !this.reserve(bus)) return;
    const source = context.createOscillator();
    if (type === 'brass' || type === 'chime')
      source.setPeriodicWave(type === 'brass' ? this.brass! : this.chime!);
    else source.type = type;
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
      type === 'sine' || type === 'chime'
        ? 10000
        : type === 'brass'
          ? 6800
          : 4300,
      attack,
      'lowpass',
      envelope,
    );
  }

  private hiss(
    at: number,
    duration: number,
    volume: number,
    frequency: number,
    bus: Bus = 'effects',
    envelope: Envelope = 'pluck',
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
      envelope,
    );
  }

  private reserve(bus: Bus) {
    for (const voice of this.voices) {
      if (voice.end <= this.context!.currentTime) this.voices.delete(voice);
    }
    const voices = [...this.voices];
    if (
      bus !== 'reward' &&
      voices.filter((v) => v.bus !== 'reward').length >= BACKGROUND_VOICES
    )
      return false;
    if (bus === 'music' && voices.filter((v) => v.bus === 'music').length >= 8)
      return false;
    if (
      bus === 'effects' &&
      voices.filter((v) => v.bus === 'effects').length >= 4
    )
      return false;
    if (
      bus === 'tension' &&
      voices.filter((v) => v.bus === 'tension').length >= 4
    )
      return false;
    // At least sixteen slots cannot be occupied by guns, rhythm, or ratchets.
    // Release tails count too: stealing must never exceed the physical cap.
    const entryVoices =
      this.freezeVoice && this.freezeVoice.end > this.context!.currentTime
        ? 1
        : 0;
    return this.voices.size + entryVoices < MAX_VOICES;
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
    envelope: Envelope = 'pluck',
  ) {
    const context = this.context!;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(frequency, at);
    filter.Q.value = filterType === 'bandpass' ? 0.8 : 0.55;
    const peak = clamp(volume, 0.001, 0.16);
    gain.gain.setValueAtTime(0, at);
    if (envelope === 'rise') {
      gain.gain.linearRampToValueAtTime(peak * 0.1, at + 0.01);
      gain.gain.exponentialRampToValueAtTime(peak, at + duration * 0.88);
      filter.frequency.exponentialRampToValueAtTime(4500, at + duration);
    } else {
      gain.gain.linearRampToValueAtTime(
        peak,
        at + Math.min(attack, duration / 3),
      );
      if (envelope === 'hold') {
        gain.gain.exponentialRampToValueAtTime(
          peak * 0.65,
          at + duration * 0.55,
        );
        filter.frequency.exponentialRampToValueAtTime(
          frequency * 0.48,
          at + duration,
        );
      }
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    gain.gain.linearRampToValueAtTime(0, at + duration + 0.01);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(
      bus === 'music'
        ? this.music!
        : bus === 'effects'
          ? this.effects!
          : bus === 'tension'
            ? this.tension!
            : this.rewardBus!,
    );
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

  private stopVoice(voice: Voice, immediate = false) {
    const now = this.context!.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    if (immediate) voice.gain.gain.setValueAtTime(0, now);
    else voice.gain.gain.setTargetAtTime(0, now, 0.004);
    voice.end = Math.min(voice.end, now + (immediate ? 0 : 0.025));
    voice.source.stop(voice.end);
    if (immediate) this.voices.delete(voice);
  }

  private stopVoices(bus?: Bus, immediate = false) {
    for (const voice of this.voices)
      if (!bus || voice.bus === bus) this.stopVoice(voice, immediate);
  }

  private silence(forFreeze = false) {
    this.acceptEffects = false;
    this.pending.clear();
    this.phrases = [];
    if (!forFreeze) {
      this.resync = true;
      this.armedJackpot = 0;
      // This lane bypasses only the game FREEZE, never a user/lifecycle stop.
      // Do this even when the synthesized master is already silent.
      this.stopFreezeEntry();
    }
    if (!this.context || (!this.sounding && !forFreeze)) return;
    this.sounding = false;
    const now = this.context.currentTime;
    if (forFreeze) {
      // Cut ordinary sound at the same audio-clock edge as the approved entry.
      this.master?.gain.cancelScheduledValues(now);
      this.master?.gain.setValueAtTime(0, now);
      this.motorGain?.gain.cancelScheduledValues(now);
      this.motorGain?.gain.setValueAtTime(0, now);
    } else {
      this.master?.gain.setTargetAtTime(0, now, 0.007);
      this.motorGain?.gain.setTargetAtTime(0, now, 0.007);
    }
    this.stopVoices(undefined, forFreeze);
    this.nextBeat = this.nextRatchet = 0;
    this.duckUntil = this.protectedUntil = this.jackpotUntil = 0;
  }

  close() {
    this.silence();
    this.disposed = true;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('blur', this.onBlur);
    window.removeEventListener('focus', this.onFocus);
    this.motor?.stop(this.context?.currentTime ?? 0);
    void this.context?.close().catch(() => {});
    this.context = null;
    this.master =
      this.music =
      this.effects =
      this.tension =
      this.rewardBus =
      this.motorGain =
        null;
    this.motor = null;
    this.noise = null;
    this.freezeBuffer = null;
    this.brass = this.chime = null;
    this.voices.clear();
  }

  dispose() {
    this.close();
  }
}
