import { runConditionalControlStep } from './runner/pipelineControl';
import type { CombatState, EffectStep, FighterState } from '../types';
import { dispatchPostStepAuras } from './runner/auraDispatch';
import {
  clearExposeAfterPipelineIfConsumed,
  effectHandlers,
} from './runner/handlers';
import {
  type EffectByType,
  type EffectHandler,
  type EffectPipelineContext,
  type PipelineFrame,
  SNAPSHOT_STEP_TYPES,
} from './runner/types';

export type { EffectPipelineContext } from './runner/types';
export { getSpendPrerequisites } from './runner/handlers';

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
    const controlFrame = {
      actor,
      queueSlotIndex,
      resolvingCardFaction: ctx.resolvingCard?.faction,
      primeActiveForResolution: ctx.primeActiveForResolution,
      completedClockworkSequenceStep: ctx.completedClockworkSequenceStep,
    };
    if (runConditionalControlStep(step, controlFrame, runOne)) {
      ctx.completedClockworkSequenceStep = controlFrame.completedClockworkSequenceStep ?? null;
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
    dispatchPostStepAuras(
      step,
      frame,
      actorChargeBeforeStep,
      actorBlockBeforeStep,
      actorHpBeforeStep,
    );
  }

  for (const step of steps) {
    runOne(step);
  }

  clearExposeAfterPipelineIfConsumed(frame);

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
