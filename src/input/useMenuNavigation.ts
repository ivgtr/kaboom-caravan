import { useCallback, useEffect, useRef, useState } from 'react';
import type { InputManager, MenuAction } from './InputManager';

interface MenuNavigationOptions {
  input: InputManager;
  itemCount: number;
  enabled?: boolean;
  initialIndex?: number;
  isItemDisabled?: (index: number) => boolean;
  shortcuts?: boolean;
  onConfirm: (index: number) => void;
  onCancel?: () => void;
}

interface MenuItemBindings {
  ref: (element: HTMLButtonElement | null) => void;
  tabIndex: 0 | -1;
  onFocus: () => void;
  onPointerEnter: () => void;
}

const SHORTCUT_INDEX: Partial<Record<MenuAction, number>> = {
  'shortcut-1': 0,
  'shortcut-2': 1,
  'shortcut-3': 2,
};

export function useMenuNavigation({
  input,
  itemCount,
  enabled = true,
  initialIndex = 0,
  isItemDisabled,
  shortcuts = false,
  onConfirm,
  onCancel,
}: MenuNavigationOptions) {
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndexRef = useRef(initialIndex);
  const [selectedIndex, setSelectedIndexState] = useState(initialIndex);

  const isDisabled = useCallback(
    (index: number) =>
      index < 0 || index >= itemCount || Boolean(isItemDisabled?.(index)),
    [isItemDisabled, itemCount],
  );

  const findEnabledIndex = useCallback(
    (start: number, direction: -1 | 1): number => {
      if (itemCount === 0) return -1;
      for (let offset = 0; offset < itemCount; offset += 1) {
        const index = (start + direction * offset + itemCount * 2) % itemCount;
        if (!isDisabled(index)) return index;
      }
      return -1;
    },
    [isDisabled, itemCount],
  );

  const select = useCallback(
    (index: number, focus = true) => {
      if (isDisabled(index)) return;
      selectedIndexRef.current = index;
      setSelectedIndexState(index);
      if (focus) itemRefs.current[index]?.focus({ preventScroll: true });
    },
    [isDisabled],
  );

  const move = useCallback(
    (direction: -1 | 1) => {
      const current = selectedIndexRef.current;
      const next = findEnabledIndex(current + direction, direction);
      if (next >= 0) select(next);
    },
    [findEnabledIndex, select],
  );

  useEffect(() => {
    if (!enabled) return;
    const current = selectedIndexRef.current;
    const next = isDisabled(current)
      ? findEnabledIndex(initialIndex, 1)
      : current;
    if (next >= 0) select(next);
  }, [enabled, findEnabledIndex, initialIndex, isDisabled, select]);

  useEffect(() => {
    if (!enabled) return;
    return input.subscribeToMenu((action) => {
      if (action === 'previous') {
        move(-1);
        return;
      }
      if (action === 'next') {
        move(1);
        return;
      }
      if (action === 'confirm') {
        const index = selectedIndexRef.current;
        if (!isDisabled(index)) onConfirm(index);
        return;
      }
      if (action === 'cancel') {
        onCancel?.();
        return;
      }
      const shortcutIndex = SHORTCUT_INDEX[action];
      if (
        shortcuts &&
        shortcutIndex !== undefined &&
        !isDisabled(shortcutIndex)
      ) {
        select(shortcutIndex);
        onConfirm(shortcutIndex);
      }
    });
  }, [
    enabled,
    input,
    isDisabled,
    move,
    onCancel,
    onConfirm,
    select,
    shortcuts,
  ]);

  const bindItem = useCallback(
    (index: number): MenuItemBindings => ({
      ref: (element) => {
        itemRefs.current[index] = element;
      },
      tabIndex: selectedIndex === index ? 0 : -1,
      onFocus: () => select(index, false),
      onPointerEnter: () => select(index),
    }),
    [select, selectedIndex],
  );

  return { bindItem, selectedIndex, select };
}
