import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import { buildCardDescription } from '../ui/cardText';

describe('buildCardDescription Prime / Sequence riders', () => {
  const content = CardContentService.loadDefault(1);

  it('prints Prime Faith bonus as Faith, not a generic Prime blurb', () => {
    const text = buildCardDescription(content.get('clockwork_prime_faith_t1'), {
      omitTagsAndKeywords: true,
    });
    expect(text).toContain('Deal 1 **direct** damage.');
    expect(text).toContain('**Prime**: **Faith** 1.');
    expect(text).not.toMatch(/bonus line/i);
  });

  it('prints Prime Interdict bonus damage', () => {
    const text = buildCardDescription(content.get('clockwork_prime_interdict_t1'), {
      omitTagsAndKeywords: true,
    });
    expect(text).toContain('Deal 1 **direct** damage.');
    expect(text).toContain('**Prime**: Deal 5 **direct** damage.');
  });

  it('prints Prime Purification heal + prime damage', () => {
    const text = buildCardDescription(content.get('clockwork_prime_purification_t1'), {
      omitTagsAndKeywords: true,
    });
    expect(text).toContain('Heal 3.');
    expect(text).toContain('**Prime**: Deal 4 **direct** damage.');
    expect(text).not.toMatch(/^Deal 4/m);
  });
});
