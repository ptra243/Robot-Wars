import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import cardDescriptions from '../data/cardDescriptions.json';

const JUNK_THRESHOLD_IDS = [
  'junk_spigot_t1',
  'junk_bulwark_t1',
  'junk_ladder_t1',
  'junk_gasket_t1',
  'junk_coil_t1',
  'junk_aegis_t1',
  'junk_rivet_t1',
  'junk_crown_t1',
] as const;

describe('cardDescriptions.json', () => {
  it('has an entry for every catalog card id', () => {
    const content = CardContentService.loadDefault(0);
    const ids = content.getAll().map((c) => c.id).sort();
    const byCardId = cardDescriptions.byCardId;

    for (const id of ids) {
      const entry = byCardId[id as keyof typeof byCardId];
      expect(entry, `missing description for ${id}`).toBeDefined();
      expect(entry.full.length, `empty full text for ${id}`).toBeGreaterThan(0);
      expect(entry.compact.length, `empty compact text for ${id}`).toBeGreaterThan(0);
    }
  });

  it('junk threshold cards have explicit byCardId descriptions', () => {
    const byCardId = cardDescriptions.byCardId;
    for (const id of JUNK_THRESHOLD_IDS) {
      expect(byCardId[id as keyof typeof byCardId]?.full.length ?? 0).toBeGreaterThan(20);
    }
  });

  it('Junk Crown is not tagged Energy (GainCharge only in optional pay branch)', () => {
    const content = CardContentService.loadDefault(0);
    expect(content.get('junk_crown_t1').tags).toEqual(['Direct', 'Junk']);
  });
});
