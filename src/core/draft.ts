import { SeededRandom } from './content';
import type { CardDef } from './types';
import { buildLibraryTierFamilies } from '../ui/libraryTierFamilies';

const DEFAULT_REWARD_OFFER_COUNT = 3;

/**
 * Generate post-battle reward card offers. The pool scales with awakening:
 *   aw0 → tier 1 only, aw1 → tier 1–2, aw2 → tier 1–3.
 * All offers share one tier band so a base card and its upgrade never appear together.
 * Uses a seed offset so the picks differ from the initial draft.
 * @param extraChoice — Baron "Rich Get Richer": one additional card to choose from (4 total).
 */
export function generateRewardOffers(
  seed: number,
  faction: string,
  awakening: number,
  allCards: CardDef[],
  extraChoice = false,
  excludeIds: readonly string[] = [],
): string[] {
  const maxTier = awakening + 1;
  const excluded = new Set(excludeIds);
  const eligible = allCards.filter(
    (card) =>
      card.card_tier <= maxTier &&
      card.awakening_min <= awakening &&
      (card.neutral || card.faction === faction) &&
      !excluded.has(card.id),
  );

  const rng = new SeededRandom(seed + 13579);
  const offerTier = Math.max(1, rng.nextInt(maxTier) + 1);
  let tierPool = eligible.filter((card) => card.card_tier === offerTier);
  if (tierPool.length === 0) {
    tierPool = eligible.filter((card) => card.card_tier === 1);
  }
  /* If exclusions emptied the band, fall back to other tiers (still excluding current offers). */
  const pool = tierPool.length > 0 ? tierPool : eligible;
  const count = DEFAULT_REWARD_OFFER_COUNT + (extraChoice ? 1 : 0);
  const legalFallback = allCards.filter(
    (card) =>
      card.card_tier <= maxTier &&
      card.awakening_min <= awakening &&
      (card.neutral || card.faction === faction) &&
      !excluded.has(card.id),
  );
  const source =
    pool.length >= count ? pool : legalFallback.length >= count ? legalFallback : pool.concat(legalFallback);

  /* One pick per upgrade family so Needle Driver / Needle Driver+ never share an offer. */
  const { families } = buildLibraryTierFamilies(allCards);
  const familyOf = new Map<string, string>();
  for (const fam of families) {
    for (const id of fam.tiers) {
      familyOf.set(id, fam.baseId);
    }
  }

  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }

  const picked: string[] = [];
  const usedFamilies = new Set<string>();
  for (const card of shuffled) {
    const fam = familyOf.get(card.id) ?? card.id;
    if (usedFamilies.has(fam)) continue;
    usedFamilies.add(fam);
    picked.push(card.id);
    if (picked.length >= count) break;
  }
  return picked;
}

/** The 5 cards every run starts with regardless of pilot. */
export const NEUTRAL_STARTER_DECK: string[] = [
  'neutral_barrier_t1',
  'neutral_feint_t1',
  'neutral_capacitor_feed_t1',
  'neutral_servo_t1',
  'neutral_multi_strike_t1',
];

export const DRAFT_ROUNDS = 4;
export const DRAFT_OFFERS_PER_ROUND = 3;

type NativeStance = 'dragon' | 'tiger' | 'bird' | 'tortoise';

function nativeStanceForPilot(pilotId: string): NativeStance | undefined {
  switch (pilotId) {
    case 'seiryu':
      return 'dragon';
    case 'byakko':
      return 'tiger';
    case 'suzaku':
      return 'bird';
    case 'genbu':
      return 'tortoise';
    default:
      return undefined;
  }
}

function pickForcedNativeStanceCard(
  pilotId: string | undefined,
  awakening: number,
  pool: CardDef[],
  rng: SeededRandom,
): CardDef | undefined {
  const native = pilotId ? nativeStanceForPilot(pilotId) : undefined;
  if (!native) {
    return undefined;
  }
  const nativeCards = pool.filter((card) => card.id.includes(`_${native}_`));
  if (nativeCards.length === 0) {
    return undefined;
  }

  if (awakening < 1) {
    const nonDuo = nativeCards.filter((card) => !card.id.includes('ninja_duo_'));
    if (nonDuo.length === 0) {
      return undefined;
    }
    return nonDuo[rng.nextInt(nonDuo.length)];
  }

  const duo = nativeCards.filter((card) => card.id.includes('ninja_duo_'));
  const nonDuo = nativeCards.filter((card) => !card.id.includes('ninja_duo_'));
  if (duo.length > 0 && nonDuo.length > 0) {
    const chooseDuo = rng.nextInt(2) === 0;
    const set = chooseDuo ? duo : nonDuo;
    return set[rng.nextInt(set.length)];
  }
  const fallback = duo.length > 0 ? duo : nonDuo;
  return fallback.length > 0 ? fallback[rng.nextInt(fallback.length)] : undefined;
}

/**
 * Generate DRAFT_ROUNDS rounds of card offers from the neutral + faction
 * tier-1 awakening-0 pool (starter deck cards excluded). Cards do not repeat across rounds.
 * @param extraOfferPerRound — Baron "Rich Get Richer": one extra option each round (4 vs 3).
 */
export function generateDraftOffers(
  seed: number,
  faction: string,
  awakening: number,
  allCards: CardDef[],
  pilotId?: string,
  extraOfferPerRound = false,
): string[][] {
  const starterSet = new Set(NEUTRAL_STARTER_DECK);

  const maxTier = awakening + 1;
  const pool = allCards.filter(
    (card) =>
      card.card_tier <= maxTier &&
      card.card_tier >= 1 &&
      card.awakening_min <= awakening &&
      !starterSet.has(card.id) &&
      (card.neutral || card.faction === faction),
  );

  const { families } = buildLibraryTierFamilies(allCards);
  const familyOf = new Map<string, string>();
  for (const fam of families) {
    for (const id of fam.tiers) {
      familyOf.set(id, fam.baseId);
    }
  }

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
  const forcedFirst = pickForcedNativeStanceCard(pilotId, awakening, pool, rng);
  if (forcedFirst) {
    const idx = shuffled.findIndex((card) => card.id === forcedFirst.id);
    if (idx >= 0) {
      shuffled.splice(idx, 1);
    }
  }

  const usedFamilies = new Set<string>();
  for (let r = 0; r < DRAFT_ROUNDS; r += 1) {
    const round: string[] = [];
    if (r === 0 && forcedFirst) {
      round.push(forcedFirst.id);
      usedFamilies.add(familyOf.get(forcedFirst.id) ?? forcedFirst.id);
    }
    while (round.length < offersPerRound && cursor < shuffled.length) {
      const next = shuffled[cursor]!;
      cursor += 1;
      const fam = familyOf.get(next.id) ?? next.id;
      if (usedFamilies.has(fam)) continue;
      usedFamilies.add(fam);
      round.push(next.id);
    }
    rounds.push(round);
  }

  return rounds;
}
