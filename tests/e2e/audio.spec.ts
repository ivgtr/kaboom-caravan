import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

/** Directed audition and lifecycle stress using actual browser DSP, not gameplay. */
test('audio stays bounded through fever, FREEZE, bursts and interruptions', async ({
  page,
}, info) => {
  await page.goto('/');
  const { wav, ...metrics } = await page.evaluate(async () => {
    const { RunnerAudio } = await import('/src/runner/audio.ts');
    const { createRunner } = await import('/src/runner/simulation.ts');
    const { stepFeverUI } = await import('/src/runner/fever.ts');
    const approvedBytes = await (
      await fetch('/assets/audio/freeze-compact-dry-cut.wav')
    ).arrayBuffer();
    const approvedHash = Array.from(
      new Uint8Array(await crypto.subtle.digest('SHA-256', approvedBytes)),
    )
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
    const approved = await new OfflineAudioContext(1, 1, 48000).decodeAudioData(
      approvedBytes.slice(0),
    );
    const sampleRate = 48000,
      seconds = 22;
    const context = new OfflineAudioContext(
      1,
      sampleRate * seconds,
      sampleRate,
    );
    let now = 0,
      hidden = false;
    const sources: { start: number; end: number }[] = [];
    const proxy = new Proxy(context, {
      get(target, key) {
        if (key === 'currentTime') return now;
        if (key === 'state') return 'running';
        if (key === 'resume' || key === 'close') return () => Promise.resolve();
        const value = Reflect.get(target, key, target);
        if (key === 'createOscillator' || key === 'createBufferSource')
          return () => {
            const node = value.call(target) as AudioScheduledSourceNode;
            const entry = { start: Infinity, end: Infinity };
            sources.push(entry);
            const start = node.start.bind(node),
              stop = node.stop.bind(node);
            node.start = (at = 0) => {
              entry.start = at;
              start(at);
            };
            node.stop = (at = 0) => {
              entry.end = at;
              stop(at);
            };
            return node;
          };
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const OriginalContext = window.AudioContext;
    window.AudioContext = function () {
      return proxy;
    } as unknown as typeof AudioContext;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
    const audio = new RunnerAudio();
    // Observe cue identities without replacing their synthesis or adding a production hook.
    const cueCalls: { kind: string; at: number; ordinal: number }[] = [];
    const tracked = audio as unknown as Record<
      string,
      (...args: unknown[]) => unknown
    >;
    for (const kind of [
      'chest',
      'award',
      'entry',
      'freezeEntry',
      'jackpot',
      'fire',
    ]) {
      const original = tracked[kind]!;
      tracked[kind] = (...args) => {
        cueCalls.push({
          kind,
          at: now,
          ordinal: kind === 'award' ? Number(args[1]) : 0,
        });
        return Reflect.apply(original, audio, args);
      };
    }
    const preloaded = await audio.preload();
    audio.unlock();
    let state = createRunner(42);
    state.status = 'running';
    const event = (kind: string) => {
      state.fever.event = {
        id: state.nextId++,
        kind,
        text: '',
        value: 1,
        clock: state.fever.clock,
      };
    };
    const reel = (jackpot = false) => {
      state.fever.reel = {
        id: state.nextId++,
        rewards: [
          { kind: 'boost', count: 1 },
          { kind: 'slam', count: 1 },
          { kind: 'gold', count: 1 },
        ],
        revealed: 0,
        elapsed: 0,
        jackpot,
        merged: 1,
        revealInterval: 0.55,
      };
      if (jackpot) state.fever.freeze = 0.65;
      event(jackpot ? 'jackpot' : 'chest');
    };
    let burstSources = 0,
      beforeBurst = 0;
    const revealTimes: number[] = [];
    for (let frame = 0; frame < seconds * 60; frame++) {
      now = frame / 60;
      if (state.status === 'running') {
        const before = state.fever.rewardCue?.id;
        const worldStep = stepFeverUI(state, 1 / 60);
        state.time += worldStep;
        if (state.fever.rewardCue?.id !== before && now < 5)
          revealTimes.push(now);
      }
      if (frame === 2 * 60) reel();
      if (frame === 2 * 60 + 1) audio.play('chest'); // visual particle must not duplicate opening
      if (frame === 4 * 60 + 30) {
        state.speed = 1000;
        state.fever.rushTime = 10;
        event('rush');
      }
      if (frame === 6 * 60) {
        state.speed = 1650;
        state.fever.hyperTime = 10;
        event('hyper');
      }
      if (frame === 8 * 60) reel(true);
      // Deliberately overwrite the generic event on the exact normal first reveal.
      if (frame === 2 * 60 + 39) event('slam');
      if (frame >= 2 * 60 + 39 && frame < 2 * 60 + 51) {
        state.shots = [
          {
            id: state.nextId++,
            x: 0,
            y: 0,
            endX: 1,
            endY: 1,
            life: 0.1,
            weapon: 'machine',
          },
        ];
      }
      if (frame === 11 * 60) {
        beforeBurst = sources.length;
        for (let i = 0; i < 500; i++) {
          audio.play('burst');
          audio.play('gold');
          audio.play('slam');
        }
      }
      if (frame === 12 * 60) state.status = 'paused';
      if (frame === 13 * 60) state.status = 'running';
      if (frame === 14 * 60) {
        audio.enabled = false;
        reel();
      }
      if (frame === 15 * 60) audio.enabled = true;
      if (frame === 16 * 60) {
        hidden = true;
        reel(true);
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (frame === 17 * 60) {
        hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (frame === 18 * 60) reel(true);
      if (frame === 18 * 60 + 3) state.status = 'paused';
      if (frame === 18 * 60 + 12) state.status = 'running';
      // A hidden RAF may disappear entirely; no stale fanfare is allowed on return.
      if (!hidden) audio.update(state);
      if (frame === 11 * 60) burstSources = sources.length - beforeBurst;
      if (frame === 19 * 60) {
        state = createRunner(42);
        state.status = 'running';
        audio.update(state);
      }
      if (frame === 20 * 60) audio.dispose();
    }
    window.AudioContext = OriginalContext;
    Reflect.deleteProperty(document, 'hidden');
    const buffer = await context.startRendering(),
      samples = buffer.getChannelData(0);
    const rms = (start: number, end: number) => {
      let sum = 0;
      for (let i = Math.floor(start * sampleRate); i < end * sampleRate; i++)
        sum += samples[i]! ** 2;
      return Math.sqrt(sum / ((end - start) * sampleRate));
    };
    let peak = 0,
      finite = true,
      maxSources = 0;
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample));
      finite &&= Number.isFinite(sample);
    }
    for (let i = 0; i < seconds * 1000; i++) {
      const at = i / 1000;
      maxSources = Math.max(
        maxSources,
        sources.filter((s) => s.start <= at && s.end > at).length,
      );
    }
    let freezePcmMaxError = 0;
    const approvedSamples = approved.getChannelData(0);
    for (let i = 0; i < approvedSamples.length; i++) {
      freezePcmMaxError = Math.max(
        freezePcmMaxError,
        Math.abs(samples[8 * sampleRate + i]! - approvedSamples[i]!),
      );
    }
    // Original gain, no normalization. This is a scripted audition, not a gameplay replay.
    const wav = new Uint8Array(44 + samples.length * 2),
      view = new DataView(wav.buffer);
    const label = (offset: number, text: string) => {
      for (let i = 0; i < text.length; i++)
        view.setUint8(offset + i, text.charCodeAt(i));
    };
    label(0, 'RIFF');
    view.setUint32(4, wav.length - 8, true);
    label(8, 'WAVE');
    label(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    label(36, 'data');
    view.setUint32(40, samples.length * 2, true);
    samples.forEach((sample, i) =>
      view.setInt16(
        44 + i * 2,
        Math.round(Math.max(-1, Math.min(1, sample)) * 32767),
        true,
      ),
    );
    let binary = '';
    for (let i = 0; i < wav.length; i += 32768)
      binary += String.fromCharCode(...wav.subarray(i, i + 32768));
    return {
      wav: btoa(binary),
      peak,
      finite,
      maxSources,
      burstSources,
      revealTimes,
      cueCalls,
      approvedHash,
      preloaded,
      freezePcmMaxError,
      freezeEntry: rms(8.005, 8.15),
      music: rms(0.3, 1.9),
      opening: rms(2.02, 2.4),
      firstStop: rms(2.66, 2.9),
      extraAward: rms(3.22, 3.5),
      rush: rms(4.52, 5),
      hyper: rms(6.02, 6.5),
      freeze: rms(8.2, 8.6),
      release: rms(8.67, 9.05),
      paused: rms(12.15, 12.9),
      resumed: rms(13.2, 13.8),
      muted: rms(14.15, 14.9),
      unmuted: rms(15.2, 15.8),
      background: rms(16.15, 16.9),
      foreground: rms(17.02, 17.2),
      pausedFreeze: rms(18.1, 18.7),
      resumedFreezeRelease: rms(18.83, 18.99),
      disposed: rms(20.15, 21.9),
    };
  });
  await info.attach('audio-directed-pachinko-scenario.wav', {
    body: Buffer.from(wav, 'base64'),
    contentType: 'audio/wav',
  });
  await info.attach('audio-waveform-metrics.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  expect(metrics.preloaded).toBe(true);
  expect(metrics.approvedHash).toBe(
    '077c7b3cae1c6423bacde99f94a210b5011b4b78d27dbfad1f8ffdd0176e9f90',
  );
  expect(metrics.freezePcmMaxError).toBeLessThan(0.000001);
  expect(metrics.freezeEntry).toBeGreaterThan(0.001);
  expect(metrics.finite).toBe(true);
  expect(metrics.peak).toBeLessThan(0.51);
  expect(metrics.maxSources).toBeLessThanOrEqual(29);
  expect(metrics.burstSources).toBeGreaterThan(0);
  expect(metrics.burstSources).toBeLessThan(16);
  expect(metrics.revealTimes).toEqual([2.65, 3.2, 3.75]);
  const cues = metrics.cueCalls;
  expect(
    cues.filter((cue) => cue.kind === 'chest').map((cue) => cue.at),
  ).toEqual([2]);
  expect(
    cues
      .filter((cue) => cue.kind === 'award' && cue.at < 5)
      .map((cue) => [cue.at, cue.ordinal]),
  ).toEqual([
    [2.65, 1],
    [3.2, 2],
    [3.75, 3],
  ]);
  expect(
    cues.filter((cue) => cue.kind === 'freezeEntry').map((cue) => cue.at),
  ).toEqual([8, 18]);
  const jackpots = cues.filter((cue) => cue.kind === 'jackpot');
  expect(jackpots).toHaveLength(2);
  expect(Math.abs(jackpots[0]!.at - 8.65)).toBeLessThan(0.025);
  expect(Math.abs(jackpots[1]!.at - 18.8)).toBeLessThan(0.025);
  expect(cues.filter((cue) => cue.at >= 17 && cue.at < 17.2)).toEqual([]);
  expect(
    cues.filter(
      (cue) => cue.kind === 'fire' && cue.at >= 2.65 && cue.at < 2.85,
    ),
  ).toEqual([]);
  for (const value of [
    metrics.music,
    metrics.opening,
    metrics.firstStop,
    metrics.extraAward,
    metrics.rush,
    metrics.hyper,
    metrics.release,
    metrics.resumed,
    metrics.unmuted,
    metrics.resumedFreezeRelease,
  ])
    expect(value).toBeGreaterThan(0.001);
  expect(metrics.firstStop).toBeGreaterThan(metrics.music);
  expect(metrics.release).toBeGreaterThan(metrics.music);
  for (const value of [
    metrics.freeze,
    metrics.paused,
    metrics.muted,
    metrics.background,
    metrics.pausedFreeze,
    metrics.disposed,
  ])
    expect(value).toBeLessThan(0.00001);
});
