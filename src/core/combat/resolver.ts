import { replaceOneDeckOccurrence } from '../deckMutation';
import { CardContentService } from '../content';
import { finalizeEffectPipeline, getResolvedEffectPipeline } from '../effects/compileLegacy';
import { expandEffectSteps } from '../effects/expandEffects';
import { getSpendPrerequisites, runEffectPipeline } from '../effects/runner';
import { COMBAT_RULES } from '../rules';
import { callTraitOnCardResolved } from '../traits';
import type { CardDef, CombatEvent, CombatState, FighterState, KeywordSpec } from '../types';
import { createAuraDispatchBudget, dispatchAuraTrigger } from './auras';
import {
  addStunnedTurns,
  advanceQueue,
  effectiveChargeCost,
  isContinuousSkipped,
  performStallOnCurrentQueuedCard,
} from './flow';
import { pushEv, syncExposeAuraFromField } from './state';

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

  if (!queuedId) {
    queuedId = 'neutral_basic_strike_t1';
  }
  if (actor.primeDirectiveActiveThisTurn) {
    queuedId = 'neutral_basic_strike_t1';
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

  const chargeCost = effectiveChargeCost(card, actor);
  if (actor.charge < chargeCost) {
    performStallOnCurrentQueuedCard(content, state, actor, events, 'charge');
    return;
  }

  actor.stallCountAtCursor = 0;
  actor.charge -= chargeCost;
  resolveCard(content, state, actor, target, card, queueIndex, events, true, combatSeed);
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
  const queueIdBeforeResolve = actor.queue[queueIndex] ?? null;

  const { dealt, blocked, selfDamage } = runEffectPipeline(
    state,
    actor,
    target,
    steps,
    {
      applyKeyword: (spec) => {
        if (spec.type === 'Overclock') {
          if (overclockConsumedThisResolution) {
            return;
          }
          overclockConsumedThisResolution = true;
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
      dispatchAuraTrigger: (dispatchState, dispatchActor, dispatchTarget, trigger) =>
        dispatchAuraTrigger(
          dispatchState,
          dispatchActor,
          dispatchTarget,
          trigger,
          events,
          auraBudget,
        ),
      auraBudget,
      pushEv: (event) => pushEv(state, events, event),
      resolvingCard: card,
      content,
      effectRngSeed,
    },
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
  });

  pushEv(state, events, {
    type: 'resolve',
    round: state.roundIndex,
    actor: actor.name,
    text:
      `${actor.name} resolves ${card.name} | dealt=${dealt} blocked=${blocked} selfDmg=${selfDamage} | ` +
      `${actor.name} HP=${actor.hp} EN=${actor.charge} J=${actor.junk} B=${actor.bulkStacks} | ` +
      `${target.name} HP=${target.hp} BL=${target.block}`,
  });

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
  combatSeed: number,
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
      if (allowBonusNext && keyword.value > 0) {
        if (actor.overclockBonusUsedThisTurn) {
          return;
        }
        const fired = resolveBonusNext(content, state, actor, target, events, combatSeed);
        if (fired) {
          actor.overclockBonusUsedThisTurn = true;
        }
      }
      return;
    case 'Switch':
      return;
    case 'TurboLink':
      if (allowBonusNext) {
        const spent = Math.max(1, Math.min(actor.bulkStacks, keyword.value));
        actor.bulkStacks -= spent;
        actor.junk += spent;
        resolveBonusNext(content, state, actor, target, events, combatSeed);
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
        });
        actor.continuousTicksByQueueIndex[queueIndex] = keyword.value;
        actor.continuousNextTickRoundByQueueIndex[queueIndex] = state.roundIndex + keyword.value;
      }
      return;
    case 'Pierce':
    case 'CoreParts':
    case 'UniqueDeck':
    case 'Persistent':
    case 'Virus':
    case 'Evade':
    case 'Shuriken':
    case 'Stance':
      return;
    case 'FactoryReset': {
      const tier = Math.min(3, Math.max(1, keyword.value));
      const newId = `neutral_basic_strike_t${tier}` as const;
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
        text: `${actor.name} Factory Reset: queue slot ${queueIndex + 1} -> ${newId}.`,
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
  resolveCard(content, state, actor, target, card, next, events, false, combatSeed);
  state.globalResolutions += 1;
  return true;
}
