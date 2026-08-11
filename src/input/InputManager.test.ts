import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InputManager } from './InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager(window);
    input.setContext('combat');
    input.connect();
  });

  afterEach(() => {
    input.disconnect();
  });

  it('clears keyboard and virtual controls when combat is disabled', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    input.setVirtualControl('primary', true);

    expect(input.readCommand()).toMatchObject({
      move: 1,
      firePrimary: true,
    });

    input.setContext('menu');

    expect(input.readCommand()).toMatchObject({
      move: 0,
      firePrimary: false,
    });
  });

  it('does not carry menu keys into combat', () => {
    input.setContext('menu');
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

    input.setContext('combat');

    expect(input.readCommand()).toMatchObject({
      move: 0,
      firePrimary: false,
    });
  });

  it('does not revive a cleared key from operating-system key repeat', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    input.setContext('menu');
    input.setContext('combat');
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', repeat: true }),
    );

    expect(input.readCommand().firePrimary).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(input.readCommand().firePrimary).toBe(true);
  });

  it('releases held controls when the window loses focus', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    input.setVirtualControl('move-right', true);
    window.dispatchEvent(new Event('blur'));

    expect(input.readCommand()).toMatchObject({
      move: 0,
      fireSecondary: false,
    });
  });

  it('uses C and F while emitting Shift dash once per press', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyC' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyF' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ShiftLeft' }));

    expect(input.readCommand()).toMatchObject({
      fireSecondary: true,
      activateSkill: true,
      activateDash: true,
    });
    expect(input.readCommand()).toMatchObject({
      fireSecondary: true,
      activateSkill: true,
      activateDash: false,
    });

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyC' }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyF' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' }));
    expect(input.readCommand()).toMatchObject({
      fireSecondary: false,
      activateSkill: false,
      activateDash: false,
    });
  });

  it('holds touch parry while treating touch dash as a one-shot action', () => {
    input.setVirtualControl('parry', true);
    input.setVirtualControl('dash', true);

    expect(input.readCommand()).toMatchObject({
      activateSkill: true,
      activateDash: true,
    });
    expect(input.readCommand()).toMatchObject({
      activateSkill: true,
      activateDash: false,
    });
    input.setVirtualControl('parry', false);
    expect(input.readCommand().activateSkill).toBe(false);
  });

  it('maps keyboard bindings to shared menu actions', () => {
    input.setContext('menu');
    const actions: string[] = [];
    input.subscribeToMenu((action) => actions.push(action));

    for (const code of [
      'KeyA',
      'ArrowRight',
      'Space',
      'Enter',
      'Escape',
      'Digit1',
      'Numpad2',
      'Digit3',
    ]) {
      window.dispatchEvent(new KeyboardEvent('keydown', { code }));
    }

    expect(actions).toEqual([
      'previous',
      'next',
      'confirm',
      'confirm',
      'cancel',
      'shortcut-1',
      'shortcut-2',
      'shortcut-3',
    ]);
  });

  it('repeats navigation but never repeats confirm or shortcuts', () => {
    input.setContext('menu');
    const actions: string[] = [];
    input.subscribeToMenu((action) => actions.push(action));

    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyD', repeat: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', repeat: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Digit1', repeat: true }),
    );

    expect(actions).toEqual(['next']);
  });

  it('does not intercept menu shortcuts while entering text', () => {
    input.setContext('menu');
    const actions: string[] = [];
    input.subscribeToMenu((action) => actions.push(action));
    const field = document.createElement('input');
    document.body.append(field);

    field.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyA', bubbles: true }),
    );

    expect(actions).toEqual([]);
    field.remove();
  });

  it('leaves Space and Enter activation to focused native buttons', () => {
    input.setContext('menu');
    const actions: string[] = [];
    input.subscribeToMenu((action) => actions.push(action));
    const button = document.createElement('button');
    document.body.append(button);

    const event = new KeyboardEvent('keydown', {
      code: 'Space',
      bubbles: true,
      cancelable: true,
    });
    button.dispatchEvent(event);

    expect(actions).toEqual([]);
    expect(event.defaultPrevented).toBe(false);
    button.remove();
  });
});
