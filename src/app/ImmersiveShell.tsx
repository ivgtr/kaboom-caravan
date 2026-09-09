import { useEffect, useState, type ReactNode } from 'react';
import { COMBAT_PAUSE_REQUEST_EVENT } from '../input/CombatPauseController';

export interface ImmersiveViewportState {
  blocked: boolean;
  coarsePointer: boolean;
  fullscreenAvailable: boolean;
  fullscreen: boolean;
  standalone: boolean;
}

interface VisibleViewport {
  width: number;
  height: number;
  offsetTop: number;
  offsetLeft: number;
}

function minimumPositive(...values: Array<number | undefined>): number {
  const candidates = values.filter(
    (value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value > 0,
  );
  return candidates.length > 0 ? Math.min(...candidates) : 0;
}

function readVisibleViewport(): VisibleViewport {
  const viewport = window.visualViewport;
  const root = document.documentElement;
  const offsetTop = Math.max(0, viewport?.offsetTop ?? 0);
  const offsetLeft = Math.max(0, viewport?.offsetLeft ?? 0);
  const width = minimumPositive(
    viewport?.width,
    window.innerWidth - offsetLeft,
    root.clientWidth - offsetLeft,
  );
  const height = minimumPositive(
    viewport?.height,
    window.innerHeight - offsetTop,
    root.clientHeight - offsetTop,
  );
  return {
    width: width || window.innerWidth,
    height: height || window.innerHeight,
    offsetTop,
    offsetLeft,
  };
}

function isStandaloneDisplay(): boolean {
  const legacyStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  );
  return (
    legacyStandalone ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches
  );
}

function readViewportState(): ImmersiveViewportState {
  const viewport = readVisibleViewport();
  return {
    blocked: viewport.width <= viewport.height,
    coarsePointer:
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0,
    fullscreenAvailable:
      document.fullscreenEnabled &&
      typeof document.documentElement.requestFullscreen === 'function',
    fullscreen: Boolean(document.fullscreenElement),
    standalone: isStandaloneDisplay(),
  };
}

function syncVisibleViewport(): void {
  const viewport = readVisibleViewport();
  const root = document.documentElement;
  root.style.setProperty('--app-viewport-width', `${viewport.width}px`);
  root.style.setProperty('--app-viewport-height', `${viewport.height}px`);
  root.style.setProperty('--app-viewport-top', `${viewport.offsetTop}px`);
  root.style.setProperty('--app-viewport-left', `${viewport.offsetLeft}px`);
}

export function useImmersiveViewport(): ImmersiveViewportState {
  const [state, setState] = useState(readViewportState);

  useEffect(() => {
    const pointerQuery = window.matchMedia('(pointer: coarse)');
    const standaloneQuery = window.matchMedia('(display-mode: standalone)');
    const fullscreenQuery = window.matchMedia('(display-mode: fullscreen)');
    const visualViewport = window.visualViewport;
    const update = () => {
      syncVisibleViewport();
      setState(readViewportState());
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    document.addEventListener('fullscreenchange', update);
    pointerQuery.addEventListener('change', update);
    standaloneQuery.addEventListener('change', update);
    fullscreenQuery.addEventListener('change', update);
    visualViewport?.addEventListener('resize', update);
    visualViewport?.addEventListener('scroll', update);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      document.removeEventListener('fullscreenchange', update);
      pointerQuery.removeEventListener('change', update);
      standaloneQuery.removeEventListener('change', update);
      fullscreenQuery.removeEventListener('change', update);
      visualViewport?.removeEventListener('resize', update);
      visualViewport?.removeEventListener('scroll', update);
    };
  }, []);

  return state;
}

export async function requestImmersiveFullscreen(): Promise<boolean> {
  if (
    document.fullscreenElement ||
    !document.fullscreenEnabled ||
    typeof document.documentElement.requestFullscreen !== 'function'
  ) {
    return false;
  }
  try {
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    return false;
  }
}

export function ImmersiveShell({ children }: { children: ReactNode }) {
  const viewport = useImmersiveViewport();
  const browserUiMode =
    viewport.coarsePointer && !viewport.fullscreen && !viewport.standalone;

  useEffect(() => {
    if (!viewport.blocked) return;
    window.dispatchEvent(new Event(COMBAT_PAUSE_REQUEST_EVENT));
  }, [viewport.blocked]);

  return (
    <div
      className={`immersive-shell${viewport.blocked ? ' is-viewport-blocked' : ''}${browserUiMode ? ' has-browser-ui' : ''}${viewport.standalone ? ' is-standalone' : ''}`}
      onContextMenu={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <div
        className="immersive-game-layer"
        inert={viewport.blocked ? true : undefined}
      >
        {children}
      </div>
      {viewport.blocked && (
        <section
          className="immersive-orientation-guard"
          role="dialog"
          aria-modal="true"
          aria-labelledby="immersive-orientation-title"
          aria-describedby="immersive-orientation-description"
          onKeyDown={(event) => event.stopPropagation()}
        >
          <div className="immersive-orientation-panel">
            <span className="immersive-orientation-eyebrow">DISPLAY LOCK</span>
            <span className="immersive-rotate-device" aria-hidden="true">
              <i />
            </span>
            <strong id="immersive-orientation-title">横向きでプレイ</strong>
            <p id="immersive-orientation-description">
              {viewport.coarsePointer
                ? '端末を横向きにしてください。縦長の表示中は、誤操作やレイアウト崩れを避けるため戦闘を停止します。'
                : 'ウィンドウを横長にしてください。縦長の表示中は、戦闘を停止して操作を受け付けません。'}
            </p>
            {viewport.coarsePointer &&
              viewport.fullscreenAvailable &&
              !viewport.fullscreen &&
              !viewport.standalone && (
                <button
                  type="button"
                  className="immersive-fullscreen"
                  onClick={() => void requestImmersiveFullscreen()}
                >
                  全画面表示を試す
                </button>
              )}
            {viewport.coarsePointer &&
              !viewport.fullscreenAvailable &&
              !viewport.standalone && (
                <div className="immersive-install-hint">
                  <b>ブラウザUIを消すには</b>
                  <span>共有メニュー →「ホーム画面に追加」から起動</span>
                </div>
              )}
            <small>
              横長に戻すと再開確認を表示します。通常ブラウザではURLバーが残る場合も、見えている領域へ操作UIを収めます。
            </small>
          </div>
        </section>
      )}
    </div>
  );
}
