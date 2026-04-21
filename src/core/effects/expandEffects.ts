import type { EffectStep, FighterState } from '../types';

/**
 * Expands branch steps using junk **held at the start of this card’s resolution** and refined scrap
 * (`coreScrap`) at expand time (same as resolve start before any pipeline steps run).
 */
export function expandEffectSteps(
  steps: EffectStep[],
  actor: FighterState,
  junkSnapshot: number,
): EffectStep[] {
  const out: EffectStep[] = [];
  for (const step of steps) {
    if (step.type === 'BranchIfCoreGte') {
      const inner = actor.coreScrap >= step.minCore ? step.thenSteps : step.elseSteps;
      out.push(...expandEffectSteps(inner, actor, junkSnapshot));
    } else if (step.type === 'BranchIfJunkGte') {
      const inner = junkSnapshot >= step.minJunk ? step.thenSteps : step.elseSteps;
      out.push(...expandEffectSteps(inner, actor, junkSnapshot));
    } else if (step.type === 'ConditionalSpendCharge') {
      out.push({
        ...step,
        thenSteps: expandEffectSteps(step.thenSteps, actor, junkSnapshot),
      });
    } else {
      out.push(step);
    }
  }
  return out;
}

/** @deprecated Use {@link expandEffectSteps} with an explicit junk snapshot. */
export function expandEffectStepsForActor(steps: EffectStep[], actor: FighterState): EffectStep[] {
  return expandEffectSteps(steps, actor, actor.junk);
}
