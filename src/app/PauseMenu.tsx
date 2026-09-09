import { useEffect, useRef } from 'react';
import './pause.css';

export function PauseMenu({ onResume }: { onResume: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="pause-menu"
      aria-labelledby="pause-title"
      aria-describedby="pause-description"
      onCancel={(event) => {
        event.preventDefault();
        onResume();
      }}
    >
      <header>
        <span>ひと息つこう</span>
        <h1 id="pause-title">一時停止中</h1>
        <p id="pause-description">
          戦闘とタイム計測を停止しています。
          <br />
          準備ができたら再開しよう。
        </p>
      </header>
      <section aria-labelledby="pause-controls-title">
        <h2 id="pause-controls-title">操作ガイド</h2>
        <dl className="pause-controls">
          <div>
            <dt>後退 / 前進</dt>
            <dd>
              <kbd>A</kbd> / <kbd>D</kbd> または <kbd>←</kbd> / <kbd>→</kbd>
            </dd>
          </div>
          <div>
            <dt>主武器</dt>
            <dd>
              <kbd>SPACE</kbd>
            </dd>
          </div>
          <div>
            <dt>副武器</dt>
            <dd>
              <kbd>C</kbd>
            </dd>
          </div>
          <div>
            <dt>迎撃パリィ</dt>
            <dd>
              <kbd>F</kbd>
            </dd>
          </div>
          <div>
            <dt>急加速</dt>
            <dd>
              <kbd>左SHIFT</kbd>
            </dd>
          </div>
          <div>
            <dt>前線突破</dt>
            <dd>
              <kbd>E</kbd> / ボタンをタップ
            </dd>
          </div>
          <div>
            <dt>停止 / 再開</dt>
            <dd>
              <kbd>ESC</kbd> / <kbd>P</kbd>
            </dd>
          </div>
        </dl>
        <p className="pause-touch-hint">
          25mより前での命中やパリィで突破ゲージを蓄積。満タンでEを押すと敵弾一掃・排熱と4秒の連射強化。弾薬は消費し、無敵にはなりません。
          未使用ゲージは次の戦闘へ持ち越せます。
          移動・射撃のタッチ操作は画面左右のボタンを長押し。
          タブやウィンドウを離れると自動で一時停止します。
        </p>
      </section>
      <button type="button" className="pause-resume" onClick={onResume}>
        戦闘を再開
      </button>
    </dialog>
  );
}
