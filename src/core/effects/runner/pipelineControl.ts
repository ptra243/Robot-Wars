import type { EffectStep, FighterState } from '../../types';
import { isPrimeSlotForActor } from '../../clockwork';

export interface ConditionalStepFrame {
  actor: FighterState;
  queueSlotIndex?: number;
  resolvingCardFaction?: string;
  primeActiveForResolution?: boolean;
  completedClockworkSequenceStep?: number | null;
}

/**
 * Executes control-flow effect steps that own nested step lists.
 * Returns true if the step was handled, false if caller should execute normal handler flow.
 */
export function runConditionalControlStep(
  step: EffectStep,
  frame: ConditionalStepFrame,
  runOne: (inner: EffectStep) => void,
): boolean {
  if (step.type === 'ConditionalSpendCharge') {
    if (frame.actor.charge >= step.spend) {
      frame.actor.charge -= step.spend;
      for (const inner of step.thenSteps) {
        runOne(inner);
      }
    }
    return true;
  }
  if (step.type === 'BranchIfOnPrimeSlot') {
    const primeActive =
      frame.primeActiveForResolution === true ||
      (frame.queueSlotIndex !== undefined &&
        isPrimeSlotForActor(frame.queueSlotIndex, frame.actor).isPrime);
    const inner = primeActive ? step.thenSteps : step.elseSteps;
    for (const s of inner) runOne(s);
    return true;
  }
  if (step.type === 'BranchIfClockworkSequence') {
    const isClockwork = frame.resolvingCardFaction === 'clockwork';
    let ok = false;
    if (isClockwork) {
      if (step.step <= 1) ok = true;
      else ok = frame.actor.clockworkSequencePrev === step.step - 1;
    }
    if (ok) {
      frame.completedClockworkSequenceStep = Math.max(frame.completedClockworkSequenceStep ?? 0, step.step);
    }
    const inner = ok ? step.thenSteps : step.elseSteps;
    for (const s of inner) runOne(s);
    return true;
  }
  return false;
}

