import { describe, expect, it } from 'vitest';
import { COMBAT_RULES } from '../core/rules';
import {
  applyQueuePersistenceToPlayerDeck,
  persistedQueueSlotIdAfterCombat,
} from '../core/run/queuePostCombat';

const BLANK = COMBAT_RULES.blankQueueSlotCardId;

describe('queuePostCombat', () => {
  it('reverts program -> neutral basic (factory reset) back to the program id', () => {
    expect(persistedQueueSlotIdAfterCombat('core_tap_t1', 'neutral_basic_strike_t1', BLANK)).toBe('core_tap_t1');
  });

  it('reverts basic tier rewrite from factory (t1 -> t2) back to the pre-combat basic', () => {
    expect(
      persistedQueueSlotIdAfterCombat('neutral_basic_strike_t1', 'neutral_basic_strike_t2', BLANK),
    ).toBe('neutral_basic_strike_t1');
  });

  it('keeps a grafted non-basic (e.g. Core Rebirth) as the final id', () => {
    expect(
      persistedQueueSlotIdAfterCombat('neutral_basic_strike_t1', 'salvage_strike_t1', BLANK),
    ).toBe('salvage_strike_t1');
  });

  it('keeps identical neutral basic', () => {
    expect(
      persistedQueueSlotIdAfterCombat('neutral_basic_strike_t1', 'neutral_basic_strike_t1', BLANK),
    ).toBe('neutral_basic_strike_t1');
  });

  it('applies one deck swap per reverted slot', () => {
    const deck = ['a', 'neutral_basic_strike_t1', 'b'];
    const finalQ = [null, 'neutral_basic_strike_t1', null] as (string | null)[];
    const next = [null, 'core_tap_t1', null] as (string | null)[];
    const out = applyQueuePersistenceToPlayerDeck(deck, finalQ, next);
    expect(out.filter((c) => c === 'core_tap_t1').length).toBe(1);
    expect(out.filter((c) => c === 'neutral_basic_strike_t1').length).toBe(0);
  });
});
