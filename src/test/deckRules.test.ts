import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import { createNewRun, validateDeckComposition } from '../core/run';

describe('validateDeckComposition', () => {
  const content = CardContentService.loadDefault(1);

  it('allows up to 2 Continuous / Persistent cards combined', () => {
    const run = createNewRun(1);
    run.hand = ['junk_generator_t1', 'neutral_expose_drone_uplink_t1'];
    expect(validateDeckComposition(run, content)).toBe(null);
  });

  it('rejects more than 2 Continuous / Persistent cards', () => {
    const run = createNewRun(1);
    run.hand = ['junk_generator_t1', 'junk_generator_t2', 'neutral_expose_drone_uplink_t1'];
    expect(validateDeckComposition(run, content)).toMatch(/at most 2/i);
  });

  it('does not double-count when hand mirrors deck (post drawStartingHand)', () => {
    const run = createNewRun(1);
    run.deck = ['junk_generator_t1', 'neutral_expose_drone_uplink_t1'];
    run.hand = [...run.deck];
    expect(validateDeckComposition(run, content)).toBe(null);
  });

  it('rejects more than one UniqueDeck card instance', () => {
    const run = createNewRun(1);
    run.hand = ['neutral_gathering_strike_t1', 'neutral_gathering_strike_t2'];
    expect(validateDeckComposition(run, content)).toMatch(/UniqueDeck/i);
  });

  it('allows any number of neutral Basic Strike copies', () => {
    const run = createNewRun(1);
    run.hand = Array.from({ length: 12 }, () => 'neutral_basic_strike_t1');
    expect(validateDeckComposition(run, content)).toBe(null);
  });

  it('allows any number of neutral Barrier (basic shield) copies', () => {
    const run = createNewRun(1);
    run.hand = Array.from({ length: 10 }, () => 'neutral_barrier_t1');
    expect(validateDeckComposition(run, content)).toBe(null);
  });

  it('per-card copy cap is disabled when MAX_COPIES_PER_NON_UNIQUE_CARD_ID is infinite', () => {
    const run = createNewRun(1);
    run.hand = [
      'neutral_feint_t1',
      'neutral_feint_t1',
      'neutral_feint_t1',
      'neutral_feint_t1',
    ];
    expect(validateDeckComposition(run, content)).toBe(null);
  });
});
