import type { Movement, PlayerCommand } from '../game/simulation/types';
import { withActionTime } from '../game/simulation/actionTime';

export type InputContext = 'combat' | 'menu';
export type MenuAction =
  | 'previous'
  | 'next'
  | 'confirm'
  | 'cancel'
  | 'shortcut-1'
  | 'shortcut-2'
  | 'shortcut-3';
export type MenuActionListener = (action: MenuAction) => void;

const MENU_ACTION_BY_CODE: Readonly<Record<string, MenuAction>> = {
  ArrowLeft: 'previous',
  KeyA: 'previous',
  ArrowRight: 'next',
  KeyD: 'next',
  Space: 'confirm',
  Enter: 'confirm',
  Escape: 'cancel',
  Digit1: 'shortcut-1',
  Numpad1: 'shortcut-1',
  Digit2: 'shortcut-2',
  Numpad2: 'shortcut-2',
  Digit3: 'shortcut-3',
  Numpad3: 'shortcut-3',
};

const REPEATABLE_MENU_ACTIONS = new Set<MenuAction>(['previous', 'next']);

export class InputManager {
  private readonly pressed = new Set<string>();
  private readonly virtual = new Set<VirtualControl>();
  private readonly menuListeners = new Set<MenuActionListener>();
  private context: InputContext = 'menu';
  private breakthroughPending = false;

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
    this.menuListeners.clear();
    this.reset();
  }

  setContext(context: InputContext): void {
    if (this.context === context) return;
    this.reset();
    this.context = context;
  }

  readonly reset = (): void => {
    this.pressed.clear();
    this.virtual.clear();
    this.breakthroughPending = false;
  };

  setVirtualControl(control: VirtualControl, active: boolean): void {
    if (active && this.context === 'combat') {
      this.virtual.add(control);
    } else {
      this.virtual.delete(control);
    }
  }

  requestBreakthrough(): void {
    if (this.context === 'combat') this.breakthroughPending = true;
  }

  subscribeToMenu(listener: MenuActionListener): () => void {
    this.menuListeners.add(listener);
    return () => this.menuListeners.delete(listener);
  }

  readCommand(): PlayerCommand {
    if (this.context !== 'combat') return IDLE_COMMAND;

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

    const command: PlayerCommand = {
      move,
      firePrimary: this.pressed.has('Space') || this.virtual.has('primary'),
      fireSecondary: this.pressed.has('KeyC') || this.virtual.has('secondary'),
      activateSkill: this.pressed.has('KeyF') || this.virtual.has('parry'),
      boost: this.pressed.has('ShiftLeft') || this.virtual.has('boost'),
      activateBreakthrough: this.breakthroughPending,
    };
    this.breakthroughPending = false;
    return withActionTime(command);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (this.context === 'menu') {
      this.handleMenuKeyDown(event);
      return;
    }
    if (event.code === 'KeyE') {
      if (
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.isComposing ||
        isTextEntry(event)
      )
        return;
      event.preventDefault();
      if (!event.repeat && !this.pressed.has(event.code))
        this.requestBreakthrough();
    }
    if (event.repeat && !this.pressed.has(event.code)) return;
    if (
      ['ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft'].includes(event.code)
    ) {
      event.preventDefault();
    }
    this.pressed.add(event.code);
  };

  private handleMenuKeyDown(event: KeyboardEvent): void {
    if (event.altKey || event.ctrlKey || event.metaKey || isTextEntry(event)) {
      return;
    }
    const action = MENU_ACTION_BY_CODE[event.code];
    if (!action) return;
    if (event.repeat && !REPEATABLE_MENU_ACTIONS.has(action)) {
      if (action === 'confirm' && event.target instanceof HTMLButtonElement) {
        event.preventDefault();
      }
      return;
    }
    if (action === 'confirm' && event.target instanceof HTMLButtonElement) {
      return;
    }
    event.preventDefault();
    for (const listener of this.menuListeners) listener(action);
  }

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressed.delete(event.code);
  };

  private readonly onVisibilityChange = (): void => {
    if (this.target.document.hidden) this.reset();
  };
}

const IDLE_COMMAND: PlayerCommand = {
  move: 0,
  firePrimary: false,
  fireSecondary: false,
  activateSkill: false,
  boost: false,
  activateBreakthrough: false,
};

function isTextEntry(event: KeyboardEvent): boolean {
  const target = event.target;
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

export type VirtualControl =
  | 'move-left'
  | 'move-right'
  | 'primary'
  | 'secondary'
  | 'parry'
  | 'boost';
