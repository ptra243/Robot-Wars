import type { Dispatch, SetStateAction } from 'react';
import { forgeShiftProgramLeft, forgeShiftProgramRight } from './forgeProgramOps';
import type { DragPayload, ForgeCard } from './types';

interface ForgeQueueInteractionsInput {
  hand: ForgeCard[];
  queue: (ForgeCard | null)[];
  programSlots: number;
  setHand: Dispatch<SetStateAction<ForgeCard[]>>;
  setQueue: Dispatch<SetStateAction<(ForgeCard | null)[]>>;
  resolveCardById?: (id: string) => ForgeCard | null;
}

export function useForgeQueueInteractions({
  hand,
  queue,
  programSlots,
  setHand,
  setQueue,
  resolveCardById,
}: ForgeQueueInteractionsInput) {
  const nextTierIdIfSameCard = (a: ForgeCard, b: ForgeCard): string | null => {
    if (a.id !== b.id) return null;
    const m = a.id.match(/^(.*)_t([123])$/);
    if (!m) return null;
    const tier = Number(m[2]);
    if (!Number.isFinite(tier) || tier >= 3) return null;
    return `${m[1]}_t${String(tier + 1)}`;
  };

  const assignNextEmpty = (handIndex: number) => {
    const card = hand[handIndex];
    if (!card) return;
    const empty = queue.findIndex((c, i) => c === null && i < programSlots);
    if (empty === -1) return;
    setQueue((prev) => {
      const next = [...prev];
      next[empty] = card;
      return next;
    });
    setHand((prev) => prev.filter((_, i) => i !== handIndex));
  };

  const clearSlot = (idx: number) => {
    if (idx >= programSlots) return;
    const card = queue[idx];
    setQueue((prev) => {
      const next = [...prev];
      next[idx] = null;
      return next;
    });
    if (card) setHand((prev) => [...prev, card]);
  };

  const handleDropOnSlot = (slotIndex: number, payload: DragPayload) => {
    if (slotIndex >= programSlots) return;
    if (payload.source === 'hand') {
      const card = hand[payload.index];
      if (!card) return;
      const displaced = queue[slotIndex];
      const mergedId = displaced ? nextTierIdIfSameCard(card, displaced) : null;
      if (mergedId) {
        const upgraded = resolveCardById?.(mergedId);
        if (!upgraded) {
          return;
        }
        setHand((prev) => prev.filter((_, i) => i !== payload.index));
        setQueue((prev) => {
          const next = [...prev];
          next[slotIndex] = upgraded;
          return next;
        });
        return;
      }
      setHand((prev) => {
        const next = prev.filter((_, i) => i !== payload.index);
        if (displaced) next.push(displaced);
        return next;
      });
      setQueue((prev) => {
        const next = [...prev];
        next[slotIndex] = card;
        return next;
      });
      return;
    }
    if (payload.source === 'queue' && payload.index !== slotIndex) {
      setQueue((prev) => {
        const next = [...prev];
        const src = next[payload.index];
        next[payload.index] = next[slotIndex];
        next[slotIndex] = src;
        return next;
      });
    }
  };

  const handleDropOnHand = (payload: DragPayload) => {
    if (payload.source !== 'queue') return;
    const card = queue[payload.index];
    if (!card) return;
    setQueue((prev) => {
      const next = [...prev];
      next[payload.index] = null;
      return next;
    });
    setHand((prev) => [...prev, card]);
  };

  const shiftQueueLeft = (pivot: number | null) => {
    const p = pivot === null ? programSlots - 1 : pivot;
    let toHand: ForgeCard | null = null;
    setQueue((prev) => {
      const r = forgeShiftProgramLeft(prev, p, programSlots);
      toHand = r.toHand;
      return r.next;
    });
    if (toHand) setHand((h) => [...h, toHand as ForgeCard]);
  };

  const shiftQueueRight = (pivot: number | null) => {
    const p = pivot ?? 0;
    let toHand: ForgeCard | null = null;
    setQueue((prev) => {
      const r = forgeShiftProgramRight(prev, p, programSlots);
      toHand = r.toHand;
      return r.next;
    });
    if (toHand) setHand((h) => [...h, toHand as ForgeCard]);
  };

  return {
    assignNextEmpty,
    clearSlot,
    handleDropOnSlot,
    handleDropOnHand,
    shiftQueueLeft,
    shiftQueueRight,
  };
}

