import { COMBAT_RULES } from '../rules';
import type { CombatEvent, FighterState } from '../types';
import { syncExposeAuraFromField } from './state';

/**
 * Adds junk respecting {@link FighterState.junkCapacity}. When finite, overflow becomes
 * Expose stacks on `target` (Rust Ranger base).
 */
export function gainJunkWithCap(
  actor: FighterState,
  target: FighterState,
  amount: number,
  round: number,
  log: (event: Omit<CombatEvent, 'snapshot'>) => void,
): void {
  if (amount <= 0) {
    return;
  }
  if (!Number.isFinite(actor.junkCapacity)) {
    actor.junk += amount;
    return;
  }
  const cap = actor.junkCapacity;
  const room = Math.max(0, cap - actor.junk);
  const toGain = Math.min(amount, room);
  actor.junk += toGain;
  const overflow = amount - toGain;
  if (overflow > 0) {
    target.exposeDamage = Math.min(COMBAT_RULES.maxExposeArm, target.exposeDamage + overflow);
    syncExposeAuraFromField(target);
    log({
      type: 'junk_overflow_expose',
      round,
      actor: actor.name,
      text: `${actor.name} is at max junk (${String(cap)}); ${String(overflow)} spills to Expose on ${target.name}.`,
    });
  }
}
