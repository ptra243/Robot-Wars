import type { MutableRefObject, MouseEvent as ReactMouseEvent } from 'react';
import type { DragPayload, ForgeCard } from './types';
import { QueueSlot } from './QueueSlot';

interface BattleProgramSectionProps {
  queue: (ForgeCard | null)[];
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
}

export function BattleProgramSection({
  queue,
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
}: BattleProgramSectionProps) {
  const filledCount = queue.filter((c) => c !== null).length;

  return (
    <section className="forge-poc__program">
      <div className="forge-poc__program-head">
        <span className="forge-poc__section-eyebrow">{'//'} BATTLE PROGRAM</span>
        <span className="forge-poc__program-sub">
          Instruction sequence · executes left to right each round
        </span>
        <span className="forge-poc__program-count">
          <span className="forge-poc__program-count-value">{filledCount}</span>
          <span className="forge-poc__program-count-max">/9</span>
          <span className="forge-poc__program-count-label">SLOTS</span>
        </span>
      </div>
      <div
        className="forge-poc__queue"
        onContextMenu={(e) => onQueueContextMenu(e, null)}
      >
        {queue.map((card, idx) => (
          <QueueSlot
            key={idx}
            index={idx}
            card={card}
            isDragOver={dragOverSlot === idx}
            onHover={setHoverCardAt}
            onClear={() => clearSlot(idx)}
            onContextMenu={(e) => onQueueContextMenu(e, idx)}
            onDragStart={(e) => {
              if (!card) return;
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
              if (!dragging) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (dragOverSlot !== idx) setDragOverSlot(idx);
            }}
            onDragLeave={() => {
              if (dragOverSlot === idx) setDragOverSlot(null);
            }}
            onDrop={(e) => {
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
        ))}
      </div>
    </section>
  );
}
