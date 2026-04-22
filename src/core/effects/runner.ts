import { CardContentService, SeededRandom } from '../content';
import { gainJunkWithCap } from '../combat/junkEconomy';
import { syncExposeAuraFromField } from '../combat/state';
import { replaceOneDeckOccurrence } from '../deckMutation';
import type { AuraDispatchBudget } from '../combat/auras';
import { COMBAT_RULES } from '../rules';
import type {
  AuraTrigger,
  CardDef,
  CombatEvent,
  CombatState,
  EffectStep,
  FighterState,
  KeywordSpec,
} from '../types';

function clearContinuousForSlot(actor: FighterState, queueIndex: number): void {
  actor.auras = actor.auras.filter(
    (a) => !(a.type === 'Continuous' && a.sourceQueueIndex === queueIndex),
  );
  delete actor.continuousTicksByQueueIndex[queueIndex];
  delete actor.continuousNextTickRoundByQueueIndex[queueIndex];
}

/** Leading contiguous junk/core spend steps (matches legacy upfront payment). */
export function getSpendPrerequisites(steps: EffectStep[]): { junk: number; core: number } {
  let junk = 0;
  let core = 0;
  for (const step of steps) {
    if (step.type === 'SpendJunk') {
      junk += step.amount;
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

export interface EffectPipelineContext {
  pushEv: (event: Omit<CombatEvent, 'snapshot'>) => void;
  applyKeyword: (spec: KeywordSpec) => void;
  dispatchAuraTrigger: (
    state: CombatState,
    actor: FighterState,
    target: FighterState,
    trigger: AuraTrigger,
  ) => void;
  auraBudget: AuraDispatchBudget;
  /** Card currently resolving (for tier-matched factory transforms). */
  resolvingCard?: CardDef;
  content?: CardContentService;
  effectRngSeed?: number;
  /**
   * Expose: first StrikeDamage in this pipeline snapshots target.exposeDamage; every StrikeDamage
   * adds that snapshot as bonus; stacks clear at end of resolution unless an Expose keyword
   * ran after at least one strike (refresh for later turns).
   */
  exposePoolForMultiStrike?: number | null;
  strikeDamageStepsThisPipeline?: number;
  /** StrikeDamage steps that allow Expose to clear at end of this pipeline (excludes deferExposeClear strikes). */
  strikesThatConsumeExposeAtEnd?: number;
  exposeKeywordAfterStrike?: boolean;
}

interface PipelineFrame {
  state: CombatState;
  actor: FighterState;
  target: FighterState;
  ctx: EffectPipelineContext;
  queueSlotIndex?: number;
  /** Junk held before this card’s pipeline mutates junk (threshold gates / Rivet bonuses). */
  junkSnapshotAtResolveStart: number;
}

type EffectType = EffectStep['type'];
type EffectByType<T extends EffectType> = Extract<EffectStep, { type: T }>;
type EffectHandler<T extends EffectType> = (step: EffectByType<T>, frame: PipelineFrame) => void;

function junkPlusCore(actor: FighterState): number {
  return actor.junk + actor.coreScrap;
}

const SNAPSHOT_STEP_TYPES = new Set<EffectType>([
  'StrikeDamage',
  'DirectHpDamage',
  'DirectHpDamageFromActorBlock',
  'ShieldBlock',
  'ShieldBlockEqualToActorBulkStacks',
  'ShieldBlockFromJunkSnapshot',
  'SelfDamage',
  'SelfDamageRespectFloor1',
  'Keyword',
]);

/** Non-Strike damage: block/bulk mitigation; does not increment strike count or consume strike mitigation/Feint. */
function dealDirectHpDamage(
  rawDamage: number,
  pierce: boolean,
  frame: PipelineFrame,
  dispatchDamageAura: boolean,
): void {
  const { actor, target, state, ctx } = frame;
  if (rawDamage <= 0) {
    return;
  }
  let damage = rawDamage;
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
  target.hp -= hpLoss;
  if (dispatchDamageAura && damage > 0) {
    ctx.dispatchAuraTrigger(state, target, actor, 'OnDamageTaken');
  }
}

const effectHandlers: { [T in EffectType]: EffectHandler<T> } = {
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
  AddStrikePotency: (step, { actor }) => {
    actor.potency += step.amount;
  },
  AddShieldPotency: (step, { actor }) => {
    actor.potency += step.amount;
  },
  HealSelf: (step, { actor }) => {
    if (step.amount > 0) {
      actor.hp = Math.min(actor.hp + step.amount, COMBAT_RULES.startingHp);
    }
  },
  SelfDamage: (step, { actor }) => {
    if (step.amount > 0) {
      actor.hp = Math.max(0, actor.hp - step.amount);
    }
  },
  SelfDamageRespectFloor1: (step, { actor }) => {
    if (step.amount <= 0) {
      return;
    }
    const room = Math.max(0, actor.hp - 1);
    const loss = Math.min(step.amount, room);
    if (loss > 0) {
      actor.hp -= loss;
    }
  },
  StrikeDamage: (step, frame) => {
    const { actor, target, state, ctx } = frame;
    let damage = step.baseDamage;
    const b = step.bonusDamageIfJunkPlusCoreSumGte;
    if (b && junkPlusCore(actor) >= b.threshold) {
      damage += b.bonus;
    }
    const perPrior = step.bonusPerPriorStrikeThisCombat;
    if (perPrior !== undefined && perPrior !== 0) {
      damage += perPrior * actor.strikeResolutionsThisCombat;
    }
    const snapTiers = step.bonusFlatDamageIfJunkSnapshotGte;
    if (snapTiers) {
      for (const t of snapTiers) {
        if (frame.junkSnapshotAtResolveStart >= t.minJunk) {
          damage += t.bonus;
        }
      }
    }
    const useStrikePotency = step.useStrikePotency !== false;
    if (useStrikePotency) {
      damage += actor.potency;
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
    if (damage <= 0) {
      return;
    }

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
    target.hp -= hpLoss;
    actor.strikeResolutionsThisCombat += 1;
    if (damage > 0) {
      ctx.dispatchAuraTrigger(state, target, actor, 'OnDamageTaken');
    }
  },
  ShieldBlock: (step, { actor }) => {
    let block = step.baseBlock + actor.potency;
    const bc = step.bonusBlockIfJunkPlusCoreSumGte;
    if (bc && junkPlusCore(actor) >= bc.threshold) {
      block += bc.bonus;
    }
    const perJunk = step.bonusBlockPerJunkHeld;
    if (perJunk) {
      const cap = perJunk.cap ?? 999;
      block += Math.min(actor.junk, cap);
    }
    const perEvery = step.bonusBlockPerJunkEveryN;
    if (perEvery && perEvery.divisor > 0) {
      block += Math.floor(actor.junk / perEvery.divisor);
    }
    if (block > 0) {
      actor.block += block;
    }
  },
  OptionalSpendJunkForGainCharge: (step, { actor }) => {
    if (actor.junk >= step.spend) {
      actor.junk -= step.spend;
      actor.charge += step.gainCharge;
    }
  },
  TransformCurrentQueueSlot: (step, { actor, ctx, queueSlotIndex }) => {
    if (
      queueSlotIndex === undefined ||
      queueSlotIndex < 0 ||
      queueSlotIndex >= actor.queue.length
    ) {
      return;
    }
    let newId: string | undefined;
    if (step.matchNeutralBasicTierToResolvingCard) {
      const tier = Math.min(3, Math.max(1, ctx.resolvingCard?.card_tier ?? 1));
      newId = `neutral_basic_strike_t${tier}`;
    } else if (step.newCardId) {
      newId = step.newCardId;
    }
    if (newId) {
      const oldId = actor.queue[queueSlotIndex] ?? undefined;
      actor.queue[queueSlotIndex] = newId;
      replaceOneDeckOccurrence(actor.deck, oldId, newId);
      clearContinuousForSlot(actor, queueSlotIndex);
    }
  },
  ReplaceRandomNeutralBasicWithCorePartsCard: (step, { actor, ctx, state, queueSlotIndex }) => {
    void step;
    if (!ctx.content || ctx.effectRngSeed === undefined) {
      return;
    }
    const neutralBasic = /^neutral_basic_strike_t([123])$/;
    const replaceCount = Math.min(3, Math.max(1, ctx.resolvingCard?.card_tier ?? 1));
    const baseSeed = (ctx.effectRngSeed ^ ((queueSlotIndex ?? 0) * 2654435761)) >>> 0;

    const basicSlotsInQueueOrder: number[] = [];
    const activeSlots = Math.max(3, Math.min(COMBAT_RULES.queueSize, actor.activeQueueSlots));
    for (let i = 0; i < activeSlots; i += 1) {
      if (queueSlotIndex !== undefined && i === queueSlotIndex) {
        continue; // Keep the resolving card's transformed basic slot untouched.
      }
      const id = actor.queue[i];
      if (id && neutralBasic.test(id)) {
        basicSlotsInQueueOrder.push(i);
      }
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
      if (rep >= basicSlotsInQueueOrder.length) {
        break;
      }
      const slot = basicSlotsInQueueOrder[rep];
      const matched = actor.queue[slot]?.match(neutralBasic);
      const tier = matched ? Number(matched[1]) : 1;
      const pool = ctx.content.getAll().filter(
        (c) =>
          !c.neutral &&
          c.faction === 'scavengers' &&
          c.card_tier === tier &&
          c.awakening_min <= 1 &&
          c.keywords.some((k) => k.type === 'CoreParts'),
      );
      if (pool.length === 0) {
        ctx.pushEv({
          type: 'core_rebirth_queue',
          round: state.roundIndex,
          actor: actor.name,
          text: `${actor.name}: Core Rebirth has no CoreParts scavenger card for tier ${String(tier)}.`,
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
  BranchIfCoreGte: (step, frame) => {
    void step;
    void frame;
  },
  BranchIfJunkGte: (step, frame) => {
    void step;
    void frame;
  },
  DirectHpDamage: (step, frame) => {
    let damage = step.baseDamage;
    if (step.extraDamagePerJunkFromSnapshot !== undefined) {
      damage += step.extraDamagePerJunkFromSnapshot * frame.junkSnapshotAtResolveStart;
    }
    const useStrikePotency = step.useStrikePotency === true;
    if (useStrikePotency) {
      damage += frame.actor.potency;
    }
    dealDirectHpDamage(damage, step.pierce, frame, true);
  },
  GainChargeFromJunkSnapshotFloorDiv: (step, frame) => {
    if (step.divisor <= 0) {
      return;
    }
    frame.actor.charge += Math.floor(frame.junkSnapshotAtResolveStart / step.divisor);
  },
  GainJunkEqualToCurrentCharge: (_step, frame) => {
    frame.actor.junk += frame.actor.charge;
  },
  AddPotencyFromJunkSnapshotFloorDiv: (step, frame) => {
    if (step.divisor <= 0) {
      return;
    }
    frame.actor.potency += Math.floor(frame.junkSnapshotAtResolveStart / step.divisor);
  },
  ConditionalSpendCharge: (step, frame) => {
    void step;
    void frame;
  },
  ShieldBlockEqualToActorBulkStacks: (_step, frame) => {
    const add = frame.actor.bulkStacks + frame.actor.potency;
    if (add > 0) {
      frame.actor.block += add;
    }
  },
  ShieldBlockFromJunkSnapshot: (step, frame) => {
    if (step.divisor <= 0) {
      return;
    }
    const block =
      Math.floor(frame.junkSnapshotAtResolveStart / step.divisor) + frame.actor.potency;
    if (block > 0) {
      frame.actor.block += block;
    }
  },
  DirectHpDamageFromActorBlock: (_step, frame) => {
    dealDirectHpDamage(frame.actor.block, false, frame, true);
  },
  ExposeFromJunkSnapshot: (step, frame) => {
    if (step.divisor <= 0) {
      return;
    }
    const v = Math.max(1, Math.floor(frame.junkSnapshotAtResolveStart / step.divisor));
    frame.target.exposeDamage = v;
    syncExposeAuraFromField(frame.target);
  },
  GrantNextStrikePierce: (step, { actor }) => {
    if (step.count > 0) {
      actor.nextStrikePierceCharges = (actor.nextStrikePierceCharges ?? 0) + step.count;
    }
  },
  GrantPerpetualRoundCharge: (step, { actor, queueSlotIndex }) => {
    if (step.totalRounds <= 0 || step.chargePerRound <= 0) {
      return;
    }
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
    if (r > 0 && r <= 1) {
      actor.shieldRoundRetainMultiplier = r;
    }
  },
  Keyword: (step, { ctx }) => {
    const strikesBefore = ctx.strikeDamageStepsThisPipeline ?? 0;
    ctx.applyKeyword(step.spec);
    if (step.spec.type === 'Expose' && strikesBefore > 0) {
      ctx.exposeKeywordAfterStrike = true;
    }
  },
};

/**
 * Runs ordered effect steps. Snapshot for resolve metrics is taken before the first
 * StrikeDamage, ShieldBlock, Keyword, or similar step.
 */
export function runEffectPipeline(
  state: CombatState,
  actor: FighterState,
  target: FighterState,
  steps: EffectStep[],
  ctx: EffectPipelineContext,
  queueSlotIndex?: number,
  junkSnapshotAtResolveStart: number = actor.junk,
): { dealt: number; blocked: number; selfDamage: number } {
  ctx.exposePoolForMultiStrike = null;
  ctx.strikeDamageStepsThisPipeline = 0;
  ctx.strikesThatConsumeExposeAtEnd = 0;
  ctx.exposeKeywordAfterStrike = false;

  let targetHpBefore = 0;
  let targetBlockBefore = 0;
  let actorHpBefore = 0;
  let snapshotted = false;

  function ensureSnapshot(): void {
    if (!snapshotted) {
      targetHpBefore = target.hp;
      targetBlockBefore = target.block;
      actorHpBefore = actor.hp;
      snapshotted = true;
    }
  }

  const frame: PipelineFrame = {
    state,
    actor,
    target,
    ctx,
    queueSlotIndex,
    junkSnapshotAtResolveStart,
  };

  function runOne(step: EffectStep): void {
    if (step.type === 'ConditionalSpendCharge') {
      if (actor.charge >= step.spend) {
        actor.charge -= step.spend;
        for (const inner of step.thenSteps) {
          runOne(inner);
        }
      }
      return;
    }

    const actorChargeBeforeStep = actor.charge;
    const actorBlockBeforeStep = actor.block;
    const actorHpBeforeStep = actor.hp;
    if (SNAPSHOT_STEP_TYPES.has(step.type)) {
      ensureSnapshot();
    }
    const handler = effectHandlers[step.type] as EffectHandler<typeof step.type>;
    handler(step as EffectByType<typeof step.type>, frame);
    if (ctx.auraBudget.inTriggeredResolution) {
      return;
    }
    if (step.type === 'GainCharge' && step.amount > 0) {
      ctx.dispatchAuraTrigger(state, actor, target, 'OnChargeGained');
      return;
    }
    if (step.type === 'GainChargeFromJunkSnapshotFloorDiv' && step.divisor > 0) {
      if (actor.charge > actorChargeBeforeStep) {
        ctx.dispatchAuraTrigger(state, actor, target, 'OnChargeGained');
      }
      return;
    }
    if (step.type === 'OptionalSpendJunkForGainCharge' && actor.junk >= 0 && step.gainCharge > 0) {
      if (actor.charge > actorChargeBeforeStep) {
        ctx.dispatchAuraTrigger(state, actor, target, 'OnChargeGained');
      }
      return;
    }
    if (
      step.type === 'ShieldBlock' ||
      step.type === 'ShieldBlockEqualToActorBulkStacks' ||
      step.type === 'ShieldBlockFromJunkSnapshot' ||
      step.type === 'DoubleActorBlock'
    ) {
      const blockGained = Math.max(0, actor.block - actorBlockBeforeStep);
      if (blockGained > 0) {
        ctx.dispatchAuraTrigger(state, actor, target, 'OnShieldGained');
      }
      return;
    }
    if (step.type === 'HealSelf' && step.amount > 0) {
      if (actor.hp > actorHpBeforeStep) {
        ctx.dispatchAuraTrigger(state, actor, target, 'OnHealthGained');
      }
    }
  }

  for (const step of steps) {
    runOne(step);
  }

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

  if (!snapshotted) {
    targetHpBefore = target.hp;
    targetBlockBefore = target.block;
    actorHpBefore = actor.hp;
  }

  const dealt = Math.max(0, targetHpBefore - target.hp);
  const blocked = Math.max(0, targetBlockBefore - target.block);
  const selfDamage = Math.max(0, actorHpBefore - actor.hp);
  return { dealt, blocked, selfDamage };
}
