import { describe, expect, it } from 'vitest';
import { COMBAT_RULES, RULE_LOCKS } from '../core/rules';

describe('COMBAT_RULES (global systems parity)', () => {
  it('arms thermal fatigue after the configured combat round', () => {
    expect(COMBAT_RULES.fatigueArmAfterCombatRounds).toBe(20);
  });

  it('uses linear thermal scaling after fatigue arms', () => {
    expect(COMBAT_RULES.fatigueBaseDamage).toBe(1);
    expect(COMBAT_RULES.fatigueStepDamage).toBe(1);
  });

  it('locks rule knobs for sim / UI agreement', () => {
    expect(RULE_LOCKS.potencyOrder).toBe('OffensivePotencyBeforeStrikeBody');
    expect(RULE_LOCKS.fatigueDamageType).toBe('Unblockable');
    expect(RULE_LOCKS.stallRetryTiming).toBe('SameSlotNextPass');
  });
});
