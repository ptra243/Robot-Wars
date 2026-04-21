import type { ContextMenuState } from './types';

interface ContextMenuProps {
  menu: ContextMenuState;
  onShiftLeft: () => void;
  onShiftRight: () => void;
  canShiftLeft: boolean;
  canShiftRight: boolean;
  onReroll?: () => void;
  canReroll?: boolean;
  rerolls?: number;
  onScrap?: () => void;
  canScrap?: boolean;
  onViewTiers?: () => void;
}

export function ContextMenu({
  menu,
  onShiftLeft,
  onShiftRight,
  canShiftLeft,
  canShiftRight,
  onReroll,
  canReroll,
  rerolls = 0,
  onScrap,
  canScrap,
  onViewTiers,
}: ContextMenuProps) {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const isHandMenu = menu.handIndex !== undefined;
  const MENU_W = 220;
  const hasExtraHand = Boolean(onScrap || onViewTiers);
  const MENU_H = isHandMenu ? (hasExtraHand ? 200 : 80) : 110;
  const left = Math.min(menu.x, vw - MENU_W - 8);
  const top = Math.min(menu.y, vh - MENU_H - 8);

  return (
    <div
      className="forge-poc__ctxmenu"
      style={{ left, top }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      {isHandMenu ? (
        <>
          <div className="forge-poc__ctxmenu-head">Hand card</div>
          <button
            type="button"
            className="forge-poc__ctxmenu-item"
            onClick={onReroll}
            disabled={!canReroll}
          >
            <span className="forge-poc__ctxmenu-icon">↻</span>
            Reroll
            <span className="forge-poc__ctxmenu-hint">{rerolls} left</span>
          </button>
          {onViewTiers ? (
            <button type="button" className="forge-poc__ctxmenu-item" onClick={onViewTiers}>
              <span className="forge-poc__ctxmenu-icon">◇</span>
              View card tiers
            </button>
          ) : null}
          {onScrap ? (
            <button
              type="button"
              className="forge-poc__ctxmenu-item"
              onClick={onScrap}
              disabled={!canScrap}
            >
              <span className="forge-poc__ctxmenu-icon">⛁</span>
              Scrap (+50g, +1 reroll)
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div className="forge-poc__ctxmenu-head">
            {menu.slotIndex !== null
              ? `Program slot ${String(menu.slotIndex + 1)}`
              : 'Battle Program'}
          </div>
          <button
            type="button"
            className="forge-poc__ctxmenu-item"
            onClick={onShiftLeft}
            disabled={!canShiftLeft}
          >
            <span className="forge-poc__ctxmenu-icon">◂◂</span>
            Shift Left
            <span className="forge-poc__ctxmenu-hint">→ hand</span>
          </button>
          <button
            type="button"
            className="forge-poc__ctxmenu-item"
            onClick={onShiftRight}
            disabled={!canShiftRight}
          >
            <span className="forge-poc__ctxmenu-icon">▸▸</span>
            Shift Right
            <span className="forge-poc__ctxmenu-hint">→ hand</span>
          </button>
        </>
      )}
    </div>
  );
}
