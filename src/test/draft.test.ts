import { describe, expect, it } from 'vitest';
import { CardContentService, cardOfferStreamSeed } from '../core/content';
import { generateDraftOffers, generateRewardOffers } from '../core/draft';

function firstOffer(seed: number, pilotId: string, awakening: number): string {
  const content = CardContentService.loadDefault(seed);
  const offers = generateDraftOffers(seed, 'cyberpunk', awakening, content.getAll(), pilotId, false);
  return offers[0]?.[0] ?? '';
}

describe('generateDraftOffers native-stance opener', () => {
  it('keeps full first-round offer count while forcing slot 1', () => {
    const content = CardContentService.loadDefault(2026);
    const offers = generateDraftOffers(2026, 'cyberpunk', 0, content.getAll(), 'seiryu', false);
    expect(offers[0]?.length).toBe(3);
    expect(offers[0]?.[0]).toContain('_dragon_');
  });

  it('forces first cyberpunk draft offer to native non-duo stance at awakening 0', () => {
    const first = firstOffer(1337, 'seiryu', 0);
    expect(first).toContain('_dragon_');
    expect(first).not.toContain('ninja_duo_');
  });

  it('pool includes tier-2 cards when awakening >= 1 (unlock ladder picks)', () => {
    const content = CardContentService.loadDefault(2026);
    const allTier2 = new Set<string>();
    for (let seed = 0; seed < 80; seed += 1) {
      const offers = generateDraftOffers(seed, 'cyberpunk', 1, content.getAll(), undefined, false);
      for (const id of offers.flat()) {
        if (content.get(id).card_tier === 2) {
          allTier2.add(id);
        }
      }
    }
    expect(allTier2.size).toBeGreaterThan(0);
  });

  it('reward reroll with excludeIds changes the offer set', () => {
    const content = CardContentService.loadDefault(42);
    const all = content.getAll();
    const first = generateRewardOffers(1001, 'cyberpunk', 1, all, false);
    expect(first.length).toBe(3);
    const stream = cardOfferStreamSeed(1001, 17);
    const reroll = generateRewardOffers(stream, 'cyberpunk', 1, all, false, first);
    expect(reroll.length).toBe(3);
    expect(reroll.some((id) => !first.includes(id))).toBe(true);
  });

  it('uses roughly 50/50 duo vs non-duo native stance opener at awakening 1+', () => {
    let duo = 0;
    let nonDuo = 0;
    for (let seed = 1; seed <= 200; seed += 1) {
      const first = firstOffer(seed, 'seiryu', 2);
      expect(first).toContain('_dragon_');
      if (first.includes('ninja_duo_')) {
        duo += 1;
      } else {
        nonDuo += 1;
      }
    }
    const ratio = duo / Math.max(1, duo + nonDuo);
    expect(ratio).toBeGreaterThan(0.35);
    expect(ratio).toBeLessThan(0.65);
  });
});
