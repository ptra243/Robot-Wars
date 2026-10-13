import type { EffectStep } from '../../types';
import type { PipelineFrame } from './types';

export function dispatchPostStepAuras(
  step: EffectStep,
  frame: PipelineFrame,
  actorChargeBeforeStep: number,
  actorBlockBeforeStep: number,
  actorHpBeforeStep: number,
): void {
  const { actor, target, state, ctx } = frame;
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

