import { SeededRandom } from './content';
import type { CardDef } from './types';

const DEFAULT_REWARD_OFFER_COUNT = 3;

/**
 * Generate post-battle reward card offers. The pool scales with awakening:
 *   aw0 → tier 1 only, aw1 → tier 1–2, aw2 → tier 1–3.
 * Uses a seed offset so the picks differ from the initial draft.
 * @param extraChoice — Baron "Rich Get Richer": one additional card to choose from (4 total).
 */
export function generateRewardOffers(
  seed: number,
  faction: string,
  awakening: number,
  allCards: CardDef[],
  extraChoice = false,
): string[] {
  const maxTier = awakening + 1;
  const pool = allCards.filter(
    (card) =>
      card.card_tier <= maxTier &&
      card.awakening_min <= awakening &&
      (card.neutral || card.faction === faction),
  );

  const rng = new SeededRandom(seed + 13579);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const count = DEFAULT_REWARD_OFFER_COUNT + (extraChoice ? 1 : 0);
  return shuffled.slice(0, count).map((card) => card.id);
}

/** The 5 cards every run starts with regardless of pilot. */
export const NEUTRAL_STARTER_DECK: string[] = [
  'neutral_barrier_t1',
  'neutral_feint_t1',
  'salvage_strike_t1',
  'neutral_servo_t1',
  'neutral_multi_strike_t1',
];

export const DRAFT_ROUNDS = 4;
export const DRAFT_OFFERS_PER_ROUND = 3;

/**
 * Generate DRAFT_ROUNDS rounds of card offers from the neutral + faction
 * tier-1 awakening-0 pool (starter deck cards excluded). Cards do not repeat across rounds.
 * @param extraOfferPerRound — Baron "Rich Get Richer": one extra option each round (4 vs 3).
 */
export function generateDraftOffers(
  seed: number,
  faction: string,
  allCards: CardDef[],
  extraOfferPerRound = false,
): string[][] {
  const starterSet = new Set(NEUTRAL_STARTER_DECK);

  const pool = allCards.filter(
    (card) =>
      card.card_tier === 1 &&
      card.awakening_min === 0 &&
      !starterSet.has(card.id) &&
      (card.neutral || card.faction === faction),
  );

  const rng = new SeededRandom(seed + 7777);

  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const offersPerRound = DRAFT_OFFERS_PER_ROUND + (extraOfferPerRound ? 1 : 0);
  const rounds: string[][] = [];
  let cursor = 0;

  for (let r = 0; r < DRAFT_ROUNDS; r += 1) {
    const round: string[] = [];
    for (let o = 0; o < offersPerRound && cursor < shuffled.length; o += 1) {
      round.push(shuffled[cursor]!.id);
      cursor += 1;
    }
    rounds.push(round);
  }

  return rounds;
}
