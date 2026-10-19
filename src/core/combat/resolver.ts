import { replaceOneDeckOccurrence } from '../deckMutation';
import { CardContentService } from '../content';
import { finalizeEffectPipeline, getResolvedEffectPipeline } from '../effects/compileLegacy';
import { expandEffectSteps } from '../effects/expandEffects';
import { getSpendPrerequisites, runEffectPipeline } from '../effects/runner';
import { COMBAT_RULES } from '../rules';
import { callTraitOnCardResolved } from '../traits';
import type { AuraTrigger, CardDef, CombatEvent, CombatState, FighterState, KeywordSpec } from '../types';
import { isPrimeSlotForActor } from '../clockwork';
import { blankCardIdForTraits } from '../run/combatSetup';
import { createAuraDispatchBudget, dispatchAuraTrigger } from './auras';
import {
  addStunnedTurns,
  advanceQueue,
  effectiveChargeCost,
  isContinuousSkipped,
  isPersistentSkipped,
  markPersistentResolved,
  performStallOnCurrentQueuedCard,
} from './flow';
import { pushEv, syncExposeAuraFromField } from './state';

function inferPrimaryStanceForCard(card: CardDef): 'dragon' | 'tiger' | 'bird' | 'tortoise' | null {
  for (const step of card.effects ?? []) {
    if (step.type === 'BranchIfActorStance') {
      return step.stance;
    }
    if (step.type === 'SetStance') {
      return step.stance;
    }
  }
  if (card.id.includes('_dragon_') || card.id.includes('dragon_')) return 'dragon';
  if (card.id.includes('_tiger_') || card.id.includes('tiger_')) return 'tiger';
  if (card.id.includes('_bird_') || card.id.includes('bird_')) return 'bird';
  if (card.id.includes('_tortoise_') || card.id.includes('tortoise_')) return 'tortoise';
  return null;
}

function cardHasJunkThreshold(card: CardDef): boolean {
  if (card.bonus_strike_damage_if_junk_plus_core_gte || card.bonus_block_if_junk_plus_core_gte) {
    return true;
  }
  const effects = getResolvedEffectPipeline(card);
  return effects.some(
    (step) =>
      step.type === 'BranchIfJunkGte' ||
      (step.type === 'StrikeDamage' && step.bonusDamageIfJunkPlusCoreSumGte !== undefined) ||
      (step.type === 'ShieldBlock' && step.bonusBlockIfJunkPlusCoreSumGte !== undefined),
  );
}

