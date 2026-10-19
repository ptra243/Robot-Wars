import { COMBAT_RULES } from '../rules';
import type { AuraTrigger, CombatEvent, CombatState, FighterState } from '../types';
import { gainJunkWithCap } from './junkEconomy';
import { pushEv, syncExposeAuraFromField } from './state';

export interface AuraDispatchBudget {
  /** Count of triggered aura resolutions fired during the current base card resolution. */
  triggeredResolutions: number;
  /** Triggered runs should not recursively dispatch more aura triggers. */
  inTriggeredResolution: boolean;
}

export function createAuraDispatchBudget(): AuraDispatchBudget {
  return { triggeredResolutions: 0, inTriggeredResolution: false };
}

export function dispatchAuraTrigger(
  state: CombatState,
  actor: FighterState,
  target: FighterState,
  trigger: AuraTrigger,
  events: CombatEvent[],
  budget: AuraDispatchBudget,
): void {
  if (budget.inTriggeredResolution) {
    return;
  }
  if (budget.triggeredResolutions >= COMBAT_RULES.maxTriggeredAuraResolutionsPerCard) {
    pushEv(state, events, {
      type: 'aura_guardrail',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} aura trigger guardrail reached; skipping additional trigger effects.`,
    });
    return;
  }

  if (trigger === 'OnTurnStart') {
    const nextAuras: FighterState['auras'] = [];
    for (const aura of actor.auras) {
      if (aura.type === 'Continuous' && aura.trigger === 'OnTurnStart') {
        if (state.roundIndex >= aura.nextTickRound) {
          const minJunk = aura.minJunkToTick;
          const canTick = minJunk === undefined || actor.junk >= minJunk;
          if (canTick) {
            const junkGain = aura.junkPerTick ?? 1;
            const chargeGain = aura.chargePerTick ?? 1;
            if (junkGain > 0) {
              gainJunkWithCap(actor, target, junkGain, state.roundIndex, (e) =>
                pushEv(state, events, e),
              );
            }
            if (chargeGain > 0) actor.charge += chargeGain;
            pushEv(state, events, {
              type: 'continuous_tick',
              round: state.roundIndex,
              actor: actor.name,
              text: `${actor.name} gains +${String(junkGain)} junk/+${String(chargeGain)} energy from Continuous.`,
            });
          }
          aura.nextTickRound += aura.interval;
          actor.continuousNextTickRoundByQueueIndex[aura.sourceQueueIndex] = aura.nextTickRound;
          if (aura.enemyExposePerTick !== undefined && aura.enemyExposePerTick > 0) {
            const amt = aura.enemyExposePerTick;
            target.exposeDamage = Math.min(
              COMBAT_RULES.maxExposeArm,
              target.exposeDamage + amt,
            );
            syncExposeAuraFromField(target);
            pushEv(state, events, {
              type: 'expose_drone_tag',
              round: state.roundIndex,
              actor: target.name,
              text: `${target.name} gains Expose ${String(amt)} from Drone Uplink.`,
            });
          }
        }
        nextAuras.push(aura);
        continue;
      }
      if (aura.type === 'PerpetualCharge' && aura.trigger === 'OnTurnStart') {
        if (aura.roundsLeft > 0) {
          actor.charge += aura.chargePerRound;
          const nextLeft = aura.roundsLeft - 1;
          pushEv(state, events, {
            type: 'perpetual_charge_tick',
            round: state.roundIndex,
            actor: actor.name,
            text: `${actor.name} gains +${String(aura.chargePerRound)} energy from Perpetual Motion (${String(nextLeft)} round(s) left).`,
          });
          if (nextLeft > 0) {
            nextAuras.push({ ...aura, roundsLeft: nextLeft });
          }
        }
        continue;
      }
      nextAuras.push(aura);
    }
    actor.auras = nextAuras;
    return;
  }

  budget.triggeredResolutions += 1;

  if (trigger === 'OnDamageTaken') {
    return;
  }

  // Explicit dispatch points exist for these triggers even if no aura currently consumes them.
  if (
    trigger === 'OnChargeGained' ||
    trigger === 'OnShieldGained' ||
    trigger === 'OnHealthGained'
  ) {
    return;
  }
}

