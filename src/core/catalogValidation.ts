import type { CardDef } from './types';

export function validateCatalog(cards: CardDef[]): void {
  if (cards.length === 0) {
    throw new Error('No card content files found under src/data/cards.');
  }

  const seen = new Set<string>();
  for (const card of cards) {
    if (!card.id.trim()) {
      throw new Error('Card with empty id.');
    }

    if (seen.has(card.id)) {
      throw new Error(`Duplicate card id: ${card.id}`);
    }

    if (card.card_tier < 1 || card.card_tier > 3) {
      throw new Error(`Card ${card.id} has invalid tier ${card.card_tier}.`);
    }

    if (!card.effects || card.effects.length === 0) {
      throw new Error(
        `Card ${card.id} must define a non-empty \`effects\` array (resolution pipeline is data-driven).`,
      );
    }

    seen.add(card.id);
  }

  for (const card of cards) {
    if (card.merge_to && !seen.has(card.merge_to)) {
      throw new Error(`Card ${card.id} merge target ${card.merge_to} missing.`);
    }
  }
}
