import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';

/** Exercise the real browser DSP, not a mock oscillator or a subjective claim. */
test('audio stays bounded through fever, FREEZE, bursts and interruptions', async ({
  page,
}, info) => {
  await page.goto('/');
  const { wav, ...metrics } = await page.evaluate(async () => {
    const audioModule = '/src/runner/audio.ts';
    const stateModule = '/src/runner/simulation.ts';
    const { RunnerAudio } = await import(audioModule);
    const { createRunner } = await import(stateModule);
    const sampleRate = 24000;
    const context = new OfflineAudioContext(1, sampleRate * 18, sampleRate);
    let now = 0;
    let hidden = false;
    const sources: { start: number; end: number }[] = [];
    const proxy = new Proxy(context, {
      get(target, key) {
        if (key === 'currentTime') return now;
        if (key === 'state') return 'running';
        if (key === 'resume' || key === 'close') return () => Promise.resolve();
        const value = Reflect.get(target, key, target);
        if (key === 'createOscillator' || key === 'createBufferSource') {
          return () => {
            const node = value.call(target) as AudioScheduledSourceNode;
            const entry = { start: Infinity, end: Infinity };
            sources.push(entry);
            const start = node.start.bind(node);
            const stop = node.stop.bind(node);
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
        }
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
    audio.unlock();
    const state = createRunner(42);
    state.status = 'running';
    const event = (kind: string) => {
      state.fever.event = {
        id: Math.round(now * 1000) + 1,
        kind,
        text: '',
        value: 1,
        clock: now,
      };
    };
    let burstSources = 0;
    let beforeBurst = 0;
    for (let frame = 0; frame < 18 * 60; frame++) {
      now = frame / 60;
      state.time = now;
      if (frame === 2 * 60) {
        state.speed = 1000;
        state.fever.rushTime = 10;
        event('rush');
      }
      if (frame === 4 * 60) {
        state.speed = 1650;
        state.fever.hyperTime = 10;
        event('hyper');
      }
      if (frame === 5 * 60) {
        state.fever.reel = {
          id: 99,
          rewards: [
            { kind: 'boost', count: 1 },
            { kind: 'slam', count: 1 },
            { kind: 'gold', count: 1 },
          ],
          revealed: 0,
          elapsed: 0,
          jackpot: false,
          merged: 1,
        };
      }
      if (frame === 5 * 60 + 30) state.fever.reel.revealed = 1;
      if (frame === 6 * 60) state.fever.reel.revealed = 2;
      if (frame === 6 * 60 + 30) state.fever.reel.revealed = 3;
      if (frame === 7 * 60) {
        state.fever.freeze = 0.65;
        event('jackpot');
      }
      if (frame === 7 * 60 + 39) state.fever.freeze = 0;
      if (frame === 8 * 60) {
        state.fever.reel = null;
        beforeBurst = sources.length;
        for (let i = 0; i < 500; i++) {
          audio.play('burst');
          audio.play('gold');
          audio.play('slam');
        }
      }
      if (frame === 9 * 60) state.status = 'paused';
      if (frame === 10 * 60) state.status = 'running';
      if (frame === 11 * 60) audio.enabled = false;
      if (frame === 12 * 60) audio.enabled = true;
      if (frame === 13 * 60) {
        hidden = true;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      if (frame === 14 * 60) {
        hidden = false;
        document.dispatchEvent(new Event('visibilitychange'));
      }
      // Deliberately omit all updates while hidden, as a background RAF can stop.
      if (!hidden) audio.update(state);
      if (frame === 8 * 60) burstSources = sources.length - beforeBurst;
      if (frame === 15 * 60) {
        // A retry resets simulation time and must cancel the previous phrase.
        state.time = 0;
        audio.update(state);
      }
      if (frame === 16 * 60) audio.dispose();
    }
    window.AudioContext = OriginalContext;
    Reflect.deleteProperty(document, 'hidden');
    const buffer = await context.startRendering();
    const samples = buffer.getChannelData(0);
    const windowRms = (start: number, end: number) => {
      let squares = 0;
      for (let i = Math.floor(start * sampleRate); i < end * sampleRate; i++)
        squares += samples[i]! ** 2;
      return Math.sqrt(squares / ((end - start) * sampleRate));
    };
    let peak = 0;
    let finite = true;
    for (const sample of samples) {
      peak = Math.max(peak, Math.abs(sample));
      finite &&= Number.isFinite(sample);
    }
    let maxSources = 0;
    for (let i = 0; i < 18000; i++) {
      const at = i / 1000;
      maxSources = Math.max(
        maxSources,
        sources.filter((s) => s.start <= at && s.end > at).length,
      );
    }
    // PCM export is the actual DSP output at its original gain, not normalized.
    const wav = new Uint8Array(44 + samples.length * 2);
    const view = new DataView(wav.buffer);
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
      music: windowRms(0.3, 1.9),
      rush: windowRms(2.05, 2.6),
      hyper: windowRms(4.05, 4.6),
      freeze: windowRms(7.15, 7.6),
      release: windowRms(7.68, 8.05),
      paused: windowRms(9.15, 9.9),
      resumed: windowRms(10.2, 10.8),
      muted: windowRms(11.15, 11.9),
      unmuted: windowRms(12.2, 12.8),
      background: windowRms(13.15, 13.9),
      foreground: windowRms(14.2, 14.8),
      disposed: windowRms(16.15, 17.9),
    };
  });
  await info.attach('audio-automated-synthetic-scenario.wav', {
    body: Buffer.from(wav, 'base64'),
    contentType: 'audio/wav',
  });
  await info.attach('audio-waveform-metrics.json', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  expect(metrics.finite).toBe(true);
  expect(metrics.peak).toBeLessThan(0.51);
  expect(metrics.maxSources).toBeLessThanOrEqual(29); // 28 voices plus the motor
  expect(metrics.burstSources).toBeGreaterThan(0);
  expect(metrics.burstSources).toBeLessThan(16);
  for (const value of [
    metrics.music,
    metrics.rush,
    metrics.hyper,
    metrics.release,
    metrics.resumed,
    metrics.unmuted,
    metrics.foreground,
  ])
    expect(value).toBeGreaterThan(0.001);
  expect(metrics.release).toBeGreaterThan(metrics.music);
  for (const value of [
    metrics.freeze,
    metrics.paused,
    metrics.muted,
    metrics.background,
    metrics.disposed,
  ])
    expect(value).toBeLessThan(0.00001);
});
