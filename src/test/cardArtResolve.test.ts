import { describe, expect, it, vi } from 'vitest';

vi.mock('../data/cardArt.json', () => ({
  default: { cards: { junk_gasket: '/art/cards/junk_gasket.png' } },
}));

const { resolveCardArt, plateArtForCardId } = await import('../ui/cardArtPlates');
const { CardContentService } = await import('../core/content');
const { forgeCardFromDef } = await import('../components/poc/forge/forgeCardModel');

describe('per-card art takes priority over plate crops', () => {
  it('resolves a synced card to its own image with no crop, for every tier', () => {
    for (const id of ['junk_gasket_t1', 'junk_gasket_t3']) {
      expect(resolveCardArt(id)).toEqual({ url: '/art/cards/junk_gasket.png' });
    }
  });

  it('still exposes the old plate crop separately', () => {
    expect(plateArtForCardId('junk_gasket_t1')?.url).toBe('/art/plates/s1-junk-hoard.jpg');
  });

  it('falls back to the plate crop for cards without their own art', () => {
    expect(resolveCardArt('junk_crown_t1')?.crop).toBeDefined();
  });

  it('renders per-card art uncropped on forge cards', () => {
    const content = CardContentService.loadDefault(1);
    const gasket = forgeCardFromDef(content.get('junk_gasket_t1'));
    expect(gasket.art).toBe('/art/cards/junk_gasket.png');
    expect(gasket.artFocus).toBe('default');
    expect(gasket.artCrop).toBeUndefined();
  });
});
