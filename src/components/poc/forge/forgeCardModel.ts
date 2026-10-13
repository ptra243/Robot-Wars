import type { CardContentService } from '../../../core/content';
import { SeededRandom } from '../../../core/content';
import type { CardDef } from '../../../core/types';
import { buildCardDescription } from '../../../ui/cardText';
import { hpPlayCostAmountForUi } from '../../../ui/hpPlayCost';
import { QUEUE_SIZE } from './constants';
import type { ForgeCard, ForgeFaction } from './types';

const ART = {
  strike: '/poc/poc-card-strike.png',
  shield: '/poc/poc-card-shield.png',
  junk: '/poc/poc-card-junk.png',
  overclock: '/poc/poc-card-overclock.png',
  cyberDragon: '/poc/poc-card-cyberpunk-dragon.png',
  cyberTiger: '/poc/poc-card-cyberpunk-tiger.png',
  cyberBird: '/poc/poc-card-cyberpunk-bird.png',
  cyberTortoise: '/poc/poc-card-cyberpunk-tortoise.png',
  cyberDuo: '/poc/poc-card-cyberpunk-duo.png',
  cyberGlue: '/poc/poc-card-cyberpunk-glue.png',
  /** Core sacrifice / factory placeholder — use with `.forge-poc__*-art--core-reactor` crop. */
  core: '/poc/poc-core-werewolf-mech-reactor-placeholder.png',
} as const;

/** Scavenger core retool + HP/sacrifice `sacrif_*` lines — shared reactor art + CSS crop. */
export function isCoreSacrificeLineCardId(id: string): boolean {
  return (
    /^(core_tap|core_refactoring|core_rebirth|deep_core_tap)_/.test(id) || /^sacrif_/.test(id)
  );
}

function artForCard(card: CardDef): string {
  if (isCoreSacrificeLineCardId(card.id)) {
    return ART.core;
  }
  if (card.faction === 'cyberpunk') {
    if (card.id.includes('_duo_')) return ART.cyberDuo;
    if (card.id.includes('masterful_form')) return ART.cyberGlue;
    if (card.id.includes('dragon')) return ART.cyberDragon;
    if (card.id.includes('tiger')) return ART.cyberTiger;
    if (card.id.includes('bird')) return ART.cyberBird;
    if (card.id.includes('tortoise')) return ART.cyberTortoise;
    return ART.cyberGlue;
  }
  const tags = card.tags;
  if (card.keywords.some((k) => k.type === 'Overclock')) return ART.overclock;
  if (tags.includes('Strike')) return ART.strike;
  if (tags.includes('Shield')) return ART.shield;
  if (tags.includes('Junk')) return ART.junk;
  if (card.base_damage > 0) return ART.strike;
  if (card.base_block > 0) return ART.shield;
  return ART.junk;
}

/** Public for Phaser mini cards / battle strip — same URLs as {@link forgeCardFromDef}. */
export function cardArtUrlFromDef(card: CardDef): string {
  return artForCard(card);
}

function factionClass(card: CardDef): ForgeFaction {
  if (card.neutral) return 'neutral';
  switch (card.faction) {
    case 'scavengers':
    case 'neutral':
    case 'overclock':
    case 'aegis':
    case 'cyberpunk':
    case 'clockwork':
      return card.faction;
    default:
      return 'neutral';
  }
}

function tierFromDef(card: CardDef): 1 | 2 | 3 {
  const t = card.card_tier;
  if (t === 1 || t === 2 || t === 3) return t;
  return 1;
}

/**
 * Maps a catalog `CardDef` into the slimmer view model the Forge UI renders.
 */
export function forgeCardFromDef(card: CardDef): ForgeCard {
  const atk = card.base_damage > 0 ? card.base_damage : undefined;
  const def = card.base_block > 0 ? card.base_block : undefined;
  const hpPlay = hpPlayCostAmountForUi(card);
  return {
    id: card.id,
    name: card.name,
    tier: tierFromDef(card),
    cost: card.charge_cost,
    hpPlayCost: hpPlay ?? undefined,
    atk,
    def,
    faction: factionClass(card),
    tags: [...card.tags],
    keywords: card.keywords.map((k) => ({ type: k.type, value: k.value })),
    art: artForCard(card),
    artFocus: isCoreSacrificeLineCardId(card.id) ? 'core-reactor' : 'default',
    blurb: buildCardDescription(card, { omitTagsAndKeywords: true }),
  };
}

