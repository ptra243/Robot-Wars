import type { CardContentService } from '../content';
import { COMBAT_RULES } from '../rules';
import { callTraitOnStall } from '../traits';
import type { CardDef, CombatEvent, CombatState, FighterState } from '../types';
import { gainJunkWithCap } from './junkEconomy';
import { createAuraDispatchBudget, dispatchAuraTrigger } from './auras';
import { pushEv } from './state';

export { addStunnedTurns } from './state';

export function effectiveChargeCost(card: CardDef, actor: FighterState): number {
  const o = card.charge_cost_if_core_gte;
  if (o && actor.coreScrap >= o.minCore) {
    return o.chargeCost;
  }
  return card.charge_cost;
}

export function advanceQueue(
  fighter: FighterState,
  _state?: CombatState,
  _events?: CombatEvent[],
): void {
  const activeSlots = Math.max(3, Math.min(COMBAT_RULES.queueSize, fighter.activeQueueSlots));
  const prevQ = fighter.queueCursor;
  fighter.queueCursor = (fighter.queueCursor + 1) % activeSlots;

  if (prevQ === activeSlots - 1) {
    fighter.programCycleCount += 1;
    if (
      fighter.traitIds.includes('rust_ranger_aw1') &&
      Number.isFinite(fighter.junkCapacity)
    ) {
      fighter.pendingRustRangerCircuit = true;
    }
  }

  fighter.deckCursor += 1;
  if (fighter.deck.length > 0 && fighter.deckCursor >= fighter.deck.length) {
    fighter.deckCursor = 0;
    fighter.deckWraps += 1;
  }
}

/** Applies deferred Aw1 max-junk bonus before any other start-of-activation junk (e.g. base trait +1). */
function applyPendingRustRangerCircuitBonus(
  state: CombatState,
  actor: FighterState,
  events: CombatEvent[],
): void {
  if (!actor.pendingRustRangerCircuit) {
    return;
  }
  actor.pendingRustRangerCircuit = false;
  if (!actor.traitIds.includes('rust_ranger_aw1') || !Number.isFinite(actor.junkCapacity)) {
    return;
  }
  actor.junkCapacity += 2;
  pushEv(state, events, {
    type: 'rust_ranger_circuit',
    round: state.roundIndex,
    actor: actor.name,
    text: `${actor.name} completes a battle program cycle — +2 max junk (cap ${String(actor.junkCapacity)}).`,
  });
}

/** +1 junk at start of this fighter's activation (Rust Ranger base), after pending circuit bonus. */
export function applyTurnStartForFighter(
  state: CombatState,
  actor: FighterState,
  opponent: FighterState,
  events: CombatEvent[],
): void {
  if (!actor.traitIds.includes('rust_ranger_base')) {
    return;
  }
  gainJunkWithCap(actor, opponent, 1, state.roundIndex, (e) => pushEv(state, events, e));
  pushEv(state, events, {
    type: 'rust_ranger_turn_junk',
    round: state.roundIndex,
    actor: actor.name,
    text: `${actor.name} gains +1 junk (Me and My Revolver).`,
  });
}

/**
 * Same stall pipeline as missing charge (trait hooks, stall count, optional forced skip).
 * For `stunned`, one Stunned stack is consumed after the stall resolves.
 */
