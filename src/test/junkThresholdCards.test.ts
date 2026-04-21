import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import type { EffectStep } from '../core/types';

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

function effectsSpendJunk(steps: EffectStep[] | undefined): boolean {
  if (!steps?.length) {
    return false;
  }
  for (const step of steps) {
    if (step.type === 'SpendJunk' || step.type === 'OptionalSpendJunkForGainCharge') {
      return true;
    }
    if (step.type === 'BranchIfCoreGte' || step.type === 'BranchIfJunkGte') {
      if (effectsSpendJunk(step.thenSteps) || effectsSpendJunk(step.elseSteps)) {
        return true;
      }
    }
    if (step.type === 'ConditionalSpendCharge' && effectsSpendJunk(step.thenSteps)) {
      return true;
    }
  }
  return false;
}

describe('Junk threshold cards (junk_*_t1)', () => {
  const content = CardContentService.loadDefault(0);

  it('never spend junk as a card cost (no SpendJunk / spend_junk / optional junk-for-charge)', () => {
    for (const id of JUNK_THRESHOLD_IDS) {
      const card = content.get(id);
      expect(card.spend_junk ?? 0, `${id} spend_junk`).toBe(0);
      expect(card.optional_spend_junk_for_charge, `${id} optional_spend_junk_for_charge`).toBeUndefined();
      if (card.effects?.length) {
        expect(effectsSpendJunk(card.effects), `${id} effects`).toBe(false);
      }
    }
  });
});
