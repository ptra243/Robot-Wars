import { describe, expect, it } from 'vitest';
import {
  formatPrimeSlotNumbersOneBased,
  isPrimeSlotForTraitPlanning,
  primeSlotIndicesForTraitIds,
} from '../core/clockwork';

describe('prime slot planning UI', () => {
  it('hides primes for non-clockwork without clockwork traits', () => {
    expect(primeSlotIndicesForTraitIds([], 'scavengers').size).toBe(0);
    expect(primeSlotIndicesForTraitIds([], 'cyberpunk').size).toBe(0);
    expect(isPrimeSlotForTraitPlanning(2, [], 'scavengers')).toBe(false);
  });

  it('defaults to natural slots 3, 5, 7 for clockwork', () => {
    const set = primeSlotIndicesForTraitIds([], 'clockwork');
    expect(formatPrimeSlotNumbersOneBased(set)).toBe('3, 5, 7');
    expect(isPrimeSlotForTraitPlanning(2, [], 'clockwork')).toBe(true);
    expect(isPrimeSlotForTraitPlanning(0, [], 'clockwork')).toBe(false);
  });

  it('adds slots 1–2 for Clockwork Rook base', () => {
    const set = primeSlotIndicesForTraitIds(['clockwork_rook_base']);
    expect(formatPrimeSlotNumbersOneBased(set)).toBe('1, 2, 3, 5, 7');
  });

  it('Septenary Crown unlocks all slots 1–7', () => {
    const set = primeSlotIndicesForTraitIds(['relic_clockwork_septenary_crown']);
    expect(formatPrimeSlotNumbersOneBased(set)).toBe('1, 2, 3, 4, 5, 6, 7');
  });
});