export function forgeCardFromDefWithTraits(card: CardDef, activeTraitIds: readonly string[] = []): ForgeCard {
  const base = forgeCardFromDef(card);
  return {
    ...base,
    blurb: buildCardDescription(card, {
      omitTagsAndKeywords: true,
      activeTraitIds,
    }),
  };
}

/** Strips tier suffix from catalog ids (`needle_driver_t2` → `needle_driver`). */
export function getCardBaseId(cardId: string): string {
  return cardId.replace(/_t[123]$/, '');
}

/**
 * Tier-up merge target for dragging one hand/queue card onto another with the same base name.
 * Prefers `merge_to` from the higher-tier card in the pair (matches catalog upgrade chains).
 */
export function resolveForgeMergeUpgradeId(
  content: CardContentService,
  source: ForgeCard,
  target: ForgeCard,
): string | null {
  if (getCardBaseId(source.id) !== getCardBaseId(target.id)) return null;
  const newTier = Math.max(source.tier, target.tier) + 1;
  if (newTier > 3) return null;
  const higher = source.tier >= target.tier ? source : target;
  let def: CardDef;
  try {
    def = content.get(higher.id);
  } catch {
    return null;
  }
  if (def.merge_to) {
    try {
      content.get(def.merge_to);
      return def.merge_to;
    } catch {
      /* fall through to _tN pattern */
    }
  }
  const fallback = `${getCardBaseId(higher.id)}_t${String(newTier)}`;
  try {
    content.get(fallback);
    return fallback;
  } catch {
    return null;
  }
}

export function canForgeMergeCards(
  content: CardContentService,
  a: ForgeCard,
  b: ForgeCard,
): boolean {
  return resolveForgeMergeUpgradeId(content, a, b) !== null;
}

/** Tier-up merge from two catalog ids (deck builder / run layer). */
export function resolveMergeUpgradeFromIds(
  content: CardContentService,
  sourceId: string,
  targetId: string,
): string | null {
  try {
    const a = forgeCardFromDef(content.get(sourceId));
    const b = forgeCardFromDef(content.get(targetId));
    return resolveForgeMergeUpgradeId(content, a, b);
  } catch {
    return null;
  }
}

function eligibleForForgePoc(card: CardDef): boolean {
  if (card.awakening_min > 1) return false;
  return (
    card.faction === 'scavengers' ||
    card.faction === 'cyberpunk' ||
    card.faction === 'clockwork' ||
    card.neutral
  );
}

/**
 * Shuffles with Fisher–Yates using a seeded RNG (reproducible if needed).
 */
function shuffle<T>(items: T[], rng: SeededRandom): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export interface RandomForgeLayout {
  hand: ForgeCard[];
  queue: (ForgeCard | null)[];
}

const HAND_SIZE = 6;
const QUEUE_PREFILL = 5;

/**
 * Picks random cards from the live catalog for the POC hand + partial queue.
 * Uses scavenger + neutral cards at awakening 0–1 only.
 */
export function pickRandomForgeLayout(
  content: CardContentService,
  seed: number,
): RandomForgeLayout {
  const rng = new SeededRandom(seed);
  const pool = content.getAll().filter(eligibleForForgePoc);
  if (pool.length === 0) {
    throw new Error('Forge POC: no eligible cards in catalog.');
  }

  const shuffled = shuffle(pool, rng);
  const need = HAND_SIZE + QUEUE_PREFILL;
  const picked: CardDef[] = [];
  const seen = new Set<string>();

  for (const c of shuffled) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    picked.push(c);
    if (picked.length >= need) break;
  }

  while (picked.length < need) {
    picked.push(pool[rng.nextInt(pool.length)]);
  }

  const forge = picked.map(forgeCardFromDef);
  const hand = forge.slice(0, HAND_SIZE);
  const queueCards = forge.slice(HAND_SIZE, HAND_SIZE + QUEUE_PREFILL);
  const queue: (ForgeCard | null)[] = Array.from({ length: QUEUE_SIZE }, (_, i) =>
    i < queueCards.length ? queueCards[i] : null,
  );

  return { hand, queue };
}
