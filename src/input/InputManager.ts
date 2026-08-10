import type { Movement, PlayerCommand } from '../game/simulation/types';

export class InputManager {
  private readonly pressed = new Set<string>();

  constructor(private readonly target: Window = window) {}

  connect(): void {
    this.target.addEventListener('keydown', this.onKeyDown);
    this.target.addEventListener('keyup', this.onKeyUp);
  }

  disconnect(): void {
    this.target.removeEventListener('keydown', this.onKeyDown);
    this.target.removeEventListener('keyup', this.onKeyUp);
    this.pressed.clear();
  }

  readCommand(): PlayerCommand {
    let move: Movement = 0;
    if (this.pressed.has('ArrowLeft') || this.pressed.has('KeyA')) move = -1;
    if (this.pressed.has('ArrowRight') || this.pressed.has('KeyD')) move = 1;

    return {
      move,
      firePrimary: this.pressed.has('Space'),
      fireSecondary: this.pressed.has('ShiftLeft') || this.pressed.has('KeyE'),
      activateSkill: this.pressed.has('KeyQ'),
    };
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
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
}
