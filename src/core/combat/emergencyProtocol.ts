import type { CombatEvent, FighterState } from '../types';

export type EmergencyProtocolLethalResult = 'none' | 'spent' | 'hold';

/**
 * If the fighter is at ≤0 HP, spend Emergency Protocol to survive at 1 HP:
 * - hold flag (Prime Directive): survive without spending a stack
 * - otherwise spend 1 stack and gain +1 potency
 */
export function tryEmergencyProtocolLethalSave(fighter: FighterState): EmergencyProtocolLethalResult {
  if (fighter.hp > 0) {
    return 'none';
  }
  if (fighter.preventEmergencyProtocolSpendThisTurn) {
    fighter.hp = 1;
    fighter.preventEmergencyProtocolSpendThisTurn = false;
    return 'hold';
  }
  if ((fighter.emergencyProtocolStacks ?? 0) > 0) {
    fighter.emergencyProtocolStacks -= 1;
    fighter.potency += 1;
    fighter.hp = 1;
    return 'spent';
  }
  return 'none';
}

export function pushEmergencyProtocolLethalEvent(
  result: EmergencyProtocolLethalResult,
  fighter: FighterState,
  round: number,
  pushEv: (event: Omit<CombatEvent, 'snapshot'>) => void,
): void {
  if (result === 'spent') {
    pushEv({
      type: 'emergency_protocol',
      round,
      actor: fighter.name,
      text: `${fighter.name} Emergency Protocol — spend 1 stack, +1 strike potency, survive at 1 HP (${String(
        fighter.emergencyProtocolStacks,
      )} stack(s) left).`,
    });
    return;
  }
  if (result === 'hold') {
    pushEv({
      type: 'emergency_protocol_hold',
      round,
      actor: fighter.name,
      text: `${fighter.name} Emergency Protocol stack is preserved this turn.`,
    });
  }
}

/**
 * Subtract HP, then try Emergency Protocol if lethal.
 * Returns HP lost from the hit before any lethal save (capped by HP the fighter had).
 */
export function applyHpLossWithEmergencyProtocol(
  fighter: FighterState,
  amount: number,
  round: number,
  pushEv?: (event: Omit<CombatEvent, 'snapshot'>) => void,
): number {
  if (amount <= 0) {
    return 0;
  }
  const before = fighter.hp;
  fighter.hp -= amount;
  const loss = Math.min(amount, Math.max(0, before));
  if (fighter.hp > 0) {
    return loss;
  }
  fighter.hp = 0;
  const result = tryEmergencyProtocolLethalSave(fighter);
  if (pushEv) {
    pushEmergencyProtocolLethalEvent(result, fighter, round, pushEv);
  }
  return loss;
}
