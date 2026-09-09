import type { WeaponId } from '../game/data/ids';
import type { SessionPhase } from '../game/session/GameSession';
import type { CombatEvent } from '../game/simulation/types';
import type { LootKind } from '../game/simulation/types';

interface VoiceOptions {
  type?: OscillatorType;
  volume?: number;
  endFrequency?: number;
  attack?: number;
  delay?: number;
  filterFrequency?: number;
}

const EVENT_INTERVALS = {
  fire: 0.035,
  hit: 0.065,
  kill: 0.045,
} as const;

export class AudioDirector {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private ambientGain?: GainNode;
  private ambientOscillators: OscillatorNode[] = [];
  private phase: SessionPhase = 'garage';
  private muted = false;
  private lastPlayed = new Map<string, number>();

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.context) {
      this.masterGain.gain.setTargetAtTime(
        muted ? 0.0001 : 0.72,
        this.context.currentTime,
        0.018,
      );
    }
    if (muted) this.stopAmbient();
    else if (this.phase === 'combat') this.startAmbient();
  }

  async unlock(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext();
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 18;
      compressor.ratio.value = 5;
      compressor.attack.value = 0.004;
      compressor.release.value = 0.12;
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.muted ? 0.0001 : 0.72;
      compressor.connect(this.masterGain).connect(this.context.destination);
    }
    if (this.context.state === 'suspended') await this.context.resume();
    if (this.phase === 'combat' && !this.muted) this.startAmbient();
  }

  setPhase(phase: SessionPhase): void {
    this.phase = phase;
    if (phase !== 'combat') {
      this.stopAmbient();
      return;
    }
    if (!this.muted) this.startAmbient();
  }

  handleEvents(events: readonly CombatEvent[]): void {
    if (!this.context || this.muted) return;
    for (const event of events) {
      switch (event.type) {
        case 'core-ready':
        case 'breakthrough-ready':
          this.playUiConfirm();
          break;
        case 'breakthrough-activated':
          this.voice(100, 0.35, {
            type: 'triangle',
            endFrequency: 420,
            volume: 0.06,
          });
          this.voice(440, 0.28, {
            type: 'sine',
            endFrequency: 660,
            delay: 0.1,
            volume: 0.035,
          });
          break;
        case 'weapon-fired':
          if (this.canPlay('fire', EVENT_INTERVALS.fire)) {
            this.playWeapon(event.weaponId);
          }
          break;
        case 'projectile-hit':
          if (this.canPlay('hit', EVENT_INTERVALS.hit)) this.playHit();
          break;
        case 'loot-dropped':
          this.playSupplyDrop(event.kind);
          break;
        case 'loot-collected':
          this.playLoot(event.kind, event.value);
          break;
        case 'attack-parried':
          this.playParry();
          break;
        case 'boost-started':
          this.playBoost();
          break;
        case 'vehicle-hit':
          this.playVehicleHit();
          break;
        case 'enemy-killed':
          if (this.canPlay('kill', EVENT_INTERVALS.kill)) this.playKill();
          break;
        case 'combat-ended':
          this.playCombatEnd(event.result);
          break;
        default:
          break;
      }
    }
  }

  playUiConfirm(): void {
    this.voice(440, 0.075, {
      type: 'sine',
      endFrequency: 560,
      volume: 0.026,
      attack: 0.009,
      filterFrequency: 1_800,
    });
  }

  dispose(): void {
    this.stopAmbient();
    void this.context?.close();
    this.context = undefined;
    this.masterGain = undefined;
  }

  private playWeapon(weaponId: WeaponId): void {
    const voices: Partial<Record<WeaponId, () => void>> = {
      'machine-cannon': () =>
        this.voice(165, 0.055, {
          type: 'triangle',
          endFrequency: 105,
          volume: 0.022,
          filterFrequency: 900,
        }),
      'scatter-cannon': () => {
        this.voice(105, 0.11, {
          type: 'triangle',
          endFrequency: 62,
          volume: 0.04,
          filterFrequency: 620,
        });
        this.voice(210, 0.055, {
          type: 'sine',
          endFrequency: 120,
          volume: 0.018,
          filterFrequency: 1_100,
        });
      },
      flamethrower: () =>
        this.voice(125, 0.09, {
          type: 'triangle',
          endFrequency: 92,
          volume: 0.014,
          attack: 0.025,
          filterFrequency: 480,
        }),
      'rocket-launcher': () =>
        this.voice(92, 0.18, {
          type: 'sine',
          endFrequency: 48,
          volume: 0.048,
          filterFrequency: 420,
        }),
      railgun: () => {
        this.voice(260, 0.18, {
          type: 'sine',
          endFrequency: 920,
          volume: 0.033,
          attack: 0.015,
          filterFrequency: 2_200,
        });
        this.voice(130, 0.22, {
          type: 'triangle',
          endFrequency: 70,
          volume: 0.021,
          filterFrequency: 700,
        });
      },
      'mine-launcher': () =>
        this.voice(145, 0.12, {
          type: 'sine',
          endFrequency: 82,
          volume: 0.03,
          filterFrequency: 640,
        }),
    };
    voices[weaponId]?.();
  }

  private playHit(): void {
    this.voice(185, 0.045, {
      type: 'sine',
      endFrequency: 125,
      volume: 0.012,
      attack: 0.006,
      filterFrequency: 850,
    });
  }

  private playBoost(): void {
    this.voice(115, 0.24, {
      type: 'triangle',
      endFrequency: 230,
      volume: 0.022,
      attack: 0.018,
      filterFrequency: 1_100,
    });
    this.voice(220, 0.16, {
      type: 'sine',
      endFrequency: 360,
      volume: 0.012,
      attack: 0.012,
      delay: 0.045,
      filterFrequency: 1_800,
    });
  }

  private playSupplyDrop(kind: LootKind): void {
    const root = kind === 'repair' ? 310 : kind === 'ammo' ? 390 : 520;
    this.voice(root, 0.09, {
      type: 'triangle',
      endFrequency: root * 1.2,
      volume: kind === 'weapon-cache' ? 0.026 : 0.015,
      attack: 0.01,
      filterFrequency: 1_600,
    });
  }

  private playLoot(kind: LootKind, value: number): void {
    const root =
      kind === 'repair'
        ? 440 + value * 2
        : kind === 'ammo'
          ? 360 + value * 2
          : 620;
    this.voice(root, 0.1, {
      type: 'sine',
      endFrequency: root * 1.08,
      volume: kind === 'weapon-cache' ? 0.032 : 0.022,
      attack: 0.012,
      filterFrequency: 2_400,
    });
    this.voice(root * (kind === 'weapon-cache' ? 1.5 : 1.25), 0.12, {
      type: 'sine',
      endFrequency: root * 1.34,
      volume: 0.02,
      attack: 0.012,
      delay: 0.065,
      filterFrequency: 2_800,
    });
  }

  private playParry(): void {
    [523.25, 659.25, 783.99].forEach((frequency, index) => {
      this.voice(frequency, 0.22, {
        type: index === 0 ? 'triangle' : 'sine',
        endFrequency: frequency * 1.06,
        volume: index === 0 ? 0.036 : 0.022,
        attack: 0.012,
        delay: index * 0.028,
        filterFrequency: 3_000,
      });
    });
  }

  private playVehicleHit(): void {
    this.voice(94, 0.2, {
      type: 'sine',
      endFrequency: 46,
      volume: 0.048,
      attack: 0.006,
      filterFrequency: 380,
    });
  }

  private playKill(): void {
    this.voice(210, 0.085, {
      type: 'triangle',
      endFrequency: 285,
      volume: 0.018,
      attack: 0.008,
      filterFrequency: 1_100,
    });
  }

  private playCombatEnd(result: 'victory' | 'defeat'): void {
    const notes =
      result === 'victory' ? [523.25, 659.25, 783.99] : [196, 164.81, 130.81];
    notes.forEach((frequency, index) => {
      this.voice(frequency, 0.23, {
        type: 'sine',
        endFrequency: frequency,
        volume: 0.034,
        attack: 0.018,
        delay: index * 0.115,
        filterFrequency: 2_100,
      });
    });
  }

  private canPlay(key: string, minimumInterval: number): boolean {
    if (!this.context) return false;
    const now = this.context.currentTime;
    const previous = this.lastPlayed.get(key) ?? Number.NEGATIVE_INFINITY;
    if (now - previous < minimumInterval) return false;
    this.lastPlayed.set(key, now);
    return true;
  }

  private startAmbient(): void {
    if (
      !this.context ||
      !this.masterGain ||
      this.ambientOscillators.length > 0
    ) {
      return;
    }
    const now = this.context.currentTime;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 190;
    filter.Q.value = 0.7;
    this.ambientGain = this.context.createGain();
    this.ambientGain.gain.setValueAtTime(0.0001, now);
    this.ambientGain.gain.exponentialRampToValueAtTime(0.0035, now + 0.35);
    filter.connect(this.ambientGain).connect(this.masterGain);

    const fundamentals = [55, 82.5];
    this.ambientOscillators = fundamentals.map((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const voiceGain = this.context!.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      voiceGain.gain.value = index === 0 ? 0.8 : 0.2;
      oscillator.connect(voiceGain).connect(filter);
      oscillator.start(now);
      return oscillator;
    });
  }

  private stopAmbient(): void {
    if (this.context && this.ambientGain) {
      this.ambientGain.gain.setTargetAtTime(
        0.0001,
        this.context.currentTime,
        0.025,
      );
    }
    for (const oscillator of this.ambientOscillators) {
      oscillator.stop(this.context ? this.context.currentTime + 0.12 : 0);
    }
    this.ambientOscillators = [];
    this.ambientGain = undefined;
  }

  private voice(
    frequency: number,
    duration: number,
    options: VoiceOptions = {},
  ): void {
    if (!this.context || !this.masterGain || this.muted) return;
    const start = this.context.currentTime + (options.delay ?? 0);
    const attack = Math.min(options.attack ?? 0.004, duration * 0.35);
    const oscillator = this.context.createOscillator();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    oscillator.type = options.type ?? 'sine';
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, options.endFrequency ?? frequency * 0.82),
      start + duration,
    );
    filter.type = 'lowpass';
    filter.frequency.value = options.filterFrequency ?? 1_200;
    filter.Q.value = 0.65;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(options.volume ?? 0.02, start + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(filter).connect(gain).connect(this.masterGain);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.01);
  }
}
