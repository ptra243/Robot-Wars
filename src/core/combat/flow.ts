import type { CardContentService } from '../content';
import { finalizeEffectPipeline } from '../effects/compileLegacy';
import { expandEffectSteps } from '../effects/expandEffects';
import { getSpendPrerequisites, runEffectPipeline } from '../effects/runner';
import { blankCardIdForTraits } from '../run/combatSetup';
import { COMBAT_RULES } from '../rules';
import { callTraitOnStall, callTraitOnTurnStart } from '../traits';
import type { AuraTrigger, CardDef, CombatEvent, CombatState, FighterState } from '../types';
import { applyHpLossWithEmergencyProtocol } from './emergencyProtocol';
import { gainJunkWithCap } from './junkEconomy';
import { createAuraDispatchBudget, dispatchAuraTrigger } from './auras';
import { pushEv, syncExposeAuraFromField } from './state';

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
  const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, fighter.activeQueueSlots));
  const prevQ = fighter.queueCursor;
  fighter.queueCursor = (fighter.queueCursor + 1) % activeSlots;

  if (prevQ === activeSlots - 1) {
    fighter.programCycleCount += 1;
    fighter.cardsResolvedThisProgramCycle = 0;
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

/** Scrap Engines: +1 junk at the start of each of your activations per engine. */
export function applyScrapEngineTurnStartJunk(
  state: CombatState,
  actor: FighterState,
  opponent: FighterState,
  events: CombatEvent[],
): void {
  const engines = actor.scrapEngineCount ?? 0;
  if (engines <= 0) {
    return;
  }
  gainJunkWithCap(actor, opponent, engines, state.roundIndex, (e) => pushEv(state, events, e));
  pushEv(state, events, {
    type: 'scrap_engine_tick',
    round: state.roundIndex,
    actor: actor.name,
    text: `${actor.name} gains +${String(engines)} junk from Scrap Engine(s).`,
  });
}

/**
 * Converted Scrap Engine stacks: attack (stacks+potency direct), shield (stacks+potency block),
 * energy (+stacks charge), expose (+stacks on opponent).
 */
export function applyTypedScrapEngineTurnStart(
  state: CombatState,
  actor: FighterState,
  opponent: FighterState,
  events: CombatEvent[],
): void {
  const atk = actor.scrapHoundAttackStacks ?? 0;
  if (atk > 0) {
    const damage = atk + actor.potency;
    const absorbed = Math.min(opponent.block, damage);
    opponent.block -= absorbed;
    let hpLoss = damage - absorbed;
    const bulkMit = Math.min(opponent.bulkStacks, hpLoss);
    opponent.bulkStacks -= bulkMit;
    hpLoss -= bulkMit;
    applyHpLossWithEmergencyProtocol(opponent, hpLoss, state.roundIndex, (e) =>
      pushEv(state, events, e),
    );
    pushEv(state, events, {
      type: 'scrap_hound_attack',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name}'s Scrap Hound deals ${String(damage)} damage (${String(atk)} stacks + potency).`,
    });
  }
  const shd = actor.scrapHoundShieldStacks ?? 0;
  if (shd > 0) {
    const block = shd + actor.potency;
    actor.block += block;
    pushEv(state, events, {
      type: 'scrap_hound_shield',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name}'s Scrap Hound grants ${String(block)} Shield (${String(shd)} stacks + potency).`,
    });
  }
  const eng = actor.scrapEnergyEngineStacks ?? 0;
  if (eng > 0) {
    actor.charge += eng;
    pushEv(state, events, {
      type: 'scrap_energy_engine_tick',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} gains +${String(eng)} Energy from converted Scrap Engine(s).`,
    });
  }
  const exp = actor.scrapExposeEngineStacks ?? 0;
  if (exp > 0) {
    opponent.exposeDamage = Math.min(
      COMBAT_RULES.maxExposeArm,
      opponent.exposeDamage + exp,
    );
    syncExposeAuraFromField(opponent);
    pushEv(state, events, {
      type: 'scrap_expose_engine_tick',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} applies ${String(exp)} Expose from converted Scrap Engine(s).`,
    });
  }
}

