import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import { createNewRun, playEncounter, syncDeckFromHandIfEmpty } from '../core/run';

describe('playEncounter', () => {
  const content = CardContentService.loadDefault(42);

  it('syncDeckFromHandIfEmpty copies hand when deck is empty (sandbox before load deck)', () => {
    const run = createNewRun(42);
    run.deck = [];
    run.hand = ['salvage_strike_t1', 'junk_loader_t1'];
    syncDeckFromHandIfEmpty(run);
    expect(run.deck).toEqual(['salvage_strike_t1', 'junk_loader_t1']);
  });

  it('on victory, in-combat Factory Reset does not remove Core Tap from the run (post-combat revert)', () => {
    const run = createNewRun(42);
    run.deck = ['core_tap_t1', 'neutral_basic_strike_t1'];
    run.plannedQueue = Array.from({ length: 9 }, () => null);
    run.plannedQueue[0] = 'core_tap_t1';

    const result = playEncounter(run, content);
    if (!result.playerWon) {
      expect(run.deck).toContain('core_tap_t1');
      return;
    }

    expect(run.plannedQueue[0]).toBe('core_tap_t1');
    expect(run.deck.includes('core_tap_t1')).toBe(true);
  });
});
