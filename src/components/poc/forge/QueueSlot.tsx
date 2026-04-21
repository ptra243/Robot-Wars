import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { ForgeCard } from './types';

interface QueueSlotProps {
  index: number;
  card: ForgeCard | null;
  isDragOver: boolean;
  onHover: (c: ForgeCard | null, ev?: { clientX: number; clientY: number }) => void;
  onClear: () => void;
  onContextMenu: (e: ReactMouseEvent<HTMLElement>) => void;
  onDragStart: (e: ReactDragEvent<HTMLElement>) => void;
  onDragEnd: (e: ReactDragEvent<HTMLElement>) => void;
  onDragOver: (e: ReactDragEvent<HTMLElement>) => void;
  onDragLeave: (e: ReactDragEvent<HTMLElement>) => void;
  onDrop: (e: ReactDragEvent<HTMLElement>) => void;
}

export function QueueSlot({
  index,
  card,
  isDragOver,
  onHover,
  onClear,
  onContextMenu,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: QueueSlotProps) {
  const dropClass = isDragOver ? ' forge-poc__slot--drop-target' : '';

  if (!card) {
    return (
      <div
        className={`forge-poc__slot forge-poc__slot--empty${dropClass}`}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="forge-poc__slot-index">{String(index + 1).padStart(2, '0')}</div>
        <div className="forge-poc__slot-hex">+</div>
        <div className="forge-poc__slot-empty-label">EMPTY</div>
      </div>
    );
  }

  return (
    <div
      className={`forge-poc__slot forge-poc__slot--${card.faction}${dropClass}`}
      draggable
      onMouseEnter={(e) => onHover(card, e)}
      onMouseMove={(e) => onHover(card, e)}
      onMouseLeave={() => onHover(null)}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="forge-poc__slot-index">{String(index + 1).padStart(2, '0')}</div>
      <div className="forge-poc__slot-cost-badge" aria-label={`Energy cost ${String(card.cost)}`}>
        <span className="forge-poc__slot-cost-label">EN</span>
        <span className="forge-poc__slot-cost-value">{card.cost}</span>
      </div>
      <div
        className="forge-poc__slot-art"
        style={{ backgroundImage: `url(${card.art})` }}
      />
      <div className="forge-poc__slot-gloss" />
      <div className="forge-poc__slot-footer">
        <span className="forge-poc__slot-name">{card.name}</span>
      </div>
      <button
        type="button"
        className="forge-poc__slot-remove"
        onClick={onClear}
        aria-label={`Remove from slot ${String(index + 1)}`}
      >
        ✕
      </button>
    </div>
  );
}
