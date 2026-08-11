import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InputManager } from './InputManager';

describe('InputManager', () => {
  let input: InputManager;

  beforeEach(() => {
    input = new InputManager(window);
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

    input.setEnabled(false);

    expect(input.readCommand()).toMatchObject({
      move: 0,
      firePrimary: false,
    });
  });

  it('ignores reward keys until combat is enabled again', () => {
    input.setEnabled(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA' }));

    input.setEnabled(true);

    expect(input.readCommand()).toMatchObject({
      move: 0,
      firePrimary: false,
    });
  });

  it('does not revive a cleared key from operating-system key repeat', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    input.setEnabled(false);
    input.setEnabled(true);
    window.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'Space', repeat: true }),
    );

    expect(input.readCommand().firePrimary).toBe(false);

    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
    expect(input.readCommand().firePrimary).toBe(true);
  });

  it('releases held controls when the window loses focus', () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyE' }));
    input.setVirtualControl('move-right', true);
    window.dispatchEvent(new Event('blur'));

    expect(input.readCommand()).toMatchObject({
      move: 0,
      fireSecondary: false,
    });
  });
});
