import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { ForgeCard } from './types';

interface LibraryCardProps {
  card: ForgeCard;
  isDragging: boolean;
  isMergeTarget?: boolean;
  onHover: (c: ForgeCard | null, ev?: { clientX: number; clientY: number }) => void;
  onAssign: () => void;
  onDragStart?: (e: ReactDragEvent<HTMLElement>) => void;
  onDragEnd?: (e: ReactDragEvent<HTMLElement>) => void;
  onContextMenu?: (e: ReactMouseEvent<HTMLElement>) => void;
  onDragOver?: (e: ReactDragEvent<HTMLElement>) => void;
  onDragLeave?: (e: ReactDragEvent<HTMLElement>) => void;
  onDrop?: (e: ReactDragEvent<HTMLElement>) => void;
  /** Draft / pick UI: no drag; click selects (forge hand uses drag + double-click). */
  pickMode?: boolean;
  onPick?: () => void;
}

export function LibraryCard({
  card,
  isDragging,
  isMergeTarget = false,
  onHover,
  onAssign,
  onDragStart,
  onDragEnd,
  onContextMenu,
  onDragOver,
  onDragLeave,
  onDrop,
  pickMode = false,
  onPick,
}: LibraryCardProps) {
  return (
    <button
      type="button"
      draggable={!pickMode}
      className={`forge-poc__libcard forge-poc__libcard--${card.faction}${
        isDragging ? ' forge-poc__libcard--dragging' : ''
      }${isMergeTarget ? ' forge-poc__libcard--merge-target' : ''}${
        pickMode ? ' forge-poc__libcard--pick' : ''
      }`}
      onClick={pickMode ? () => onPick?.() : undefined}
      onDoubleClick={pickMode ? undefined : onAssign}
      onMouseEnter={(e) => onHover(card, e)}
      onMouseMove={(e) => onHover(card, e)}
      onMouseLeave={() => onHover(null)}
      onDragStart={pickMode ? undefined : onDragStart}
      onDragEnd={pickMode ? undefined : onDragEnd}
      onContextMenu={pickMode ? undefined : onContextMenu}
      onDragOver={pickMode ? undefined : onDragOver}
      onDragLeave={pickMode ? undefined : onDragLeave}
      onDrop={pickMode ? undefined : onDrop}
    >
      <div
        className="forge-poc__libcard-art"
        style={{ backgroundImage: `url(${card.art})` }}
      >
        <div className="forge-poc__libcard-scrim" />
        <div className="forge-poc__libcard-tier">T{card.tier}</div>
        <div className="forge-poc__libcard-cost">
          <span className="forge-poc__libcard-cost-label">EN</span>
          <span className="forge-poc__libcard-cost-value">{card.cost}</span>
        </div>
      </div>
      <div className="forge-poc__libcard-body">
        <div className="forge-poc__libcard-name">{card.name}</div>
        <div className="forge-poc__libcard-stats">
          {card.atk !== undefined ? (
            <span className="forge-poc__stat-atk">ATK {card.atk}</span>
          ) : null}
          {card.def !== undefined ? (
            <span className="forge-poc__stat-def">DEF {card.def}</span>
          ) : null}
        </div>
      </div>
    </button>
  );
}
