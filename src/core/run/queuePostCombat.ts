import { replaceOneDeckOccurrence } from '../deckMutation';

const NEUTRAL_BASIC = /^neutral_basic_strike_t[123]$/;

function isNeutralBasicId(id: string | null | undefined): boolean {
  return id != null && NEUTRAL_BASIC.test(id);
}

/**
 * After combat, the run’s planned queue should **not** keep in-combat “factory reset”
 * (TransformCurrentQueueSlot / FactoryReset) that rewrites a program slot to Neutral Basic
 * or rewrites a basic’s tier. Those are tactical for the fight only.
 *
 * We **do** keep durable changes where the final id is not a neutral basic (e.g. Core Rebirth
 * graft into a CoreParts card), or the slot is unchanged.
 */
export function persistedQueueSlotIdAfterCombat(
  initial: string | null | undefined,
  final: string | null | undefined,
  blankQueueId: string,
): string | null {
  if (final === blankQueueId && (initial == null || initial === '')) {
    return null;
  }
  if (initial == null || initial === '') {
    if (final == null || final === blankQueueId) {
      return null;
    }
    return final;
  }

  const fin = final ?? null;
  // `blankQueueId` is the same id as `neutral_basic_strike_t1`; do not treat it as
  // “empty” here (that only applies when `initial` is empty — handled above).
  if (fin == null) {
    return null;
  }

  if (isNeutralBasicId(fin)) {
    if (!isNeutralBasicId(initial)) {
      return initial;
    }
    if (isNeutralBasicId(initial) && initial !== fin) {
      return initial;
    }
  }
  return fin;
}

/**
 * Copies the post-combat deck, then swaps back one deck occurrence per reverted queue slot
 * (factory transform undoes the same `replaceOneDeckOccurrence` the sim used for queue↔deck sync).
 */
export function applyQueuePersistenceToPlayerDeck(
  finalDeck: string[],
  finalQueue: Array<string | null>,
  nextPlanned: Array<string | null>,
): string[] {
  const deck = [...finalDeck];
  const n = Math.min(
    finalQueue.length,
    nextPlanned.length,
  );
  for (let i = 0; i < n; i += 1) {
    const f = finalQueue[i] ?? null;
    const p = nextPlanned[i] ?? null;
    if (f === p || f == null) {
      continue;
    }
    const finId = f;
    const pinId = p;
    if (pinId == null) {
      continue;
    }
    replaceOneDeckOccurrence(deck, finId, pinId);
  }
  return deck;
}