function deckIsAllNeutral(content: CardContentService, actor: FighterState): boolean {
  const ids = [...actor.deck, ...actor.queue.filter((id): id is string => Boolean(id))];
  if (ids.length === 0) return false;
  for (const id of ids) {
    try {
      if (!content.get(id).neutral) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function resolveFighter(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  target: FighterState,
  events: CombatEvent[],
  combatSeed: number,
): void {
  const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
  const queueIndex = actor.queueCursor % activeSlots;
  let queuedId = actor.queue[queueIndex];
  const blankId = blankCardIdForTraits(actor.traitIds ?? []);

  if (!queuedId) {
    queuedId = blankId;
  }
  if (actor.primeDirectiveActiveThisTurn) {
    queuedId = blankId;
  }

  const card = content.get(queuedId);
  if (isContinuousSkipped(actor, queueIndex, card)) {
    pushEv(state, events, {
      type: 'continuous_skip',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} skips ${card.name}.`,
    });
    advanceQueue(actor, state, events);
    return;
  }
  if (isPersistentSkipped(actor, queueIndex, card)) {
    pushEv(state, events, {
      type: 'persistent_skip',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} skips ${card.name} (Persistent already active).`,
    });
    advanceQueue(actor, state, events);
    return;
  }

  const cycleBonus = actor.firstCardOfCycleBonusCharge ?? 0;
  if (cycleBonus > 0 && (actor.cardsResolvedThisProgramCycle ?? 0) === 0) {
    actor.charge += cycleBonus;
    pushEv(state, events, {
      type: 'scrap_dynamo_tick',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} gains +${String(cycleBonus)} energy (first card of cycle).`,
    });
  }

  const chargeCost = effectiveChargeCost(card, actor);
  if (actor.charge < chargeCost) {
    performStallOnCurrentQueuedCard(content, state, actor, events, 'charge');
    return;
  }

  actor.stallCountAtCursor = 0;
  actor.charge -= chargeCost;
  resolveCard(content, state, actor, target, card, queueIndex, events, true, combatSeed);
  markPersistentResolved(actor, queueIndex, card);
  actor.cardsResolvedThisProgramCycle = (actor.cardsResolvedThisProgramCycle ?? 0) + 1;
  state.globalResolutions += 1;
  advanceQueue(actor, state, events);
}

function resolveCard(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  target: FighterState,
  card: CardDef,
  queueIndex: number,
  events: CombatEvent[],
  allowBonusNext: boolean,
  combatSeed: number,
): void {
  const isNeutralBasicStrike = /^neutral_basic_strike_t[123]$/.test(card.id);
  let rustRangerAw0SpentJunk = 0;
  if (actor.traitIds.includes('rust_ranger_aw0') && isNeutralBasicStrike && actor.junk > 0) {
    rustRangerAw0SpentJunk = actor.junk;
    actor.junk = 0;
    pushEv(state, events, {
      type: 'trait_effect',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} spends ${String(rustRangerAw0SpentJunk)} junk on Basic Strike (Fastest Gun in the West).`,
    });
  }

  const junkSnapshotAtResolveStart = actor.junk;
  const chargeBefore = actor.charge;
  const junkBefore = actor.junk;
  const potencyBefore = actor.potency;
  const rawSteps = getResolvedEffectPipeline(card);
  const expanded = expandEffectSteps(rawSteps, actor, junkSnapshotAtResolveStart);
  const firstStrikeIndex = expanded.findIndex((step) => step.type === 'StrikeDamage');
  const aw0Adjusted =
    rustRangerAw0SpentJunk > 0
      ? expanded.map((step, index) =>
          step.type === 'StrikeDamage' && index === firstStrikeIndex
            ? { ...step, baseDamage: step.baseDamage + rustRangerAw0SpentJunk }
            : step,
        )
      : expanded;
  const steps = finalizeEffectPipeline(aw0Adjusted);
  const isTigerCard = card.faction === 'cyberpunk' && /tiger/i.test(card.id);
  const isTigerStrikeCard = isTigerCard && card.tags.includes('Strike');
  let consumeTigerAfterCardLoss = 0;
  if (isTigerCard) {
    if (actor.nextTigerCardPotencyGain && actor.nextTigerCardPotencyGain > 0) {
      actor.potency += actor.nextTigerCardPotencyGain;
    }
    consumeTigerAfterCardLoss = actor.nextTigerCardPotencyAfterCardLoss ?? 0;
    if (actor.nextTigerCardPierce) {
      steps.unshift({ type: 'GrantNextStrikePierce', count: 1 });
    }
    if (isTigerStrikeCard && actor.nextTigerCardExposePerEnergy) {
      const bonusExpose = Math.min(
        actor.nextTigerCardExposePerEnergy.cap,
        actor.charge * actor.nextTigerCardExposePerEnergy.amountPerEnergy,
      );
      if (bonusExpose > 0) {
        steps.unshift({ type: 'Keyword', spec: { type: 'Expose', value: bonusExpose } });
      }
    }
    if (isTigerStrikeCard && (actor.nextTigerCardExtraStrikeFromTargetVirusCap ?? 0) > 0) {
      const cap = actor.nextTigerCardExtraStrikeFromTargetVirusCap ?? 0;
      const extraStrikes = Math.min(cap, target.virusStacks ?? 0);
      for (let i = 0; i < extraStrikes; i += 1) {
        steps.push({ type: 'StrikeDamage', baseDamage: 1, pierce: false, useStrikePotency: true });
      }
    }
    if (actor.nextTigerCardOverclock) {
      steps.push({ type: 'Keyword', spec: { type: 'Overclock', value: 1 } });
    }
  }
  const cardHadDelayScheduling = steps.some((step) => step.type === 'ScheduleEffectAfterRounds');
  if (actor.traitIds.includes('relic_overclock_mandate') && actor.junk > 40 && cardHasJunkThreshold(card)) {
    steps.push({ type: 'Keyword', spec: { type: 'Overclock', value: 1 } });
  }
  if (
    actor.traitIds.includes('relic_basic_instincts') &&
    /^neutral_basic_strike_t[123]$/.test(card.id) &&
    deckIsAllNeutral(content, actor)
  ) {
    steps.push({ type: 'Keyword', spec: { type: 'Overclock', value: 1 } });
  }
  const { junk: needJunk, core: needCore } = getSpendPrerequisites(steps);

  if (needJunk > actor.junk) {
    pushEv(state, events, {
      type: 'whiff',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} cannot pay junk for ${card.name}.`,
    });
    return;
  }

  if (needCore > actor.coreScrap) {
    pushEv(state, events, {
      type: 'whiff',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} cannot pay refined scrap for ${card.name}.`,
    });
    return;
  }

  const effectRngSeed =
    combatSeed + state.roundIndex * 1009 + queueIndex * 17 + state.globalResolutions * 31;
  const auraBudget = createAuraDispatchBudget();

  let overclockConsumedThisResolution = false;
  /** Deferred so bonus resolve does not bleed damage/selfDmg into this card's metrics. */
  let pendingBonusNext = false;
  const queueIdBeforeResolve = actor.queue[queueIndex] ?? null;
  const primeState = isPrimeSlotForActor(queueIndex, actor);
  const primeActiveForResolution = primeState.isPrime;
  if (primeActiveForResolution) {
    pushEv(state, events, {
      type: 'prime_activation',
      round: state.roundIndex,
      actor: actor.name,
      text: `Prime activated on slot ${String(queueIndex + 1)}.`,
    });
  }
  if ((actor.temporaryPrimeSlots ?? []).includes(queueIndex)) {
    actor.temporaryPrimeSlots = actor.temporaryPrimeSlots.filter((slot) => slot !== queueIndex);
  }

  const pipelineCtx = {
    applyKeyword: (spec: KeywordSpec) => {
      if (spec.type === 'Overclock') {
        if (overclockConsumedThisResolution) {
          return;
        }
        overclockConsumedThisResolution = true;
        if (allowBonusNext && spec.value > 0 && !actor.overclockBonusUsedThisTurn) {
          pendingBonusNext = true;
        }
        return;
      }
      if (spec.type === 'TurboLink' && allowBonusNext) {
        pendingBonusNext = true;
      }
      applyKeyword(
        content,
        state,
        actor,
        target,
        queueIndex,
        card,
        spec,
        events,
        allowBonusNext,
        combatSeed,
      );
    },
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
    resolvingCard: card,
    content,
    effectRngSeed,
    primeActiveForResolution,
    completedClockworkSequenceStep: null as number | null,
  };
  const { dealt, blocked, selfDamage } = runEffectPipeline(
    state,
    actor,
    target,
    steps,
    pipelineCtx,
    queueIndex,
    junkSnapshotAtResolveStart,
  );

  syncExposeAuraFromField(actor);
  syncExposeAuraFromField(target);

  if (rustRangerAw0SpentJunk > 0) {
    addStunnedTurns(actor, 1);
    pushEv(state, events, {
      type: 'trait_effect',
      round: state.roundIndex,
      actor: actor.name,
      text: `Fastest Gun in the West: ${actor.name} stalls next turn.`,
    });
  }

  // Dispatch onCardResolved to all active traits on the actor.
  const cardCtx = { state, content, push: (ev: CombatEvent) => pushEv(state, events, ev) };
  callTraitOnCardResolved(actor, target, card, queueIndex, cardCtx, {
    dealt,
    blocked,
    selfDamage,
    transformedCurrentSlot: (actor.queue[queueIndex] ?? null) !== queueIdBeforeResolve,
    chargeGained: Math.max(0, actor.charge - chargeBefore),
    junkGained: Math.max(0, actor.junk - junkBefore),
    junkSpent: Math.max(0, junkBefore - actor.junk),
    cardHadDelayScheduling,
    completedClockworkSequenceStep: pipelineCtx.completedClockworkSequenceStep,
    primeActivated: primeActiveForResolution,
  });

  pushEv(state, events, {
    type: 'resolve',
    round: state.roundIndex,
    actor: actor.name,
    cardId: card.id,
    text:
      `${actor.name} resolves ${card.name} | dealt=${dealt} blocked=${blocked} selfDmg=${selfDamage} | ` +
      `${actor.name} HP=${actor.hp} EN=${actor.charge} J=${actor.junk} B=${actor.bulkStacks} | ` +
      `${target.name} HP=${target.hp} BL=${target.block}`,
  });

  if (pendingBonusNext) {
    const fired = resolveBonusNext(content, state, actor, target, events, combatSeed);
    if (fired && overclockConsumedThisResolution) {
      actor.overclockBonusUsedThisTurn = true;
    }
  }

  if (card.id === 'ninja_masterful_form_t1') {
    const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
    const nextQueueIndex = (queueIndex + 1) % activeSlots;
    const nextQueuedId = actor.queue[nextQueueIndex] ?? blankCardIdForTraits(actor.traitIds ?? []);
    const nextCard = content.get(nextQueuedId);
    const inferred = inferPrimaryStanceForCard(nextCard);
    if (inferred) {
      actor.stance = inferred;
    }
  }

  if (isTigerCard) {
    if (consumeTigerAfterCardLoss > 0) {
      actor.potency = Math.max(0, actor.potency - consumeTigerAfterCardLoss);
    }
    actor.nextTigerCardOverclock = false;
    actor.nextTigerCardPierce = false;
    actor.nextTigerCardPotencyGain = 0;
    actor.nextTigerCardPotencyAfterCardLoss = 0;
    actor.nextTigerCardExposePerEnergy = null;
    actor.nextTigerCardExtraStrikeFromTargetVirusCap = null;
  }
  actor.lastResolvedCardFaction = card.faction;
  if (card.faction !== 'clockwork' && !(card.neutral && actor.traitIds.includes('clockwork_father_time_base'))) {
    actor.clockworkSequencePrev = null;
  } else {
    actor.clockworkSequencePrev = pipelineCtx.completedClockworkSequenceStep ?? null;
  }
  if (potencyBefore !== actor.potency) {
    actor.potency = Math.max(0, actor.potency);
  }
}

