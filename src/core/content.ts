import type { CardCatalog, CardDef } from './types';
import { validateCatalog } from './catalogValidation';
import { normalizeCard } from './normalizeCard';

export { normalizeCard } from './normalizeCard';

type ModuleShape = CardCatalog | { default: CardCatalog };

const cardModules = import.meta.glob('../data/cards/**/*.json', { eager: true });

export class SeededRandom {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (1664525 * this.state + 1013904223) >>> 0;
    return this.state / 0x100000000;
  }

  nextInt(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
}

/**
 * Derive a distinct card-offer RNG stream from a run seed.
 * Use for shop rerolls (and similar) so draws are not identical to the first `loadDefault(seed)` stream.
 */
export function cardOfferStreamSeed(baseSeed: number, streamIndex: number): number {
  return (Math.imul(streamIndex, 2654435761) + baseSeed + 0x9e3779b9) >>> 0;
}

export class CardContentService {
  private readonly cardsById: Map<string, CardDef>;
  private readonly rng: SeededRandom;

  constructor(cardsById: Map<string, CardDef>, seed: number) {
    this.cardsById = cardsById;
    this.rng = new SeededRandom(seed);
  }

  static loadDefault(seed: number): CardContentService {
    const allCards: CardDef[] = [];

    for (const moduleValue of Object.values(cardModules)) {
      const catalog = unwrapModule(moduleValue as ModuleShape);
      allCards.push(...catalog.cards);
    }

    validateCatalog(allCards);
    return new CardContentService(new Map(allCards.map((card) => [card.id, normalizeCard(card)])), seed);
  }

  getAll(): CardDef[] {
    return [...this.cardsById.values()];
  }

  get(id: string): CardDef {
    const card = this.cardsById.get(id);

    if (!card) {
      throw new Error(`Unknown card id: ${id}`);
    }

    return card;
  }

  drawWeighted(faction: string, awakening: number): CardDef {
    const neutral = this.getAll().filter((card) => card.neutral);
    const a0 = this.getAll().filter(
      (card) => !card.neutral && card.faction === faction && card.awakening_min === 0,
    );
    const a1 = this.getAll().filter(
      (card) => !card.neutral && card.faction === faction && card.awakening_min === 1,
    );

    const pools =
      awakening <= 0
        ? [
            { weight: 0.6, cards: a0 },
            { weight: 0.4, cards: neutral },
          ]
        : [
            { weight: 0.4, cards: a1 },
            { weight: 0.3, cards: a0 },
            { weight: 0.3, cards: neutral },
          ];

    const filtered = pools.filter((pool) => pool.cards.length > 0);
    if (filtered.length === 0) {
      throw new Error('No legal cards available for weighted draw.');
    }

    const sum = filtered.reduce((total, pool) => total + pool.weight, 0);
    const pick = this.rng.next() * sum;
    let cursor = 0;

    for (const pool of filtered) {
      cursor += pool.weight;
      if (pick <= cursor) {
        return pool.cards[this.rng.nextInt(pool.cards.length)];
      }
    }

    const fallback = filtered[filtered.length - 1];
    return fallback.cards[this.rng.nextInt(fallback.cards.length)];
  }
}

function unwrapModule(moduleValue: ModuleShape): CardCatalog {
  return 'default' in moduleValue ? moduleValue.default : moduleValue;
}
