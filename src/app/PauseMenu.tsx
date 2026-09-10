import {
  BATTLEFIELD_OBJECTIVES,
  objectiveInstructions,
} from '../game/data/routeDefinitions';
import type { BattlefieldObjectiveState } from '../game/simulation/types';
import { useEffect, useRef } from 'react';
import './pause.css';
import {
  COMBAT_CORE_DEFINITIONS,
  type CombatCoreId,
} from '../game/data/combatCoreDefinitions';
import {
  requestImmersiveFullscreen,
  useImmersiveViewport,
} from './ImmersiveShell';

export function PauseMenu({
  onResume,
  objective,
  coreId,
}: {
  onResume: () => void;
  objective?: BattlefieldObjectiveState;
  coreId?: CombatCoreId;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const viewport = useImmersiveViewport();

  useEffect(() => {
    if (viewport.blocked) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus({ preventScroll: true });
      }
    };
  }, [viewport.blocked]);

  if (viewport.blocked) return null;

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
          戦闘とタイム計測を完全に停止しています。
          <br />
          ACTION TIMEの低速化とは別の、本当の一時停止です。
        </p>
      </header>
      <section aria-labelledby="pause-controls-title">
        <h2 id="pause-controls-title">操作ガイド</h2>
        <dl className="pause-controls">
          <div>
            <dt>ACTION TIME</dt>
            <dd>無入力 0.08倍 / 操作中 1.00倍</dd>
          </div>
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
            <dt>DEATH RIDE</dt>
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
          ACTION TIMEでは、何も操作しない間は敵・敵弾・増援・冷却・クールダウンを0.08倍まで遅くできます。ただし討伐タイム自体は進みます。移動・射撃・迎撃・DEATH
          RIDEを入力すると即座に1倍へ戻るため、連打するほど敵にも同じだけ時間を与えます。
          25mより前での命中やパリィで決死突破ゲージを蓄積。満タンでEを押すと敵4体を自分で追加し、4秒だけ火器3.25倍速・排熱5倍のDEATH
          RIDEへ入ります。
          敵弾も攻撃予兆も消えず、追加敵を倒し切れなければそのまま残ります。1戦1回だけ使用でき、使用後に再充填したゲージは次戦へ持ち越せます。
          移動・射撃のタッチ操作は画面左右のボタンを長押し。
          タブやウィンドウを離れると自動で一時停止します。
        </p>
      </section>
      {objective && (
        <section className="pause-objective" aria-label="寄り道の回収ルール">
          <h2>{BATTLEFIELD_OBJECTIVES[objective.kind].displayName}</h2>
          <p>{objectiveInstructions(objective.kind)}</p>
          <p>
            移動・射撃は自由。退いても進捗は残ります。期限内に全敵・敵弾を排除しても回収できます。失敗しても通常戦闘は続きます。停止中・武器箱選択中は期限も停止します。
          </p>
          <p>回収報酬：{BATTLEFIELD_OBJECTIVES[objective.kind].reward}</p>
        </section>
      )}
      {coreId && (
        <section className="pause-core" aria-label="改造コアの使い方">
          <h2>{COMBAT_CORE_DEFINITIONS[coreId].displayName}</h2>
          <p>{COMBAT_CORE_DEFINITIONS[coreId].description}</p>
          <p>{COMBAT_CORE_DEFINITIONS[coreId].tradeoff}</p>
          <p>{COMBAT_CORE_DEFINITIONS[coreId].equipmentHint}</p>
        </section>
      )}
      {viewport.coarsePointer &&
        !viewport.fullscreen &&
        !viewport.standalone &&
        (viewport.fullscreenAvailable ? (
          <button
            type="button"
            className="pause-fullscreen"
            onClick={() => void requestImmersiveFullscreen()}
          >
            URLバーを隠して全画面表示
          </button>
        ) : (
          <div className="pause-install-hint">
            <b>URLバーなしで遊ぶ</b>
            <span>
              このブラウザでは全画面化を強制できません。共有メニュー →
              「ホーム画面に追加」から起動してください。
            </span>
          </div>
        ))}
      <button type="button" className="pause-resume" onClick={onResume}>
        戦闘を再開
      </button>
    </dialog>
  );
}
