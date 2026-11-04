import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import cardArtManifest from '../data/cardArt.json';
import { getCardBaseIdForArt, listPlateCrops } from '../ui/cardArtPlates';

/** Files actually present in public/art/cards/, as public paths (`/art/cards/<file>`). */
const PRESENT = new Set(
  Object.keys(import.meta.glob('/public/art/cards/*', { query: '?url', eager: true })).map((p) =>
    p.replace(/^\/public/, ''),
  ),
);

describe('per-card art manifest (src/data/cardArt.json)', () => {
  const content = CardContentService.loadDefault(1);
  const baseIds = new Set(content.getAll().map((c) => getCardBaseIdForArt(c.id)));
  const entries = Object.entries(cardArtManifest.cards as Record<string, string>);

  it('only lists real base card ids', () => {
    const unknown = entries.map(([id]) => id).filter((id) => !baseIds.has(id));
    expect(unknown).toEqual([]);
  });

  it('only points at files that exist under public/', () => {
    const missing = entries.filter(([, path]) => !PRESENT.has(path));
    expect(missing).toEqual([]);
  });
});

describe('plate crop review flags', () => {
  it('marks every plate crop keep or replace', () => {
    const unflagged = listPlateCrops()
      .filter(({ plate }) => plate.review !== 'keep' && plate.review !== 'replace')
      .map(({ baseId }) => baseId);
    expect(unflagged).toEqual([]);
  });
});
