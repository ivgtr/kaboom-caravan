// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatPauseController } from './CombatPauseController';
import { InputManager } from './InputManager';
import { FixedStepLoop } from '../game/simulation/FixedStepLoop';

describe('CombatPauseController', () => {
  let controller: CombatPauseController;
  let canPause: boolean;
  let onPause: ReturnType<typeof vi.fn<() => void>>;
  let onResume: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    canPause = true;
    onPause = vi.fn<() => void>();
    onResume = vi.fn<() => void>();
    controller = new CombatPauseController({
      canPause: () => canPause,
      onPause,
      onResume,
    });
    controller.connect();
  });

  afterEach(() => {
    controller.disconnect();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function press(code: string, options: KeyboardEventInit = {}) {
    const event = new KeyboardEvent('keydown', {
      code,
      bubbles: true,
      cancelable: true,
      ...options,
    });
    window.dispatchEvent(event);
    return event;
  }

  it('pauses and resumes idempotently', () => {
    controller.resume();
    controller.pause();
    controller.pause();
    expect(onPause).toHaveBeenCalledTimes(1);
    controller.resume();
    controller.resume();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('toggles with Escape or P, but never with a repeated key', () => {
    expect(press('Escape').defaultPrevented).toBe(true);
    expect(press('Escape', { repeat: true }).defaultPrevented).toBe(true);
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
    press('KeyP');
    expect(onResume).toHaveBeenCalledTimes(1);
    press('KeyP', { repeat: true });
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('leaves menu Escape and browser shortcuts untouched', () => {
    canPause = false;
    expect(press('Escape').defaultPrevented).toBe(false);
    controller.pause();
    canPause = true;
    for (const options of [
      { ctrlKey: true },
      { altKey: true },
      { metaKey: true },
      { isComposing: true },
    ]) {
      expect(press('KeyP', options).defaultPrevented).toBe(false);
    }
    expect(onPause).not.toHaveBeenCalled();
  });

  it('does not intercept text entry', () => {
    for (const tag of ['input', 'textarea', 'select', 'div']) {
      const field = document.createElement(tag);
      if (tag === 'div') {
        Object.defineProperty(field, 'isContentEditable', { value: true });
      }
      document.body.append(field);
      field.dispatchEvent(
        new KeyboardEvent('keydown', { code: 'KeyP', bubbles: true }),
      );
    }
    expect(onPause).not.toHaveBeenCalled();
  });

  it('pauses on blur but does not resume on focus', () => {
    window.dispatchEvent(new Event('blur'));
    window.dispatchEvent(new Event('focus'));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it('requires explicit resume after becoming visible', () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    controller.resume();
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onResume).not.toHaveBeenCalled();
    controller.resume();
    expect(onResume).toHaveBeenCalledTimes(1);
  });

  it('immediately pauses combat mounted in a hidden document', () => {
    controller.disconnect();
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    controller.connect();
    controller.connect();
    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('ignores focus and visibility loss outside combat', () => {
    canPause = false;
    window.dispatchEvent(new Event('blur'));
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(onPause).not.toHaveBeenCalled();
  });

  it('disconnects without resuming a disposed loop', () => {
    controller.pause();
    controller.disconnect();
    controller.pause();
    controller.resume();
    press('KeyP');
    window.dispatchEvent(new Event('blur'));
    expect(onPause).toHaveBeenCalledTimes(1);
    expect(onResume).not.toHaveBeenCalled();
  });

  it('clears held controls without emitting menu actions', () => {
    const input = new InputManager();
    input.setContext('combat');
    input.connect();
    const menuAction = vi.fn();
    input.subscribeToMenu(menuAction);
    onPause.mockImplementation(() => input.setContext('menu'));
    onResume.mockImplementation(() => input.setContext('combat'));
    try {
      press('Space');
      press('KeyD');
      input.setVirtualControl('secondary', true);
      expect(input.readCommand().firePrimary).toBe(true);
      press('Escape');
      expect(menuAction).not.toHaveBeenCalled();
      press('Escape');
      press('Space', { repeat: true });
      press('KeyD', { repeat: true });
      expect(input.readCommand()).toEqual({
        move: 0,
        firePrimary: false,
        fireSecondary: false,
        activateSkill: false,
        boost: false,
        activateBreakthrough: false,
      });
      press('Space');
      expect(input.readCommand().firePrimary).toBe(true);
    } finally {
      input.disconnect();
    }
  });

  it('stops frames and discards paused time on resume', () => {
    const frames = new Map<number, FrameRequestCallback>();
    let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    const frame = (time: number) => {
      const callbacks = [...frames.values()];
      frames.clear();
      callbacks.forEach((callback) => callback(time));
    };
    const update = vi.fn();
    const render = vi.fn();
    const loop = new FixedStepLoop(update, render);
    onPause.mockImplementation(() => loop.stop());
    onResume.mockImplementation(() => loop.start());
    try {
      loop.start();
      frame(1000);
      frame(1020);
      expect(update).toHaveBeenCalledTimes(1);
      controller.pause();
      expect(frames.size).toBe(0);
      frame(60_000);
      expect(update).toHaveBeenCalledTimes(1);
      expect(render).toHaveBeenCalledTimes(2);
      controller.resume();
      frame(120_000);
      expect(update).toHaveBeenCalledTimes(1);
      frame(120_020);
      expect(update).toHaveBeenCalledTimes(2);
    } finally {
      loop.stop();
    }
  });
});
