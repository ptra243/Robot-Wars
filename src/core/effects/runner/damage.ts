import { applyHpLossWithEmergencyProtocol } from '../../combat/emergencyProtocol';
import type { AuraTrigger, CardDef, CombatEvent, CombatState, FighterState } from '../../types';

/** Heap Ballast: while junk is tall, reduce incoming HP loss. */
export function applyHeapBallastToIncoming(target: FighterState, hpLoss: number): number {
  if (hpLoss <= 0) return hpLoss;
  const ballast = target.heapBallast;
  if (!ballast || target.junk < ballast.minJunk || ballast.reduceBy <= 0) return hpLoss;
  return Math.max(0, hpLoss - ballast.reduceBy);
}

export interface RunnerDamageContext {
  resolvingCard?: CardDef;
  dispatchAuraTrigger: (
    state: CombatState,
    actor: FighterState,
    target: FighterState,
    trigger: AuraTrigger,
  ) => void;
  pushEv?: (event: Omit<CombatEvent, 'snapshot'>) => void;
}

export interface RunnerDamageFrame {
  state: CombatState;
  actor: FighterState;
  target: FighterState;
  ctx: RunnerDamageContext;
}

export function applyOutgoingWeaken(rawDamage: number, actor: FighterState): number {
  if (rawDamage <= 0) {
    return 0;
  }
  const weaken = actor.weakenStacks ?? 0;
  if (weaken <= 0) {
    return rawDamage;
  }
  return Math.max(0, rawDamage - weaken);
}

export function applyEmergencyJunkShieldPreMitigation(
  target: FighterState,
  incomingDamage: number,
  isStrike: boolean,
): number {
  if (incomingDamage <= 0) {
    return incomingDamage;
  }
  if (!target.traitIds.includes('relic_emergency_junk_shield')) {
    return incomingDamage;
  }
  if (target.junk <= 0) {
    return incomingDamage;
  }
  if (isStrike) {
    const absorbed = Math.min(target.junk, incomingDamage);
    target.junk -= absorbed;
    return incomingDamage - absorbed;
  }
  const junkEffective = target.junk * 2;
  const absorbed = Math.min(junkEffective, incomingDamage);
  const junkSpent = Math.ceil(absorbed / 2);
  target.junk = Math.max(0, target.junk - junkSpent);
  return incomingDamage - absorbed;
}

/** Non-Strike damage: block/bulk mitigation; does not consume strike defenses. */
export function dealDirectHpDamage(
  rawDamage: number,
  pierce: boolean,
  frame: RunnerDamageFrame,
  dispatchDamageAura: boolean,
): void {
  const { actor, target, state, ctx } = frame;
  if (rawDamage <= 0) {
    return;
  }
  let damage = applyOutgoingWeaken(rawDamage, actor);
  damage = applyEmergencyJunkShieldPreMitigation(target, damage, false);
  if (damage <= 0) {
    return;
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
  applyHpLossWithEmergencyProtocol(target, hpLoss, state.roundIndex, ctx.pushEv);
  if (dispatchDamageAura && damage > 0) {
    ctx.dispatchAuraTrigger(state, target, actor, 'OnDamageTaken');
  }
}

export function maybeMirrorCoreSelfDamageLoss(loss: number, frame: RunnerDamageFrame): void {
  if (loss <= 0) {
    return;
  }
  const { actor, ctx } = frame;
  if (!actor.mirrorCoreSelfDamage) {
    return;
  }
  const card = ctx.resolvingCard;
  if (!card || !card.keywords.some((k) => k.type === 'FactoryReset')) {
    return;
  }
  dealDirectHpDamage(loss, false, frame, true);
}

