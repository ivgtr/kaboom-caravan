interface CombatPauseOptions {
  canPause: () => boolean;
  onPause: () => void;
  onResume: () => void;
}

/** Coordinates pause intent without changing the run or combat state. */
export class CombatPauseController {
  private paused = false;
  private connected = false;

  constructor(
    private readonly options: CombatPauseOptions,
    private readonly target: Window = window,
  ) {}

  connect(): void {
    if (this.connected) return;
    this.connected = true;
    this.target.addEventListener('keydown', this.onKeyDown, true);
    this.target.addEventListener('blur', this.pause);
    this.target.document.addEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );
    this.onVisibilityChange();
  }

  disconnect(): void {
    this.connected = false;
    this.target.removeEventListener('keydown', this.onKeyDown, true);
    this.target.removeEventListener('blur', this.pause);
    this.target.document.removeEventListener(
      'visibilitychange',
      this.onVisibilityChange,
    );
    // Teardown must not restart a loop that is being disposed.
    this.paused = false;
  }

  readonly pause = (): void => {
    if (!this.connected || this.paused || !this.options.canPause()) return;
    this.paused = true;
    this.options.onPause();
  };

  readonly resume = (): void => {
    if (!this.connected || !this.paused || this.target.document.hidden) return;
    this.paused = false;
    this.options.onResume();
  };

  private readonly onVisibilityChange = (): void => {
    if (this.target.document.hidden) this.pause();
    // Becoming visible never resumes combat; the player must opt in.
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      (event.code !== 'Escape' && event.code !== 'KeyP') ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      isTextEntry(event.target) ||
      (!this.paused && !this.options.canPause())
    ) {
      return;
    }
    // Consume repeats too, so a held key cannot toggle or reach menu input.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (event.repeat) return;
    if (this.paused) this.resume();
    else this.pause();
  };
}

function isTextEntry(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || target.matches('input, textarea, select'))
  );
}
