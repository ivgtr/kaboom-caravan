import type { Movement, PlayerCommand } from '../game/simulation/types';

export class InputManager {
  private readonly pressed = new Set<string>();
  private readonly virtual = new Set<VirtualControl>();
  private enabled = true;

  constructor(private readonly target: Window = window) {}

  connect(): void {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
    this.target.addEventListener('blur', this.reset);
    this.target.document.addEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );
  }

  disconnect(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.target.removeEventListener('blur', this.reset);
    this.target.document.removeEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );
    this.reset();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  readonly reset = (): void => {
    this.pressed.clear();
    this.virtual.clear();
  };

  setVirtualControl(control: VirtualControl, active: boolean): void {
    if (active && this.enabled) this.virtual.add(control);
    else this.virtual.delete(control);
  }

  readCommand(): PlayerCommand {
    let move: Movement = 0;
    if (
      this.pressed.has('ArrowLeft') ||
      this.pressed.has('KeyA') ||
      this.virtual.has('move-left')
    )
      move = -1;
    if (
      this.pressed.has('ArrowRight') ||
      this.pressed.has('KeyD') ||
      this.virtual.has('move-right')
    )
      move = 1;

    return {
      move,
      firePrimary: this.pressed.has('Space') || this.virtual.has('primary'),
      fireSecondary:
        this.pressed.has('ShiftLeft') ||
        this.pressed.has('KeyE') ||
        this.virtual.has('secondary'),
      activateSkill: this.pressed.has('KeyQ') || this.virtual.has('escape'),
    };
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!this.enabled) return;
    if (event.repeat && !this.pressed.has(event.code)) return;
    if (
      ['ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft'].includes(event.code)
    ) {
      event.preventDefault();
    }
    this.pressed.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly onVisibilityChange = (): void => {
    if (this.target.document.hidden) this.reset();
  };
}

export type VirtualControl =
  'move-left' | 'move-right' | 'primary' | 'secondary' | 'escape';
