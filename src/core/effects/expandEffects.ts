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
    } else if (step.type === 'BranchIfChargeGte') {
      const inner = actor.charge >= step.minCharge ? step.thenSteps : step.elseSteps;
      out.push(...expandEffectSteps(inner, actor, junkSnapshot));
    } else if (step.type === 'BranchIfFaithGte') {
      const inner = actor.faithStacks >= step.minFaith ? step.thenSteps : step.elseSteps;
      out.push(...expandEffectSteps(inner, actor, junkSnapshot));
    } else if (step.type === 'BranchIfOnPrimeSlot') {
      out.push({
        ...step,
        thenSteps: expandEffectSteps(step.thenSteps, actor, junkSnapshot),
        elseSteps: expandEffectSteps(step.elseSteps, actor, junkSnapshot),
      });
    } else if (step.type === 'BranchIfClockworkSequence') {
      out.push({
        ...step,
        thenSteps: expandEffectSteps(step.thenSteps, actor, junkSnapshot),
        elseSteps: expandEffectSteps(step.elseSteps, actor, junkSnapshot),
      });
    } else if (step.type === 'BranchIfActorStance') {
      const inner = actor.stance === step.stance ? step.thenSteps : step.elseSteps;
      out.push(...expandEffectSteps(inner, actor, junkSnapshot));
    } else if (step.type === 'BranchIfActorActivatedStance') {
      const active =
        (step.stance === 'dragon' && actor.activatedDragonThisCombat) ||
        (step.stance === 'tiger' && actor.activatedTigerThisCombat) ||
        (step.stance === 'bird' && actor.activatedBirdThisCombat) ||
        (step.stance === 'tortoise' && actor.activatedTortoiseThisCombat);
      const inner = active ? step.thenSteps : step.elseSteps;
      out.push(...expandEffectSteps(inner, actor, junkSnapshot));
    } else if (step.type === 'ConditionalSpendCharge') {
      out.push({
        ...step,
        thenSteps: expandEffectSteps(step.thenSteps, actor, junkSnapshot),
      });
    } else if (step.type === 'ShieldBlockAfterRounds') {
      out.push({
        type: 'ScheduleEffectAfterRounds',
        delayRounds: step.delayRounds,
        steps: [{ type: 'ShieldBlock', baseBlock: step.amount }],
      });
    } else if (step.type === 'ScheduleEffectAfterRounds') {
      out.push({
        ...step,
        steps: expandEffectSteps(step.steps, actor, junkSnapshot),
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
