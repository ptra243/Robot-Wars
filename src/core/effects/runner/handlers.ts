import { SeededRandom } from '../../content';
import { gainJunkWithCap } from '../../combat/junkEconomy';
import { addStunnedTurns, syncExposeAuraFromField } from '../../combat/state';
import { replaceOneDeckOccurrence } from '../../deckMutation';
import { blankCardIdForTraits } from '../../run/combatSetup';
import { COMBAT_RULES } from '../../rules';
import { isPrimeSlotForActor } from '../../clockwork';
import type { EffectStep, FighterState, StanceType } from '../../types';
import { applyHpLossWithEmergencyProtocol } from '../../combat/emergencyProtocol';
import {
  applyEmergencyJunkShieldPreMitigation,
  applyHeapBallastToIncoming,
  applyOutgoingWeaken,
  dealDirectHpDamage,
  maybeMirrorCoreSelfDamageLoss,
} from './damage';
import type { EffectHandler, EffectType, PipelineFrame } from './types';

function clearContinuousForSlot(actor: FighterState, queueIndex: number): void {
  actor.auras = actor.auras.filter(
    (a) => !(a.type === 'Continuous' && a.sourceQueueIndex === queueIndex),
  );
  delete actor.continuousTicksByQueueIndex[queueIndex];
  delete actor.continuousNextTickRoundByQueueIndex[queueIndex];
}

function junkPlusCore(actor: FighterState): number {
  return actor.junk + actor.coreScrap;
}

/** Soften self-damage while Heap Padding is online; never reduces below dealing 0 if amount was positive and floor allows. */
function applyHeapPaddingToSelfDamage(actor: FighterState, amount: number): number {
  const pad = actor.heapPadding;
  if (!pad || amount <= 0) return amount;
  if (actor.junk < pad.minJunk) return amount;
  return Math.max(0, amount - pad.reduceBy);
}

function applyBloodToScrapFromSelfDamage(loss: number, frame: PipelineFrame): void {
  const per = frame.actor.bloodToScrapJunkPerSelfDamage ?? 0;
  if (loss <= 0 || per <= 0) return;
  gainJunkWithCap(
    frame.actor,
    frame.target,
    loss * per,
    frame.state.roundIndex,
    (e) => frame.ctx.pushEv(e),
  );
}

function applyScrapAnestheticFromSelfDamage(actor: FighterState, loss: number): void {
  const a = actor.scrapAnesthetic;
  if (!a || loss <= 0 || a.blockPerHpLost <= 0) return;
  const block = Math.min(a.capPerHit, loss * a.blockPerHpLost);
  if (block > 0) actor.block += block;
}

function applyStrikeResolveBonusJunk(frame: PipelineFrame): void {
  const { actor, target, state, ctx } = frame;
  let gain = actor.strikeResolveBonusJunk ?? 0;
  const anemic = actor.strikeResolveBonusJunkIfHpFractionAtMost;
  if (anemic && anemic.amount > 0) {
    const cap = Math.max(1, actor.maxHp || COMBAT_RULES.startingHp);
    if (actor.hp <= cap * anemic.maxHpFraction) {
      gain += anemic.amount;
    }
  }
  if (gain <= 0) return;
  gainJunkWithCap(actor, target, gain, state.roundIndex, (e) => ctx.pushEv(e));
}

function markActivatedStance(actor: FighterState, stance: StanceType): void {
  if (stance === 'dragon') actor.activatedDragonThisCombat = true;
  else if (stance === 'tiger') actor.activatedTigerThisCombat = true;
  else if (stance === 'bird') actor.activatedBirdThisCombat = true;
  else if (stance === 'tortoise') actor.activatedTortoiseThisCombat = true;
}

