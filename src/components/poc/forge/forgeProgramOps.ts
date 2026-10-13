import type { CardContentService } from '../../../core/content';
import { QUEUE_SIZE } from './constants';
import { forgeCardFromDefWithTraits } from './forgeCardModel';
import type { ForgeCard } from './types';

/** Converts planned queue card ids into queue slots. Unknown ids become null. */
export function buildRunModeQueue(
  queueIds: (string | null)[],
  content: CardContentService,
  activeTraitIds: readonly string[] = [],
): (ForgeCard | null)[] {
  return Array.from({ length: QUEUE_SIZE }, (_, i) => {
    const id = queueIds[i] ?? null;
    if (!id) return null;
    try {
      return forgeCardFromDefWithTraits(content.get(id), activeTraitIds);
    } catch {
      return null;
    }
  });
}

/** Converts hand ids into forge cards, subtracting ids already in queue slots. */
export function buildRunModeHand(
  handIds: string[],
  queueIds: (string | null)[],
  content: CardContentService,
  activeTraitIds: readonly string[] = [],
): ForgeCard[] {
  const queued = queueIds.filter(Boolean) as string[];
  const remaining = [...handIds];
  for (const qId of queued) {
    const idx = remaining.indexOf(qId);
    if (idx !== -1) remaining.splice(idx, 1);
  }
  return remaining.flatMap((id) => {
    try {
      return [forgeCardFromDefWithTraits(content.get(id), activeTraitIds)];
    } catch {
      return [];
    }
  });
}

export function formatSeedLabel(seed: number): string {
  const hex = (seed >>> 0).toString(16).toUpperCase().padStart(8, '0');
  return `${hex.slice(0, 4)}-${hex.slice(4, 8)}`;
}

/** Shift right around pivot and open an empty slot at pivot. */
export function forgeShiftProgramRight(
  queue: (ForgeCard | null)[],
  pivot: number,
  activeWidth: number,
): { next: (ForgeCard | null)[]; toHand: ForgeCard | null } {
  const w = Math.max(1, Math.min(QUEUE_SIZE, activeWidth));
  const next = [...queue];
  const p = Math.max(0, Math.min(w - 1, pivot));

  let firstEmptyRight = -1;
  for (let i = p + 1; i < w; i += 1) {
    if (next[i] === null) {
      firstEmptyRight = i;
      break;
    }
  }

  if (firstEmptyRight !== -1) {
    for (let i = firstEmptyRight; i > p; i -= 1) {
      next[i] = next[i - 1] ?? null;
    }
    next[p] = null;
    return { next, toHand: null };
  }

  const pushed = next[w - 1];
  for (let i = w - 1; i > p; i -= 1) {
    next[i] = next[i - 1] ?? null;
  }
  next[p] = null;
  return { next, toHand: pushed };
}

/** Shift left around pivot and open an empty slot at pivot. */
export function forgeShiftProgramLeft(
  queue: (ForgeCard | null)[],
  pivot: number,
  activeWidth: number,
): { next: (ForgeCard | null)[]; toHand: ForgeCard | null } {
  const w = Math.max(1, Math.min(QUEUE_SIZE, activeWidth));
  const next = [...queue];
  const p = Math.max(0, Math.min(w - 1, pivot));

  let firstEmptyLeft = -1;
  for (let i = 0; i < p; i += 1) {
    if (next[i] === null) {
      firstEmptyLeft = i;
      break;
    }
  }

  if (firstEmptyLeft !== -1) {
    for (let i = firstEmptyLeft; i < p; i += 1) {
      next[i] = next[i + 1] ?? null;
    }
    next[p] = null;
    return { next, toHand: null };
  }

  const pushed = next[0];
  for (let i = 0; i < p; i += 1) {
    next[i] = next[i + 1] ?? null;
  }
  next[p] = null;
  return { next, toHand: pushed };
}

