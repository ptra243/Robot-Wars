import type { CardContentService } from '../content';

/** Next tier id for a card, or null if it cannot be upgraded. */
export function resolveCardUpgradeId(
  cardId: string,
  content: CardContentService,
): string | null {
  try {
    const def = content.get(cardId);
    if (def.merge_to) {
      content.get(def.merge_to);
      return def.merge_to;
    }
  } catch {
    /* fall through */
  }
  const tierBump = cardId.includes('_t1')
    ? cardId.replace('_t1', '_t2')
    : cardId.includes('_t2')
      ? cardId.replace('_t2', '_t3')
      : null;
  if (!tierBump || tierBump === cardId) return null;
  try {
    content.get(tierBump);
    return tierBump;
  } catch {
    return null;
  }
}
