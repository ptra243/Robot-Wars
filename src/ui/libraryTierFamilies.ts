import type { CardDef } from '../core/types';

export interface LibraryTierFamily {
  baseId: string;
  tiers: string[];
}

export function buildLibraryTierFamilies(cards: CardDef[]): { families: LibraryTierFamily[] } {
  const byId = new Map(cards.map((c) => [c.id, c]));
  const parentById = new Map<string, string>();
  for (const card of cards) {
    if (card.merge_to && byId.has(card.merge_to)) {
      parentById.set(card.merge_to, card.id);
    }
  }

  const findBase = (id: string): string => {
    const seen = new Set<string>();
    let cur = id;
    while (parentById.has(cur) && !seen.has(cur)) {
      seen.add(cur);
      cur = parentById.get(cur)!;
    }
    return cur;
  };

  const membersByBase = new Map<string, string[]>();
  for (const card of cards) {
    const baseId = findBase(card.id);
    const cur = membersByBase.get(baseId) ?? [];
    cur.push(card.id);
    membersByBase.set(baseId, cur);
  }

  const families: LibraryTierFamily[] = [...membersByBase.entries()]
    .map(([baseId, memberIds]) => {
      const sorted = [...memberIds].sort((a, b) => {
        const ca = byId.get(a)!;
        const cb = byId.get(b)!;
        if (ca.card_tier !== cb.card_tier) {
          return ca.card_tier - cb.card_tier;
        }
        return ca.id.localeCompare(cb.id);
      });
      return { baseId, tiers: sorted };
    })
    .sort((a, b) => a.baseId.localeCompare(b.baseId));

  return { families };
}
