import type { MutableRefObject, MouseEvent as ReactMouseEvent } from 'react';
import { isPrimeSlotForTraitPlanning } from '../../../core/clockwork';
import type { DragPayload, ForgeCard } from './types';
import { QueueSlot } from './QueueSlot';

interface BattleProgramSectionProps {
  queue: (ForgeCard | null)[];
  /** How many left-to-right slots participate in combat (5–9). The rest are locked. */
  activeProgramSlots: number;
  dragOverSlot: number | null;
  dragging: DragPayload | null;
  dragPayloadRef: MutableRefObject<DragPayload | null>;
  setDragging: (p: DragPayload | null) => void;
  setDragOverSlot: (n: number | null) => void;
  setHover: (h: { card: ForgeCard; x: number; y: number } | null) => void;
  setHoverCardAt: (card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => void;
  clearSlot: (idx: number) => void;
  onQueueContextMenu: (e: ReactMouseEvent<HTMLElement>, slotIndex: number | null) => void;
  handleDropOnSlot: (slotIndex: number, payload: DragPayload) => void;
  sectionTitle?: string;
  sectionSubtitle?: string;
  readOnly?: boolean;
  /** Pilot + relic traits — used to mark Prime slots (player forge). Omit for natural 3/5/7 only. */
  primeTraitIds?: readonly string[];
  faction?: string;
}

export function BattleProgramSection({
  queue,
  activeProgramSlots,
  dragOverSlot,
  dragging,
  dragPayloadRef,
  setDragging,
  setDragOverSlot,
  setHover,
  setHoverCardAt,
  clearSlot,
  onQueueContextMenu,
  handleDropOnSlot,
  sectionTitle = 'BATTLE PROGRAM',
  sectionSubtitle = 'Instruction sequence · executes left to right each round',
  readOnly = false,
  primeTraitIds = [],
  faction,
}: BattleProgramSectionProps) {
  const maxSlot = activeProgramSlots;
  const filledCount = queue.slice(0, maxSlot).filter((c) => c !== null).length;
  return (
    <section className="forge-poc__program">
      <div className="forge-poc__program-head">
        <span className="forge-poc__section-eyebrow">{'//'} {sectionTitle}</span>
        <span className="forge-poc__program-sub">{sectionSubtitle}</span>
        <span className="forge-poc__program-count">
          <span className="forge-poc__program-count-value">{filledCount}</span>
          <span className="forge-poc__program-count-max">/{String(maxSlot)}</span>
          <span className="forge-poc__program-count-label">SLOTS</span>
        </span>
      </div>
      <div
        className={`forge-poc__queue${readOnly ? ' forge-poc__queue--read-only' : ''}`}
        onContextMenu={(e) => {
          if (!readOnly) onQueueContextMenu(e, null);
        }}
      >
        {queue.map((card, idx) => {
          const locked = idx >= maxSlot;
          return (
          <QueueSlot
            key={idx}
            index={idx}
            card={card}
            locked={locked}
            isPrime={!locked && isPrimeSlotForTraitPlanning(idx, primeTraitIds, faction)}
            primeTraitIds={primeTraitIds}
            faction={faction}
            isDragOver={!locked && dragOverSlot === idx}
            onHover={setHoverCardAt}
            onClear={() => clearSlot(idx)}
            onContextMenu={(e) => {
              if (locked || readOnly) {
                e.preventDefault();
                return;
              }
              onQueueContextMenu(e, idx);
            }}
            onDragStart={(e) => {
              if (!card || locked || readOnly) return;
              const payload: DragPayload = { source: 'queue', index: idx };
              dragPayloadRef.current = payload;
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('application/json', JSON.stringify(payload));
              setDragging(payload);
              setHover(null);
            }}
            onDragEnd={() => {
              dragPayloadRef.current = null;
              setDragging(null);
              setDragOverSlot(null);
            }}
            onDragOver={(e) => {
              if (locked || readOnly) return;
              if (!dragging) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverSlot !== idx) setDragOverSlot(idx);
            }}
            onDragLeave={() => {
              if (dragOverSlot === idx) setDragOverSlot(null);
            }}
            onDrop={(e) => {
              if (locked || readOnly) {
                e.preventDefault();
                return;
              }
              e.preventDefault();
              const raw = e.dataTransfer.getData('application/json');
              if (!raw) return;
              try {
                const payload = JSON.parse(raw) as DragPayload;
                handleDropOnSlot(idx, payload);
              } catch {
                /* ignore malformed transfer */
              }
              setDragging(null);
              setDragOverSlot(null);
            }}
          />
        );
        })}
      </div>
    </section>
  );
}
