import type { CardDef, FighterState } from './types';

const NATURAL_PRIME_SLOT_SET = new Set<number>([2, 4, 6]);

/** 1-based program slots that are always Prime (Clockwork geometry). */
export const NATURAL_PRIME_SLOT_NUMBERS_ONE_BASED = [3, 5, 7] as const;

export type PrimeSource = 'natural' | 'temporary' | 'override';

export interface PrimeSlotState {
  isPrime: boolean;
  sources: PrimeSource[];
}

export interface SequenceReadiness {
  status: 'ready' | 'setup' | 'offchain';
  matchedStep: number | null;
}

export function isNaturalPrimeSlot(slotIndex: number): boolean {
  return NATURAL_PRIME_SLOT_SET.has(slotIndex);
}

function usesClockworkPrimeUi(traitIds: readonly string[], faction?: string): boolean {
  if (faction === 'clockwork') return true;
  return traitIds.some(
    (id) => id.startsWith('clockwork_') || id.startsWith('relic_clockwork_'),
  );
}

/**
 * Prime slots for deck/forge planning (natural + pilot/relic overrides; no temporary Prime).
 * Non-clockwork pilots see no prime markers unless they somehow carry clockwork traits/relics.
 */
export function primeSlotIndicesForTraitIds(
  traitIds: readonly string[],
  faction?: string,
): ReadonlySet<number> {
  if (!usesClockworkPrimeUi(traitIds, faction)) {
    return new Set();
  }
  const indices = new Set<number>(NATURAL_PRIME_SLOT_SET);
  if (traitIds.includes('clockwork_rook_base')) {
    indices.add(0);
    indices.add(1);
  }
  if (traitIds.includes('relic_clockwork_septenary_crown')) {
    for (let i = 0; i <= 6; i += 1) {
      indices.add(i);
    }
  }
  return indices;
}

export function formatPrimeSlotNumbersOneBased(indices: Iterable<number>): string {
  return [...indices]
    .map((i) => i + 1)
    .sort((a, b) => a - b)
    .join(', ');
}

export function isPrimeSlotForTraitPlanning(
  slotIndex: number,
  traitIds: readonly string[],
  faction?: string,
): boolean {
  return primeSlotIndicesForTraitIds(traitIds, faction).has(slotIndex);
}

export function primeSlotHoverText(
  slotIndex: number,
  traitIds: readonly string[] = [],
  faction?: string,
): string {
  const slotNum = slotIndex + 1;
  const all = formatPrimeSlotNumbersOneBased(primeSlotIndicesForTraitIds(traitIds, faction));
  return `Prime slot ${String(slotNum)} — cards with Prime lines get their bonus when they resolve here. Your prime slots: ${all}.`;
}

export function isPrimeSlotForActor(slotIndex: number, actor: FighterState): PrimeSlotState {
  const sources: PrimeSource[] = [];
  if (isNaturalPrimeSlot(slotIndex)) sources.push('natural');
  if ((actor.temporaryPrimeSlots ?? []).includes(slotIndex)) sources.push('temporary');
  if ((actor.primeSlotOverrides ?? []).includes(slotIndex)) sources.push('override');
  return { isPrime: sources.length > 0, sources };
}

export function getSequenceReadiness(card: CardDef, actor: FighterState): SequenceReadiness {
  if (card.faction !== 'clockwork') return { status: 'offchain', matchedStep: null };
  const steps = [...new Set(card.keywords.filter((k) => k.type === 'Sequence').map((k) => k.value))].sort(
    (a, b) => b - a,
  );
  if (steps.length === 0) return { status: 'offchain', matchedStep: null };
  const prev = actor.clockworkSequencePrev;
  for (const step of steps) {
    if (step === 1) {
      return { status: 'ready', matchedStep: 1 };
    }
    if (prev === step - 1) {
      return { status: 'ready', matchedStep: step };
    }
  }
  return steps.some((step) => step > 1)
    ? { status: 'setup', matchedStep: null }
    : { status: 'offchain', matchedStep: null };
}

