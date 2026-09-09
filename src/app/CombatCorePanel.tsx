import { useCallback, useEffect, useRef } from 'react';
import {
  COMBAT_CORE_DEFINITIONS,
  COMBAT_CORE_IDS,
  type CombatCoreId,
} from '../game/data/combatCoreDefinitions';
import { getCoreStatus } from '../game/simulation/combatCore';
import type { CombatCoreState } from '../game/simulation/types';
import type { InputManager } from '../input/InputManager';
import { useMenuNavigation } from '../input/useMenuNavigation';
import './combat-core.css';

export function CombatCorePanel({
  input,
  onChoose,
}: {
  input: InputManager;
  onChoose: (id: CombatCoreId) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const confirm = useCallback(
    (index: number) => {
      const id = COMBAT_CORE_IDS[index];
      if (id) onChoose(id);
    },
    [onChoose],
  );
  const navigation = useMenuNavigation({
    input,
    itemCount: COMBAT_CORE_IDS.length,
    shortcuts: true,
    onConfirm: confirm,
  });
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  useEffect(() => {
    const dialog = dialogRef.current;
    const card = dialog?.querySelector<HTMLElement>(
      `[data-core="${COMBAT_CORE_IDS[navigation.selectedIndex]}"]`,
    );
    if (!dialog || !card) return;
    // Scroll this dialog, never the fixed game viewport behind it.
    if (navigation.selectedIndex === 0) {
      dialog.scrollTop = 0;
      return;
    }
    const bounds = dialog.getBoundingClientRect();
    const item = card.getBoundingClientRect();
    if (item.top < bounds.top + 8)
      dialog.scrollTop += item.top - bounds.top - 8;
    else if (item.bottom > bounds.bottom - 8)
      dialog.scrollTop += item.bottom - bounds.bottom + 8;
  }, [navigation.selectedIndex]);
  return (
    <dialog
      ref={dialogRef}
      className="core-choice-panel"
      aria-labelledby="core-choice-title"
      aria-describedby="core-choice-description"
      onCancel={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        event.preventDefault();
        navigation.select(
          (navigation.selectedIndex +
            (event.shiftKey ? -1 : 1) +
            COMBAT_CORE_IDS.length) %
            COMBAT_CORE_IDS.length,
        );
      }}
    >
      <header>
        <span>第1戦 制圧報酬 / 改造コア</span>
        <h1 id="core-choice-title">この遠征の戦い方を決めよう</h1>
        <p id="core-choice-description">
          3つから1つ選択。遠征中は変更不可。モジュール枠は使わず、この後に通常の戦利品も選べます。
        </p>
        <small>A・D / ←・→ / TAB 選択 / SPACE・ENTER 決定 / 1〜3 即決</small>
        <small className="core-scroll-hint">
          下にスクロールして3つのコアを比べよう
        </small>
      </header>
      <div className="core-choice-grid">
        {COMBAT_CORE_IDS.map((id, index) => {
          const core = COMBAT_CORE_DEFINITIONS[id];
          return (
            <button
              type="button"
              data-core={id}
              key={id}
              className={`core-choice-card${navigation.selectedIndex === index ? ' selected' : ''}`}
              {...navigation.bindItem(index)}
              onClick={() => onChoose(id)}
              aria-label={`${core.displayName}を搭載`}
            >
              <span className="core-style">
                0{index + 1} / {core.style}
              </span>
              <strong>{core.displayName}</strong>
              <span className="core-sequence">{core.sequence}</span>
              <span>{core.description}</span>
              <span className="core-tradeoff">条件：{core.tradeoff}</span>
              <span className="core-equipment">
                装備の狙い：{core.equipmentHint}
              </span>
              <b className="core-choice-action">このコアで進む →</b>
            </button>
          );
        })}
      </div>
    </dialog>
  );
}

export function CombatCoreHud({
  id,
  state,
  position,
}: {
  id: CombatCoreId;
  state: CombatCoreState;
  position: number;
}) {
  const definition = COMBAT_CORE_DEFINITIONS[id];
  const status = getCoreStatus(id, state, position);
  return (
    <aside
      className={`core-hud${status.ready ? ' ready' : ''}`}
      aria-label="改造コア"
      title={`${definition.description} ${definition.tradeoff} 詳細は一時停止の操作ガイドへ。`}
    >
      <strong>{definition.displayName}</strong>
      <span>{status.label}</span>
      <progress
        aria-label={`${definition.displayName}の準備状況`}
        value={status.value}
        max={status.max}
      />
    </aside>
  );
}

export function CoreBuildHint({ id }: { id?: CombatCoreId }) {
  if (!id) return null;
  const core = COMBAT_CORE_DEFINITIONS[id];
  return (
    <small className="core-build-hint">
      改造コア：{core.displayName} — {core.equipmentHint}
    </small>
  );
}
