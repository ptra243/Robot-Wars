import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { PrimeSlotMark } from '../../../ui/PrimeSlotMark';
import type { ForgeCard } from './types';

interface QueueSlotProps {
  index: number;
  card: ForgeCard | null;
  /** Inactive program slot (e.g. act 1 = first 5 active, rest locked). */
  locked?: boolean;
  isPrime?: boolean;
  primeTraitIds?: readonly string[];
  faction?: string;
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
  locked = false,
  isPrime = false,
  primeTraitIds = [],
  faction,
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
  const lockedClass = locked ? ' forge-poc__slot--locked' : '';
  const primeClass = isPrime && !locked ? ' forge-poc__slot--prime' : '';

  if (!card) {
    return (
      <div
        className={`forge-poc__slot forge-poc__slot--empty${dropClass}${lockedClass}${primeClass}`}
        onContextMenu={onContextMenu}
        onDragOver={locked ? undefined : onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        <div className="forge-poc__slot-index">{String(index + 1).padStart(2, '0')}</div>
        {isPrime && !locked ? (
          <PrimeSlotMark
            slotIndex={index}
            traitIds={primeTraitIds}
            faction={faction}
            className="forge-poc__prime-mark"
          />
        ) : null}
        {locked ? (
          <>
            <div className="forge-poc__slot-hex" aria-hidden>
              ·
            </div>
            <div className="forge-poc__slot-empty-label">LOCKED</div>
            <div className="forge-poc__slot-locked-hint">Unlocked in later acts</div>
          </>
        ) : (
          <>
            <div className="forge-poc__slot-hex">+</div>
            <div className="forge-poc__slot-empty-label">EMPTY</div>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      className={`forge-poc__slot forge-poc__slot--${card.faction}${dropClass}${lockedClass}${primeClass}${
        locked ? ' forge-poc__slot--read-only' : ''
      }`}
      draggable={!locked}
      onMouseEnter={locked ? undefined : (e) => onHover(card, e)}
      onMouseMove={locked ? undefined : (e) => onHover(card, e)}
      onMouseLeave={locked ? undefined : () => onHover(null)}
      onContextMenu={onContextMenu}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className="forge-poc__slot-index">{String(index + 1).padStart(2, '0')}</div>
      {isPrime && !locked ? (
        <PrimeSlotMark
          slotIndex={index}
          traitIds={primeTraitIds}
          faction={faction}
          className="forge-poc__prime-mark"
        />
      ) : null}
      <div
        className={[
          'forge-poc__slot-cost-badge',
          card.hpPlayCost !== undefined ? 'forge-poc__slot-cost-badge--hp' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        aria-label={
          card.hpPlayCost !== undefined
            ? `HP cost ${String(card.hpPlayCost)}`
            : `Energy cost ${String(card.cost)}`
        }
      >
        <span className="forge-poc__slot-cost-label">
          {card.hpPlayCost !== undefined ? 'HP' : 'EN'}
        </span>
        <span className="forge-poc__slot-cost-value">
          {card.hpPlayCost !== undefined ? card.hpPlayCost : card.cost}
        </span>
      </div>
      <div
        className={`forge-poc__slot-art${
          card.artFocus === 'core-reactor' ? ' forge-poc__slot-art--core-reactor' : ''
        }`}
        style={card.artFocus === 'core-reactor' ? undefined : { backgroundImage: `url(${card.art})` }}
      >
        {card.artFocus === 'core-reactor' ? (
          <>
            <div className="forge-poc__slot-art-void" aria-hidden />
            <div className="forge-poc__slot-art-bgi">
              <img
                className="forge-poc__slot-art-bgi-img"
                src={card.art}
                alt=""
                draggable={false}
              />
            </div>
          </>
        ) : null}
      </div>
      <div className="forge-poc__slot-gloss" />
      <div className="forge-poc__slot-footer">
        <span className="forge-poc__slot-name">{card.name}</span>
      </div>
      {locked ? null : (
        <button
          type="button"
          className="forge-poc__slot-remove"
          onClick={onClear}
          aria-label={`Remove from slot ${String(index + 1)}`}
        >
          ✕
        </button>
      )}
    </div>
  );
}