export const effectHandlers: { [T in EffectType]: EffectHandler<T> } = {
  SpendJunk: (step, { actor }) => {
    actor.junk -= step.amount;
  },
  SpendCore: (step, { actor }) => {
    actor.coreScrap -= step.amount;
  },
  GainJunk: (step, frame) => {
    gainJunkWithCap(
      frame.actor,
      frame.target,
      step.amount,
      frame.state.roundIndex,
      (e) => frame.ctx.pushEv(e),
    );
  },
  GainCore: (step, { actor }) => {
    actor.coreScrap += step.amount;
  },
  SpendAllCoreGainBulk: (_step, { actor }) => {
    const n = actor.coreScrap;
    actor.coreScrap = 0;
    if (n > 0) {
      const room = Math.max(0, COMBAT_RULES.maxBulkStacks - actor.bulkStacks);
      actor.bulkStacks += Math.min(n, room);
    }
  },
  GainCharge: (step, { actor }) => {
    actor.charge += step.amount;
  },
  GainFaith: (step, { actor }) => {
    if (step.amount > 0) actor.faithStacks += step.amount;
  },
  AddPrimeSlotStrikePotencyBonus: (step, { actor }) => {
    if (step.amount > 0) actor.primeSlotStrikePotencyBonus += step.amount;
  },
  GrantTemporaryPrimeSlots: (step, { actor, queueSlotIndex }) => {
    if (step.count <= 0 || queueSlotIndex === undefined) return;
    const extraFromRelic = actor.traitIds.includes('relic_clockwork_second_pendulum') ? 1 : 0;
    const grantCount = step.count + extraFromRelic;
    const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
    for (let i = 1; i <= grantCount; i += 1) {
      const slot = (queueSlotIndex + i) % activeSlots;
      if (!actor.temporaryPrimeSlots.includes(slot)) {
        actor.temporaryPrimeSlots.push(slot);
        if (isPrimeSlotForActor(slot, { ...actor, temporaryPrimeSlots: [] }).isPrime) {
          actor.charge += 1;
        }
      }
    }
  },
  AddStrikePotency: (step, { actor }) => {
    actor.potency += step.amount;
  },
  AddShieldPotency: (step, { actor }) => {
    actor.potency += step.amount;
  },
  HealSelf: (step, { actor }) => {
    if (step.amount > 0) {
      const cap = Math.max(1, actor.maxHp || COMBAT_RULES.startingHp);
      actor.hp = Math.min(actor.hp + step.amount, cap);
    }
  },
  GainMaxHp: (step, { actor }) => {
    if (step.amount > 0) {
      actor.maxHp = Math.max(1, actor.maxHp + step.amount);
    }
  },
  SelfDamage: (step, frame) => {
    if (step.amount <= 0) return;
    const { actor, state, ctx } = frame;
    const amount = applyHeapPaddingToSelfDamage(actor, step.amount);
    const loss = applyHpLossWithEmergencyProtocol(actor, amount, state.roundIndex, (e) => ctx.pushEv(e));
    applyScrapAnestheticFromSelfDamage(actor, loss);
    applyBloodToScrapFromSelfDamage(loss, frame);
    maybeMirrorCoreSelfDamageLoss(loss, frame);
  },
  SelfDamageRespectFloor1: (step, frame) => {
    if (step.amount <= 0) return;
    const { actor } = frame;
    const amount = applyHeapPaddingToSelfDamage(actor, step.amount);
    const room = Math.max(0, actor.hp - 1);
    const loss = Math.min(amount, room);
    if (loss > 0) actor.hp -= loss;
    applyScrapAnestheticFromSelfDamage(actor, loss);
    applyBloodToScrapFromSelfDamage(loss, frame);
    maybeMirrorCoreSelfDamageLoss(loss, frame);
  },
  GainEmergencyProtocolStacks: (step, { actor }) => {
    if (step.amount > 0) actor.emergencyProtocolStacks += step.amount;
  },
  SetMirrorCoreSelfDamage: (step, { actor }) => {
    actor.mirrorCoreSelfDamage = step.active;
  },
  ApplyWeaken: (step, { target }) => {
    if (step.stacks > 0) target.weakenStacks += step.stacks;
  },
  AddStunnedToSelf: (step, { actor }) => {
    addStunnedTurns(actor, step.turns);
  },
  ScheduleEffectAfterRounds: (step, { actor, state }) => {
    if (step.delayRounds <= 0 || step.steps.length === 0) return;
    actor.scheduledEffects.push({
      fireAtRound: state.roundIndex + step.delayRounds,
      steps: [...step.steps],
    });
  },
  StrikeDamage: (step, frame) => {
    const { actor, target, state, ctx } = frame;
    let damage = step.baseDamage;
    const b = step.bonusDamageIfJunkPlusCoreSumGte;
    if (b && junkPlusCore(actor) >= b.threshold) damage += b.bonus;
    const perPrior = step.bonusPerPriorStrikeThisCombat;
    if (perPrior !== undefined && perPrior !== 0) damage += perPrior * actor.strikeResolutionsThisCombat;
    const snapTiers = step.bonusFlatDamageIfJunkSnapshotGte;
    if (snapTiers) {
      for (const t of snapTiers) {
        if (frame.junkSnapshotAtResolveStart >= t.minJunk) damage += t.bonus;
      }
    }
    if (step.useStrikePotency !== false) {
      damage += actor.potency;
      if (frame.ctx.primeActiveForResolution) {
        damage += actor.primeSlotStrikePotencyBonus;
      }
    }
    if (frame.ctx.primeActiveForResolution) {
      damage += actor.faithStacks;
    }
    const evade = target.evadeStacks ?? 0;
    if (evade > 0 && damage > 0) {
      target.evadeStacks = evade - 1;
      return;
    }
    const mit = target.mitigateNextIncomingStrike ?? 0;
    if (mit > 0 && damage > 0) {
      const useMit = Math.min(mit, damage);
      damage -= useMit;
      target.mitigateNextIncomingStrike = mit - useMit;
    }
    ctx.strikeDamageStepsThisPipeline = (ctx.strikeDamageStepsThisPipeline ?? 0) + 1;
    if (!step.deferExposeClear) {
      ctx.strikesThatConsumeExposeAtEnd = (ctx.strikesThatConsumeExposeAtEnd ?? 0) + 1;
    }
    if (ctx.exposePoolForMultiStrike === null || ctx.exposePoolForMultiStrike === undefined) {
      ctx.exposePoolForMultiStrike = target.exposeDamage;
    }
    const exposePool = ctx.exposePoolForMultiStrike ?? 0;
    if (exposePool > 0) {
      damage += exposePool;
      syncExposeAuraFromField(target);
      ctx.pushEv({
        type: 'expose_finisher',
        round: state.roundIndex,
        actor: actor.name,
        text: `${actor.name} applies Expose (+${String(exposePool)}) to this strike.`,
      });
    }
    damage = applyOutgoingWeaken(damage, actor);
    damage = applyEmergencyJunkShieldPreMitigation(target, damage, true);
    if (damage <= 0) return;
    let pierce = step.pierce;
    const pierceCharges = actor.nextStrikePierceCharges ?? 0;
    if (pierceCharges > 0) {
      pierce = true;
      actor.nextStrikePierceCharges = pierceCharges - 1;
    }
    let hpLoss: number;
    if (pierce) {
      hpLoss = damage;
    } else {
      const absorbed = Math.min(target.block, damage);
      target.block -= absorbed;
      hpLoss = damage - absorbed;
    }
    const bulkMit = Math.min(target.bulkStacks, hpLoss);
    hpLoss -= bulkMit;
    hpLoss = applyHeapBallastToIncoming(target, hpLoss);
    applyHpLossWithEmergencyProtocol(target, hpLoss, state.roundIndex, (e) => ctx.pushEv(e));
    actor.strikeResolutionsThisCombat += 1;
    applyStrikeResolveBonusJunk(frame);
    if (damage > 0) ctx.dispatchAuraTrigger(state, target, actor, 'OnDamageTaken');
  },
  ShieldBlock: (step, { actor }) => {
    let block = step.baseBlock + actor.potency;
    const bc = step.bonusBlockIfJunkPlusCoreSumGte;
    if (bc && junkPlusCore(actor) >= bc.threshold) block += bc.bonus;
    const perJunk = step.bonusBlockPerJunkHeld;
    if (perJunk) block += Math.min(actor.junk, perJunk.cap ?? 999);
    const perEvery = step.bonusBlockPerJunkEveryN;
    if (perEvery && perEvery.divisor > 0) block += Math.floor(actor.junk / perEvery.divisor);
    if (block > 0) actor.block += block;
  },
  OptionalSpendJunkForGainCharge: (step, { actor }) => {
    if (actor.junk >= step.spend) {
      actor.junk -= step.spend;
      actor.charge += step.gainCharge;
    }
  },
  TransformCurrentQueueSlot: (step, { actor, ctx, state, queueSlotIndex }) => {
    if (queueSlotIndex === undefined || queueSlotIndex < 0 || queueSlotIndex >= actor.queue.length) return;
    let newId: string | undefined;
    let factoryReset = false;
    // Card JSON uses singular `Tier` (see scavenger Core Tap / Factory Reset prints).
    if (step.matchNeutralBasicTierToResolvingCard) {
      // Destroy -> empty slot, then rematerialize like combat-start blanks (Tempered Blanks / Multistrike Protocol).
      newId = blankCardIdForTraits(actor.traitIds ?? []);
      factoryReset = true;
    } else if (step.newCardId) {
      newId = step.newCardId;
    }
    if (newId) {
      const oldId = actor.queue[queueSlotIndex] ?? undefined;
      actor.queue[queueSlotIndex] = newId;
      replaceOneDeckOccurrence(actor.deck, oldId, newId);
      clearContinuousForSlot(actor, queueSlotIndex);
      if (factoryReset) {
        ctx.pushEv({
          type: 'factory_reset',
          round: state.roundIndex,
          actor: actor.name,
          cardId: oldId ?? ctx.resolvingCard?.id,
          text: `${actor.name} Factory Reset: queue slot ${String(queueSlotIndex + 1)} cleared -> ${newId}.`,
        });
      }
    }
  },
  ReplaceRandomNeutralBasicWithCorePartsCard: (step, { actor, ctx, state, queueSlotIndex }) => {
    void step;
    if (!ctx.content || ctx.effectRngSeed === undefined) return;
    const neutralBasic = /^neutral_basic_strike_t([123])$/;
    const replaceCount = Math.min(3, Math.max(1, ctx.resolvingCard?.card_tier ?? 1));
    const baseSeed = (ctx.effectRngSeed ^ ((queueSlotIndex ?? 0) * 2654435761)) >>> 0;
    const basicSlotsInQueueOrder: number[] = [];
    const activeSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
    for (let i = 0; i < activeSlots; i += 1) {
      if (queueSlotIndex !== undefined && i === queueSlotIndex) continue;
      const id = actor.queue[i];
      if (id && neutralBasic.test(id)) basicSlotsInQueueOrder.push(i);
    }
    if (basicSlotsInQueueOrder.length === 0) {
      ctx.pushEv({
        type: 'core_rebirth_queue',
        round: state.roundIndex,
        actor: actor.name,
        text: `${actor.name}: Core Rebirth found no Neutral Basic Strike in the queue to upgrade.`,
      });
      return;
    }
    for (let rep = 0; rep < replaceCount; rep += 1) {
      if (rep >= basicSlotsInQueueOrder.length) break;
      const slot = basicSlotsInQueueOrder[rep];
      const matched = actor.queue[slot]?.match(neutralBasic);
      const tier = matched ? Number(matched[1]) : 1;
      const pool = ctx.content.getAll().filter(
        (c) =>
          !c.neutral &&
          c.faction === 'scavengers' &&
          c.card_tier === tier &&
          c.awakening_min <= 1 &&
          c.keywords.some((k) => k.type === 'FactoryReset'),
      );
      if (pool.length === 0) {
        ctx.pushEv({
          type: 'core_rebirth_queue',
          round: state.roundIndex,
          actor: actor.name,
          text: `${actor.name}: Core Rebirth has no Factory Reset scavenger card for tier ${String(tier)}.`,
        });
        break;
      }
      const rng = new SeededRandom((baseSeed ^ slot * 0x9e3779b9) >>> 0);
      const oldId = actor.queue[slot]!;
      const oldName = ctx.content.get(oldId).name;
      const pick = pool[rng.nextInt(pool.length)];
      actor.queue[slot] = pick.id;
      replaceOneDeckOccurrence(actor.deck, oldId, pick.id);
      clearContinuousForSlot(actor, slot);
      ctx.pushEv({
        type: 'core_rebirth_queue',
        round: state.roundIndex,
        actor: actor.name,
        text: `${actor.name}: Core Rebirth replaces slot ${String(slot + 1)} (${oldName} → ${pick.name}).`,
      });
    }
  },
  BranchIfCoreGte: (_step, _frame) => {},
  BranchIfJunkGte: (_step, _frame) => {},
  BranchIfMissingHpGte: (_step, _frame) => {},
  BranchIfChargeGte: (_step, _frame) => {},
  BranchIfFaithGte: (_step, _frame) => {},
  BranchIfOnPrimeSlot: (_step, _frame) => {},
  BranchIfClockworkSequence: (_step, _frame) => {},
  DirectHpDamage: (step, frame) => {
    let damage = step.baseDamage;
    if (step.extraDamagePerJunkFromSnapshot !== undefined) {
      damage += step.extraDamagePerJunkFromSnapshot * frame.junkSnapshotAtResolveStart;
    }
    if (step.useStrikePotency === true) damage += frame.actor.potency;
    if (frame.ctx.primeActiveForResolution) damage += frame.actor.faithStacks;
    dealDirectHpDamage(damage, step.pierce, frame, true);
  },
  GainChargeFromJunkSnapshotFloorDiv: (step, frame) => {
    if (step.divisor <= 0) return;
    frame.actor.charge += Math.floor(frame.junkSnapshotAtResolveStart / step.divisor);
  },
  GainJunkEqualToCurrentCharge: (_step, frame) => {
    frame.actor.junk += frame.actor.charge;
  },
  AddPotencyFromJunkSnapshotFloorDiv: (step, frame) => {
    if (step.divisor <= 0) return;
    frame.actor.potency += Math.floor(frame.junkSnapshotAtResolveStart / step.divisor);
  },
  ConditionalSpendCharge: (_step, _frame) => {},
  ShieldBlockEqualToActorBulkStacks: (_step, frame) => {
    const add = frame.actor.bulkStacks + frame.actor.potency;
    if (add > 0) frame.actor.block += add;
  },
  ShieldBlockFromJunkSnapshot: (step, frame) => {
    if (step.divisor <= 0) return;
    const block = Math.floor(frame.junkSnapshotAtResolveStart / step.divisor) + frame.actor.potency;
    if (block > 0) frame.actor.block += block;
  },
  DirectHpDamageFromActorBlock: (_step, frame) => {
    dealDirectHpDamage(frame.actor.block, false, frame, true);
  },
  ExposeFromJunkSnapshot: (step, frame) => {
    if (step.divisor <= 0) return;
    const v = Math.max(1, Math.floor(frame.junkSnapshotAtResolveStart / step.divisor));
    frame.target.exposeDamage = v;
    syncExposeAuraFromField(frame.target);
  },
  GrantNextStrikePierce: (step, { actor }) => {
    if (step.count > 0) actor.nextStrikePierceCharges = (actor.nextStrikePierceCharges ?? 0) + step.count;
  },
  GrantPerpetualRoundCharge: (step, { actor, queueSlotIndex }) => {
    if (step.totalRounds <= 0 || step.chargePerRound <= 0) return;
    actor.auras.push({
      type: 'PerpetualCharge',
      trigger: 'OnTurnStart',
      sourceQueueIndex: queueSlotIndex ?? -1,
      roundsLeft: step.totalRounds,
      chargePerRound: step.chargePerRound,
    });
  },
  AdjustEnemyCharge: (step, { target }) => {
    target.charge = Math.max(0, target.charge + step.delta);
  },
  GrantIncomingStrikeMitigation: (step, { actor }) => {
    if (step.amount > 0) {
      actor.mitigateNextIncomingStrike = (actor.mitigateNextIncomingStrike ?? 0) + step.amount;
    }
  },
  DoubleActorBlock: (_step, { actor }) => {
    actor.block *= 2;
  },
  SetShieldRoundRetainMultiplier: (step, { actor }) => {
    const r = step.retainMultiplier;
    if (r > 0 && r <= 1) actor.shieldRoundRetainMultiplier = r;
  },
  SetStance: (step, { actor }) => {
    actor.stance = step.stance;
    markActivatedStance(actor, step.stance);
  },
  BranchIfActorStance: (_step, _frame) => {},
  BranchIfActorActivatedStance: (_step, _frame) => {},
  GainShuriken: (step, { actor }) => {
    if (step.amount > 0) actor.shuriken = (actor.shuriken ?? 0) + step.amount;
  },
  SpendAllShuriken: (_step, { actor }) => {
    actor.shuriken = 0;
  },
  DirectHpDamagePerShurikenSpent: (step, frame) => {
    const shuriken = frame.actor.shuriken ?? 0;
    if (shuriken <= 0 || step.damagePerShuriken <= 0) return;
    frame.actor.shuriken = 0;
    const imbue = frame.actor.nextShurikenUnloadImbueVirusPerHit ?? 0;
    if (imbue > 0) {
      frame.target.virusStacks = (frame.target.virusStacks ?? 0) + shuriken * imbue;
      frame.actor.nextShurikenUnloadImbueVirusPerHit = 0;
    }
    dealDirectHpDamage(shuriken * step.damagePerShuriken, step.pierce === true, frame, true);
  },
  DirectHpDamagePerActivatedStance: (step, frame) => {
    const count =
      Number(frame.actor.activatedDragonThisCombat === true) +
      Number(frame.actor.activatedTigerThisCombat === true) +
      Number(frame.actor.activatedBirdThisCombat === true) +
      Number(frame.actor.activatedTortoiseThisCombat === true);
    if (count <= 0 || step.damagePerStance <= 0) return;
    dealDirectHpDamage(count * step.damagePerStance, step.pierce === true, frame, true);
  },
  GainEvade: (step, { actor }) => {
    if (step.amount > 0) actor.evadeStacks = (actor.evadeStacks ?? 0) + step.amount;
  },
  ApplyVirus: (step, { target }) => {
    if (step.stacks > 0) target.virusStacks = (target.virusStacks ?? 0) + step.stacks;
  },
  SetNextTigerCardOverclock: (step, { actor }) => {
    actor.nextTigerCardOverclock = step.active;
  },
  SetNextTigerCardPiercePotency: (step, { actor }) => {
    actor.nextTigerCardPierce = step.pierce;
    actor.nextTigerCardPotencyGain = (actor.nextTigerCardPotencyGain ?? 0) + step.potencyGain;
    actor.nextTigerCardPotencyAfterCardLoss =
      (actor.nextTigerCardPotencyAfterCardLoss ?? 0) + step.potencyAfterCardLoss;
  },
  SetNextTigerCardExposePerEnergy: (step, { actor }) => {
    actor.nextTigerCardExposePerEnergy = { amountPerEnergy: step.amountPerEnergy, cap: step.cap };
  },
  SetNextTigerCardExtraStrikeFromTargetVirus: (step, { actor }) => {
    actor.nextTigerCardExtraStrikeFromTargetVirusCap = step.cap;
  },
  SetNextShurikenUnloadImbueVirusPerHit: (step, { actor }) => {
    actor.nextShurikenUnloadImbueVirusPerHit = step.stacksPerHit;
  },
  ConsumeShieldForDirectDamage: (step, frame) => {
    const shield = frame.actor.block;
    if (shield <= 0 || step.shieldPerDamage <= 0) return;
    const spend = step.maxShieldSpend !== undefined ? Math.min(shield, step.maxShieldSpend) : shield;
    frame.actor.block -= spend;
    const damage = Math.floor(spend / step.shieldPerDamage);
    if (damage > 0) dealDirectHpDamage(damage, false, frame, true);
  },
  GainVirulentRetribution: (step, { actor }) => {
    if (step.amount > 0) {
      actor.virulentRetributionStacks = (actor.virulentRetributionStacks ?? 0) + step.amount;
    }
  },
  ConsumeAllShurikenGainShield: (step, { actor }) => {
    const shuriken = actor.shuriken ?? 0;
    actor.shuriken = 0;
    if (shuriken <= 0) return;
    if (step.shieldPerShuriken > 0) actor.block += shuriken * step.shieldPerShuriken;
    if ((step.gainVirulentRetributionIfAny ?? 0) > 0) {
      actor.virulentRetributionStacks =
        (actor.virulentRetributionStacks ?? 0) + (step.gainVirulentRetributionIfAny ?? 0);
    }
  },
  ShieldBlockAfterRounds: (_step, _frame) => {},
  SetBloodToScrapJunkPerSelfDamage: (step, { actor }) => {
    if (step.amount > 0) actor.bloodToScrapJunkPerSelfDamage = step.amount;
  },
  SetHeapPadding: (step, { actor }) => {
    if (step.minJunk >= 0 && step.reduceBy > 0) {
      actor.heapPadding = { minJunk: step.minJunk, reduceBy: step.reduceBy };
    }
  },
  SetHeapBallast: (step, { actor }) => {
    if (step.minJunk >= 0 && step.reduceBy > 0) {
      actor.heapBallast = { minJunk: step.minJunk, reduceBy: step.reduceBy };
    }
  },
  SetScrapAnesthetic: (step, { actor }) => {
    if (step.blockPerHpLost > 0 && step.capPerHit > 0) {
      actor.scrapAnesthetic = {
        blockPerHpLost: step.blockPerHpLost,
        capPerHit: step.capPerHit,
      };
    }
  },
  ConvertScrapEngines: (step, { actor, state, ctx }) => {
    if (step.maxEngines <= 0) return;
    if (step.spendJunk != null && step.spendJunk > 0) {
      if (actor.junk < step.spendJunk) return;
      actor.junk -= step.spendJunk;
    }
    const have = actor.scrapEngineCount ?? 0;
    const n = Math.min(have, step.maxEngines);
    if (n <= 0) return;
    const atkBefore = actor.scrapHoundAttackStacks ?? 0;
    const shdBefore = actor.scrapHoundShieldStacks ?? 0;
    actor.scrapEngineCount = have - n;
    if (step.into === 'attack') {
      actor.scrapHoundAttackStacks = atkBefore + n;
      if (atkBefore <= 0 && shdBefore <= 0) {
        ctx.pushEv({
          type: 'scrap_hound_summon',
          round: state.roundIndex,
          actor: actor.name,
          text: `${actor.name} summons a Scrap Hound (attack ×${String(n)}).`,
        });
      }
    } else if (step.into === 'shield') {
      actor.scrapHoundShieldStacks = shdBefore + n;
      if (atkBefore <= 0 && shdBefore <= 0) {
        ctx.pushEv({
          type: 'scrap_hound_summon',
          round: state.roundIndex,
          actor: actor.name,
          text: `${actor.name} summons a Scrap Hound (shield ×${String(n)}).`,
        });
      }
    } else if (step.into === 'energy') {
      actor.scrapEnergyEngineStacks = (actor.scrapEnergyEngineStacks ?? 0) + n;
    } else if (step.into === 'expose') {
      actor.scrapExposeEngineStacks = (actor.scrapExposeEngineStacks ?? 0) + n;
    }
    ctx.pushEv({
      type: 'scrap_engine_convert',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} converts ${String(n)} Scrap Engine(s) into ${step.into}.`,
    });
  },
  SetStrikeResolveBonusJunk: (step, { actor }) => {
    if (step.amount > 0) actor.strikeResolveBonusJunk = (actor.strikeResolveBonusJunk ?? 0) + step.amount;
  },
  SetStrikeResolveBonusJunkIfHpFractionAtMost: (step, { actor }) => {
    if (step.amount > 0 && step.maxHpFraction > 0) {
      actor.strikeResolveBonusJunkIfHpFractionAtMost = {
        maxHpFraction: step.maxHpFraction,
        amount: step.amount,
      };
    }
  },
  SetFirstCardOfCycleBonusCharge: (step, { actor }) => {
    if (step.amount > 0) {
      actor.firstCardOfCycleBonusCharge = (actor.firstCardOfCycleBonusCharge ?? 0) + step.amount;
    }
  },
  GainScrapEngine: (step, { actor }) => {
    if (step.amount > 0) actor.scrapEngineCount = (actor.scrapEngineCount ?? 0) + step.amount;
  },
  DirectHpDamagePerScrapEngine: (step, frame) => {
    const engines = frame.actor.scrapEngineCount ?? 0;
    if (engines <= 0 || step.damagePerEngine <= 0) return;
    let damage = engines * step.damagePerEngine;
    if (step.useStrikePotency) damage += frame.actor.potency;
    dealDirectHpDamage(damage, step.pierce === true, frame, true);
  },
  Keyword: (step, { ctx }) => {
    const strikesBefore = ctx.strikeDamageStepsThisPipeline ?? 0;
    ctx.applyKeyword(step.spec);
    if (step.spec.type === 'Expose' && strikesBefore > 0) {
      ctx.exposeKeywordAfterStrike = true;
    }
  },
};

export function getSpendPrerequisites(steps: EffectStep[]): { junk: number; core: number } {
  let junk = 0;
  let core = 0;
  for (const step of steps) {
    if (step.type === 'SpendJunk') {
      junk += step.amount;
      continue;
    }
    if (step.type === 'ConvertScrapEngines' && step.spendJunk != null && step.spendJunk > 0) {
      junk += step.spendJunk;
      continue;
    }
    if (step.type === 'SpendCore') {
      core += step.amount;
      continue;
    }
    break;
  }
  return { junk, core };
}

export function clearExposeAfterPipelineIfConsumed(frame: PipelineFrame): void {
  const { ctx, target, state, actor } = frame;
  const consumeStrikes = ctx.strikesThatConsumeExposeAtEnd ?? 0;
  const pool = ctx.exposePoolForMultiStrike ?? 0;
  if (
    consumeStrikes > 0 &&
    pool > 0 &&
    !ctx.exposeKeywordAfterStrike &&
    target.exposeDamage === pool
  ) {
    target.exposeDamage = 0;
    syncExposeAuraFromField(target);
    ctx.pushEv({
      type: 'expose_cleared',
      round: state.roundIndex,
      actor: actor.name,
      text: `${actor.name} spends the target's Expose stacks after this attack.`,
    });
  }
}