function applyKeyword(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  target: FighterState,
  queueIndex: number,
  card: CardDef,
  keyword: KeywordSpec,
  events: CombatEvent[],
  allowBonusNext: boolean,
  _combatSeed: number,
): void {
  switch (keyword.type) {
    case 'Bulk': {
      const add = keyword.value;
      if (add <= 0) return;
      const gained = Math.min(add, COMBAT_RULES.maxBulkStacks - actor.bulkStacks);
      if (gained <= 0) return;
      actor.bulkStacks += gained;
      return;
    }
    case 'Expose': {
      const add = keyword.value;
      if (add <= 0) return;
      target.exposeDamage = Math.min(COMBAT_RULES.maxExposeArm, target.exposeDamage + add);
      syncExposeAuraFromField(target);
      return;
    }
    case 'Overclock':
      /* Bonus resolution is deferred until after this card's resolve event (see resolveCard). */
      return;
    case 'Switch':
      return;
    case 'TurboLink':
      if (allowBonusNext) {
        const spent = Math.max(1, Math.min(actor.bulkStacks, keyword.value));
        actor.bulkStacks -= spent;
        actor.junk += spent;
        /* Bonus resolution deferred in resolveCard via pendingBonusNext. */
      }
      return;
    case 'Continuous':
      if (keyword.value > 0) {
        actor.auras = actor.auras.filter(
          (a) => !(a.type === 'Continuous' && a.sourceQueueIndex === queueIndex),
        );
        const isDroneUplink = /^neutral_expose_drone_uplink_t[123]$/.test(card.id);
        const enemyExposePerTick =
          isDroneUplink && card.tags.includes('Expose') ? card.card_tier : undefined;
        actor.auras.push({
          type: 'Continuous',
          trigger: 'OnTurnStart',
          sourceQueueIndex: queueIndex,
          interval: keyword.value,
          nextTickRound: state.roundIndex + keyword.value,
          ...(enemyExposePerTick !== undefined ? { enemyExposePerTick } : {}),
          ...(card.continuous_min_junk !== undefined
            ? { minJunkToTick: card.continuous_min_junk }
            : {}),
          ...(card.continuous_charge_per_tick !== undefined
            ? { chargePerTick: card.continuous_charge_per_tick }
            : {}),
          ...(card.continuous_junk_per_tick !== undefined
            ? { junkPerTick: card.continuous_junk_per_tick }
            : {}),
        });
        actor.continuousTicksByQueueIndex[queueIndex] = keyword.value;
        actor.continuousNextTickRoundByQueueIndex[queueIndex] = state.roundIndex + keyword.value;
      }
      return;
    case 'Pierce':
    case 'Prime':
    case 'Sequence':
    case 'Faith':
    case 'CoreParts':
    case 'UniqueDeck':
    case 'Persistent':
    case 'Virus':
    case 'Evade':
    case 'Shuriken':
    case 'Stance':
      return;
    case 'FactoryReset': {
      // Destroy the resolved card; rematerialize as an empty/blank slot (same as combat-start blanks).
      const newId = blankCardIdForTraits(actor.traitIds ?? []);
      content.get(newId);
      const oldId = actor.queue[queueIndex] ?? undefined;
      actor.queue[queueIndex] = newId;
      replaceOneDeckOccurrence(actor.deck, oldId, newId);
      actor.auras = actor.auras.filter(
        (a) => !(a.type === 'Continuous' && a.sourceQueueIndex === queueIndex),
      );
      delete actor.continuousTicksByQueueIndex[queueIndex];
      delete actor.continuousNextTickRoundByQueueIndex[queueIndex];
      pushEv(state, events, {
        type: 'factory_reset',
        round: state.roundIndex,
        actor: actor.name,
        cardId: oldId ?? card.id,
        text: `${actor.name} Factory Reset: queue slot ${queueIndex + 1} cleared -> ${newId}.`,
      });
      return;
    }
  }
}

/**
 * Lucky Numbers (Glint Aw1): queue slots 2, 4, 7 (1-indexed) each have a bonus effect that
 * fires after the card on that slot resolves.
 *   Slot 2 → +2 junk
 *   Slot 4 → +4 block
 *   Slot 7 → Strike 5 (hits through block, no potency)
 */

function resolveBonusNext(
  content: CardContentService,
  state: CombatState,
  actor: FighterState,
  target: FighterState,
  events: CombatEvent[],
  combatSeed: number,
): boolean {
  const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
  const next = (actor.queueCursor + 1) % activeSlots;
  const queuedId = actor.queue[next];

  if (!queuedId) {
    pushEv(state, events, {
      type: 'bonus_fizzle',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} bonus resolution fizzles.`,
    });
    return false;
  }

  const card = content.get(queuedId);
  const savedCursor = actor.queueCursor;
  actor.queueCursor = next;
  resolveCard(content, state, actor, target, card, next, events, false, combatSeed);
  markPersistentResolved(actor, next, card);
  state.globalResolutions += 1;
  actor.queueCursor = savedCursor;
  advanceQueue(actor, state, events);
  return true;
}
