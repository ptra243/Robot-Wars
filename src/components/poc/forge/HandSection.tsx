import type { MutableRefObject } from 'react';
import { useState } from 'react';
import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { LibraryCard } from './LibraryCard';
import type { DragPayload, ForgeCard } from './types';

interface HandSectionProps {
  hand: ForgeCard[];
  queue: (ForgeCard | null)[];
  dragging: DragPayload | null;
  dragPayloadRef: MutableRefObject<DragPayload | null>;
  setDragging: (p: DragPayload | null) => void;
  setDragOverSlot: (n: number | null) => void;
  setHover: (h: { card: ForgeCard; x: number; y: number } | null) => void;
  setHoverCardAt: (card: ForgeCard | null, ev?: { clientX: number; clientY: number }) => void;
  assignNextEmpty: (handIndex: number) => void;
  handleDropOnHand: (payload: DragPayload) => void;
  onHandContextMenu: (e: ReactMouseEvent<HTMLElement>, handIdx: number) => void;
  onMergeCards: (fromPayload: DragPayload, toHandIdx: number) => void;
  canMergeCards: (a: ForgeCard, b: ForgeCard) => boolean;
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
        <span className="forge-poc__section-eyebrow">{'//'} HAND</span>
        <span className="forge-poc__section-sub">
          Hover to inspect · double-click to add · right-click to reroll · drag same card to tier-up
        </span>
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
            isDragging={dragging?.source === 'hand' && dragging.index === idx}
            isMergeTarget={mergeTargetIdx === idx}
            onHover={setHoverCardAt}
            onAssign={() => {
              assignNextEmpty(idx);
            }}
            onDragStart={(e) => {
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
            onContextMenu={(e) => onHandContextMenu(e, idx)}
            onDragOver={(e) => handleCardDragOver(e, idx, card)}
            onDragLeave={() => handleCardDragLeave(idx)}
            onDrop={(e) => handleCardDrop(e, idx)}
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