export function decayWeakenAtTurnEnd(state: CombatState, fighter: FighterState, events: CombatEvent[]): void {
  if (fighter.weakenStacks <= 0) {
    return;
  }
  fighter.weakenStacks -= 1;
  pushEv(state, events, {
    type: 'weaken_decay',
    round: state.roundIndex,
    actor: fighter.name,
    text: `${fighter.name} Weaken decays to ${String(fighter.weakenStacks)}.`,
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
  const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
  const queueIndex = actor.queueCursor % activeSlots;
  const queuedId = actor.queue[queueIndex] ?? blankCardIdForTraits(actor.traitIds ?? []);
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
  if (actor.stance === 'dragon') actor.activatedDragonThisCombat = true;
  else if (actor.stance === 'tiger') actor.activatedTigerThisCombat = true;
  else if (actor.stance === 'bird') actor.activatedBirdThisCombat = true;
  else if (actor.stance === 'tortoise') actor.activatedTortoiseThisCombat = true;
  if (actor === state.player) {
    actor.overclockBonusUsedThisTurn = false;
  }
  actor.primeDirectiveActiveThisTurn = false;
  actor.preventEmergencyProtocolSpendThisTurn = false;
  resolveScheduledEffectsForTurn(content, state, actor, opponent, events);
  applyPendingRustRangerCircuitBonus(state, actor, events);
  applyContinuousTicks(state, actor, opponent, events);
  applyScrapEngineTurnStartJunk(state, actor, opponent, events);
  applyTypedScrapEngineTurnStart(state, actor, opponent, events);
  applyVirusTick(state, actor, events);
  const traitCtx = { state, content, push: (ev: CombatEvent) => pushEv(state, events, ev) };
  callTraitOnTurnStart(actor, opponent, traitCtx);
  applyTurnStartForFighter(state, actor, opponent, events);

  const stun = actor.auras.find((a): a is { type: 'Stunned'; turnsLeft: number } => a.type === 'Stunned');
  if (stun && stun.turnsLeft > 0) {
    performStallOnCurrentQueuedCard(content, state, actor, events, 'stunned');
    return true;
  }
  return false;
}

/** Virus is a start-of-turn DoT that bypasses shield and persists until cleared. */
function applyVirusTick(state: CombatState, actor: FighterState, events: CombatEvent[]): void {
  const stacks = actor.virusStacks ?? 0;
  if (stacks <= 0) {
    return;
  }
  applyHpLossWithEmergencyProtocol(actor, stacks, state.roundIndex, (e) => pushEv(state, events, e));
  pushEv(state, events, {
    type: 'virus_tick',
    round: state.roundIndex,
    actor: actor.name,
    text: `${actor.name} suffers ${String(stacks)} virus damage.`,
  });
}

function resolveScheduledEffectsForTurn(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  opponent: FighterState,
  events: CombatEvent[],
): void {
  const ready = actor.scheduledEffects.filter((entry) => entry.fireAtRound <= state.roundIndex);
  if (ready.length === 0) {
    return;
  }
  actor.scheduledEffects = actor.scheduledEffects.filter((entry) => entry.fireAtRound > state.roundIndex);
  for (const entry of ready) {
    const expanded = expandEffectSteps(entry.steps, actor, actor.junk);
    const steps = finalizeEffectPipeline(expanded);
    const { junk: needJunk, core: needCore } = getSpendPrerequisites(steps);
    if (needJunk > actor.junk || needCore > actor.coreScrap) {
      pushEv(state, events, {
        type: 'delayed_whiff',
        round: state.roundIndex,
        actor: actor.name,
        text: `${actor.name} cannot pay to resolve a delayed effect.`,
      });
      continue;
    }
    const auraBudget = createAuraDispatchBudget();
    runEffectPipeline(
      state,
      actor,
      opponent,
      steps,
      {
        applyKeyword: () => {},
        dispatchAuraTrigger: (
          dispatchState: CombatState,
          dispatchActor: FighterState,
          dispatchTarget: FighterState,
          trigger: AuraTrigger,
        ) =>
          dispatchAuraTrigger(
            dispatchState,
            dispatchActor,
            dispatchTarget,
            trigger,
            events,
            auraBudget,
          ),
        auraBudget,
        pushEv: (event: Omit<CombatEvent, 'snapshot'>) => pushEv(state, events, event),
        content,
      },
      undefined,
      actor.junk,
    );
    pushEv(state, events, {
      type: 'delayed_resolve',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} resolves a delayed effect.`,
    });
  }
}

/**
 * Emergency Protocol EOT backlash: stacks inflict self-damage equal to stack count.
 * Lethal saves (any source, including this drain) spend 1 stack via tryEmergencyProtocolLethalSave.
 */
export function resolveEmergencyProtocolEndOfPlayerTurn(state: CombatState, events: CombatEvent[]): void {
  const p = state.player;
  if (p.emergencyProtocolStacks <= 0) {
    return;
  }
  const stacksBefore = p.emergencyProtocolStacks;
  const selfDamage = Math.max(1, stacksBefore);
  pushEv(state, events, {
    type: 'emergency_protocol_drain',
    round: state.roundIndex,
    actor: p.name,
    text: `${p.name} Emergency Protocol backlash: takes ${selfDamage} self-damage (${String(
      stacksBefore,
    )} stack(s)).`,
  });
  applyHpLossWithEmergencyProtocol(p, selfDamage, state.roundIndex, (e) => pushEv(state, events, e));
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

export function isPersistentSkipped(actor: FighterState, queueIndex: number, card: CardDef): boolean {
  if (!card.keywords.some((keyword) => keyword.type === 'Persistent')) {
    return false;
  }
  return actor.persistentResolvedByQueueIndex[queueIndex] === true;
}

export function markPersistentResolved(actor: FighterState, queueIndex: number, card: CardDef): void {
  if (!card.keywords.some((keyword) => keyword.type === 'Persistent')) {
    return;
  }
  actor.persistentResolvedByQueueIndex[queueIndex] = true;
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
  applyHpLossWithEmergencyProtocol(state.player, damage, state.roundIndex, (e) =>
    pushEv(state, events, e),
  );
  applyHpLossWithEmergencyProtocol(state.enemy, damage, state.roundIndex, (e) =>
    pushEv(state, events, e),
  );
  pushEv(state, events, {
    type: 'fatigue_tick',
    round: state.roundIndex,
    text: `Thermal runaway deals ${damage} to both. HP Player=${state.player.hp}, Enemy=${state.enemy.hp}`,
  });
}
