import type { CardContentService } from './content';
import type { CardDef, RunState } from './types';

/** Max copies (card instances) with Continuous **or** Persistent across hand+deck combined. */
export const MAX_CONTINUOUS_OR_PERSISTENT_PER_DECK = 2;

/** Non-Unique cards can be copied without a hard cap. */
export const MAX_COPIES_PER_NON_UNIQUE_CARD_ID = Number.POSITIVE_INFINITY;

/** Neutral Basic Strike / Basic Shield (Barrier) — unlimited copies; ignore {@link MAX_COPIES_PER_NON_UNIQUE_CARD_ID}. */
export function isUnlimitedCopyNeutralStapleId(id: string): boolean {
  return /^neutral_basic_strike_t[123]$/.test(id) || /^neutral_barrier_t[123]$/.test(id);
}

/**
 * Card ids that count toward deck construction rules.
 * After {@link drawStartingHand}, `hand` is a full copy of `run.deck` — summing both would
 * double-count every card (breaking Continuous/Unique/copy limits). Prefer the fatigue deck
 * when present; otherwise sandbox / pre-load uses `hand` only.
 */
export function aggregateDeckCardIds(run: RunState): string[] {
  if (run.deck.length > 0) {
    return [...run.deck];
  }
  return [...run.hand];
}

function cardCountsTowardContinuousCap(card: CardDef): boolean {
  return (card.keywords ?? []).some(
    (k) => k.type === 'Continuous' || k.type === 'Persistent',
  );
}

function cardHasUniqueDeck(card: CardDef): boolean {
  return (card.keywords ?? []).some((k) => k.type === 'UniqueDeck');
}

/**
 * Returns an error message if the run violates deck construction rules, else null.
 */
export function validateDeckComposition(
  run: RunState,
  content: CardContentService,
): string | null {
  const ids = aggregateDeckCardIds(run);
  let uniqueDeckInstances = 0;
  let continuousPersistentInstances = 0;

  for (const id of ids) {
    const c = content.get(id);
    if (!c.neutral && c.faction !== run.faction) {
      return `Deck cannot include off-faction card “${c.name}” (${c.faction}).`;
    }
    if (cardHasUniqueDeck(c)) {
      uniqueDeckInstances += 1;
    }
    if (cardCountsTowardContinuousCap(c)) {
      continuousPersistentInstances += 1;
    }
  }

  const countsById = new Map<string, number>();
  for (const id of ids) {
    countsById.set(id, (countsById.get(id) ?? 0) + 1);
  }
  if (Number.isFinite(MAX_COPIES_PER_NON_UNIQUE_CARD_ID)) {
    for (const [id, count] of countsById) {
      if (isUnlimitedCopyNeutralStapleId(id)) {
        continue;
      }
      const c = content.get(id);
      if (!cardHasUniqueDeck(c) && count > MAX_COPIES_PER_NON_UNIQUE_CARD_ID) {
        return `Deck may include at most ${String(MAX_COPIES_PER_NON_UNIQUE_CARD_ID)} copies of “${c.name}” (non-UniqueDeck cards).`;
      }
    }
  }

  if (uniqueDeckInstances > 1) {
    return 'Deck may include at most 1 copy of cards with UniqueDeck (e.g. Gathering Strike).';
  }
  if (continuousPersistentInstances > MAX_CONTINUOUS_OR_PERSISTENT_PER_DECK) {
    return `Deck may include at most ${String(MAX_CONTINUOUS_OR_PERSISTENT_PER_DECK)} cards with Continuous or Persistent combined.`;
  }
  return null;
}