export function performStallOnCurrentQueuedCard(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  events: CombatEvent[],
  variant: 'charge' | 'stunned',
): void {
  const activeSlots = Math.max(3, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
  const queueIndex = actor.queueCursor % activeSlots;
  const queuedId = actor.queue[queueIndex] ?? 'neutral_basic_strike_t1';
  const card = content.get(queuedId);

  actor.charge += 1;
  actor.stallCountAtCursor += 1;

  const traitCtx = { state, content, push: (ev: CombatEvent) => pushEv(state, events, ev) };
  callTraitOnStall(actor, card, traitCtx);

  pushEv(state, events, {
    type: variant === 'stunned' ? 'stunned_stall' : 'stall',
    round: state.roundIndex,
    actor: actor.name,
    text:
      variant === 'stunned'
        ? `${actor.name} is Stunned — stalls on ${card.name} (+1 energy).`
        : `${actor.name} stalls on ${card.name} (+1 energy).`,
  });

  if (actor.stallCountAtCursor >= COMBAT_RULES.maxStallsPerSlot) {
    pushEv(state, events, {
      type: 'stall_skip',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} forced-skip after repeated stalls.`,
    });
    actor.stallCountAtCursor = 0;
    advanceQueue(actor, state, events);
  }

  if (variant === 'stunned') {
    const idx = actor.auras.findIndex((a) => a.type === 'Stunned');
    if (idx >= 0) {
      const st = actor.auras[idx]!;
      if (st.type === 'Stunned') {
        st.turnsLeft -= 1;
        if (st.turnsLeft <= 0) {
          actor.auras = actor.auras.filter((_, i) => i !== idx);
        }
      }
    }
  }
}

/**
 * Start of this fighter's activation: pending RR circuit → OnTurnStart auras → RR +1 junk → Stunned (full stall) if present.
 * @returns true when the activation is consumed by Stunned (do not call resolveFighter).
 */
export function beginFighterTurn(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  opponent: FighterState,
  events: CombatEvent[],
): boolean {
  applyPendingRustRangerCircuitBonus(state, actor, events);
  applyContinuousTicks(state, actor, opponent, events);
  applyTurnStartForFighter(state, actor, opponent, events);

  const stun = actor.auras.find((a): a is { type: 'Stunned'; turnsLeft: number } => a.type === 'Stunned');
  if (stun && stun.turnsLeft > 0) {
    performStallOnCurrentQueuedCard(content, state, actor, events, 'stunned');
    return true;
  }
  return false;
}

export function isContinuousSkipped(actor: FighterState, queueIndex: number, card: CardDef): boolean {
  const continuous = card.keywords.find((keyword) => keyword.type === 'Continuous');
  if (!continuous) {
    return false;
  }
  const auraLinked = actor.auras.some(
    (a) => a.type === 'Continuous' && a.sourceQueueIndex === queueIndex,
  );
  return auraLinked || actor.continuousTicksByQueueIndex[queueIndex] !== undefined;
}

export function applyContinuousTicks(
  state: CombatState,
  fighter: FighterState,
  opponent: FighterState,
  events: CombatEvent[],
): void {
  dispatchAuraTrigger(state, fighter, opponent, 'OnTurnStart', events, createAuraDispatchBudget());
}

/** At round start: each fighter loses part of their Shield (block) carried from prior rounds. */
export function applyShieldDecayAtRoundStart(fighter: FighterState): void {
  const retain =
    fighter.shieldRoundRetainMultiplier ?? COMBAT_RULES.shieldBlockRetainAtRoundStartDefault;
  const clamped = Math.max(0, Math.min(1, retain));
  fighter.block = Math.floor(fighter.block * clamped);
}

export function armFatigueIfNeeded(state: CombatState, events: CombatEvent[]): void {
  if (state.fatigueArmed) {
    return;
  }
  if (state.roundIndex >= COMBAT_RULES.fatigueArmAfterCombatRounds) {
    state.fatigueArmed = true;
    pushEv(state, events, {
      type: 'fatigue_armed',
      round: state.roundIndex,
      text: 'Thermal runaway armed.',
    });
  }
}

export function applyFatigueIfArmed(state: CombatState, events: CombatEvent[]): void {
  if (!state.fatigueArmed) {
    return;
  }
  state.fatigueRoundsElapsed += 1;
  const damage =
    COMBAT_RULES.fatigueBaseDamage +
    (state.fatigueRoundsElapsed - 1) * COMBAT_RULES.fatigueStepDamage;
  state.player.hp -= damage;
  state.enemy.hp -= damage;
  pushEv(state, events, {
    type: 'fatigue_tick',
    round: state.roundIndex,
    text: `Thermal runaway deals ${damage} to both. HP Player=${state.player.hp}, Enemy=${state.enemy.hp}`,
  });
}
