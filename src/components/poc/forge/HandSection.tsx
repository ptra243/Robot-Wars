import type { MutableRefObject } from 'react';
import { useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { LibraryCard } from './LibraryCard';
import type { DragPayload, ForgeCard, HoverState } from './types';

interface HandSectionProps {
  hand: ForgeCard[];
  queue: (ForgeCard | null)[];
  dragging: DragPayload | null;
  dragPayloadRef: MutableRefObject<DragPayload | null>;
  setDragging: (p: DragPayload | null) => void;
  setDragOverSlot: (n: number | null) => void;
  setHover: (h: HoverState | null) => void;
  setHoverCardAt: (card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => void;
  assignNextEmpty: (handIndex: number) => void;
  handleDropOnHand: (payload: DragPayload) => void;
  onHandContextMenu: (e: ReactMouseEvent<HTMLElement>, handIdx: number) => void;
  onMergeCards: (fromPayload: DragPayload, toHandIdx: number) => void;
  canMergeCards: (a: ForgeCard, b: ForgeCard) => boolean;
  readOnly?: boolean;
  sectionTitle?: string;
  sectionSubtitle?: string;
}

export function HandSection({
  hand,
  queue,
  dragging,
  dragPayloadRef,
  setDragging,
  setDragOverSlot,
  setHover,
  setHoverCardAt,
  assignNextEmpty,
  handleDropOnHand,
  onHandContextMenu,
  onMergeCards,
  canMergeCards,
  readOnly = false,
  sectionTitle = 'HAND',
  sectionSubtitle = 'Hover to inspect · double-click to add · right-click to reroll · drag same card to tier-up',
}: HandSectionProps) {
  const [mergeTargetIdx, setMergeTargetIdx] = useState<number | null>(null);

  const handleCardDragOver = (
    e: ReactDragEvent<HTMLElement>,
    idx: number,
    card: ForgeCard,
  ) => {
    const payload = dragging ?? dragPayloadRef.current;
    if (!payload) return;
    const sourceCard =
      payload.source === 'hand' ? hand[payload.index] : queue[payload.index];
    if (!sourceCard) return;
    // Don't merge a card with itself
    if (payload.source === 'hand' && payload.index === idx) return;
    if (!canMergeCards(sourceCard, card)) return;
    e.preventDefault();
    e.stopPropagation();
    setMergeTargetIdx(idx);
  };

  const handleCardDragLeave = (idx: number) => {
    if (mergeTargetIdx === idx) setMergeTargetIdx(null);
  };

  const handleCardDrop = (e: ReactDragEvent<HTMLElement>, idx: number) => {
    if (mergeTargetIdx !== idx) return;
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as DragPayload;
      onMergeCards(payload, idx);
    } catch {
      /* ignore malformed transfer */
    }
    setMergeTargetIdx(null);
    setDragging(null);
    setDragOverSlot(null);
  };

  return (
    <section className="forge-poc__center">
      <div className="forge-poc__section-head">
        <span className="forge-poc__section-eyebrow">{'//'} {sectionTitle}</span>
        <span className="forge-poc__section-sub">{sectionSubtitle}</span>
      </div>

      <div
        className={`forge-poc__library${
          dragging?.source === 'queue' ? ' forge-poc__library--drop-target' : ''
        }`}
        onDragOver={(e) => {
          if (dragging?.source !== 'queue') return;
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          if (dragging?.source !== 'queue') return;
          e.preventDefault();
          const raw = e.dataTransfer.getData('application/json');
          if (!raw) return;
          try {
            const payload = JSON.parse(raw) as DragPayload;
            handleDropOnHand(payload);
          } catch {
            /* ignore malformed transfer */
          }
          setDragging(null);
          setDragOverSlot(null);
        }}
      >
        {hand.map((card, idx) => (
          <LibraryCard
            key={`${card.id}-${String(idx)}`}
            card={card}
            isDragging={!readOnly && dragging?.source === 'hand' && dragging.index === idx}
            isMergeTarget={mergeTargetIdx === idx}
            onHover={setHoverCardAt}
            onAssign={() => {
              if (!readOnly) {
                assignNextEmpty(idx);
              }
            }}
            onDragStart={(e) => {
              if (readOnly) return;
              const payload: DragPayload = { source: 'hand', index: idx };
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
              setMergeTargetIdx(null);
            }}
            onContextMenu={(e) => {
              if (!readOnly) onHandContextMenu(e, idx);
            }}
            onDragOver={(e) => {
              if (!readOnly) handleCardDragOver(e, idx, card);
            }}
            onDragLeave={() => {
              if (!readOnly) handleCardDragLeave(idx);
            }}
            onDrop={(e) => {
              if (!readOnly) handleCardDrop(e, idx);
            }}
          />
        ))}
        {hand.length === 0 ? (
          <div className="forge-poc__library-empty">
            Hand empty · shift the program or drag cards back out
          </div>
        ) : null}
      </div>
    </section>
  );
}
