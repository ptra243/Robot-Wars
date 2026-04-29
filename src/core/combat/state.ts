import type {
  CombatEvent,
  CombatEventSnapshot,
  CombatFighterSnapshot,
  CombatState,
  FighterState,
} from '../types';
import { COMBAT_RULES } from '../rules';

export function ensureQueue(fighter: FighterState): void {
  while (fighter.queue.length < COMBAT_RULES.queueSize) {
    fighter.queue.push(null);
  }
  const active = fighter.activeQueueSlots ?? COMBAT_RULES.queueSize;
  fighter.activeQueueSlots = Math.max(5, Math.min(COMBAT_RULES.queueSize, Math.floor(active)));
  fighter.queueCursor %= fighter.activeQueueSlots;
}

export function ensureAuraDefaults(fighter: FighterState): void {
  if (!fighter.auras) {
    fighter.auras = [];
  }
  syncExposeAuraFromField(fighter);
}

export function addStunnedTurns(actor: FighterState, turns: number): void {
  if (turns <= 0) {
    return;
  }
  const existing = actor.auras.find((a): a is { type: 'Stunned'; turnsLeft: number } => a.type === 'Stunned');
  if (existing) {
    existing.turnsLeft += turns;
    return;
  }
  actor.auras.push({ type: 'Stunned', turnsLeft: turns });
}

export function syncExposeAuraFromField(fighter: FighterState): void {
  const hasExposeAura = fighter.auras.some((a) => a.type === 'Expose');
  if (fighter.exposeDamage > 0) {
    fighter.auras = fighter.auras.filter((a) => a.type !== 'Expose');
    fighter.auras.push({ type: 'Expose', trigger: 'OnDamageTaken', damage: fighter.exposeDamage });
  } else if (hasExposeAura) {
    fighter.auras = fighter.auras.filter((a) => a.type !== 'Expose');
  }
}

export function cloneFighter(fighter: FighterState): FighterState {
  return {
    ...fighter,
    deck: [...fighter.deck],
    queue: [...fighter.queue],
    auras: [...(fighter.auras ?? [])],
    continuousTicksByQueueIndex: { ...fighter.continuousTicksByQueueIndex },
    continuousNextTickRoundByQueueIndex: {
      ...fighter.continuousNextTickRoundByQueueIndex,
    },
    traitIds: [...(fighter.traitIds ?? [])],
    tempUpgrade: fighter.tempUpgrade ? { ...fighter.tempUpgrade } : null,
    scheduledEffects: (fighter.scheduledEffects ?? []).map((entry) => ({
      fireAtRound: entry.fireAtRound,
      steps: [...entry.steps],
    })),
  };
}

export function pushEv(
  state: CombatState,
  events: CombatEvent[],
  event: Omit<CombatEvent, 'snapshot'>,
): void {
  events.push({ ...event, snapshot: buildSnapshot(state) });
}

export function buildSnapshot(state: CombatState): CombatEventSnapshot {
  return {
    roundIndex: state.roundIndex,
    player: fighterToSnapshot(state.player),
    enemy: fighterToSnapshot(state.enemy),
    playerQueueCursor: state.player.queueCursor,
    enemyQueueCursor: state.enemy.queueCursor,
    playerQueue: [...state.player.queue],
    enemyQueue: [...state.enemy.queue],
    playerActiveQueueSlots: state.player.activeQueueSlots,
    enemyActiveQueueSlots: state.enemy.activeQueueSlots,
    fatigueArmed: state.fatigueArmed,
    fatigueRoundsElapsed: state.fatigueRoundsElapsed,
  };
}

function fighterToSnapshot(fighter: FighterState): CombatFighterSnapshot {
  const stun = fighter.auras.find((a): a is { type: 'Stunned'; turnsLeft: number } => a.type === 'Stunned');
  return {
    hp: fighter.hp,
    block: fighter.block,
    charge: fighter.charge,
    shuriken: fighter.shuriken && fighter.shuriken > 0 ? fighter.shuriken : undefined,
    junk: fighter.junk,
    bulkStacks: fighter.bulkStacks,
    coreScrap: fighter.coreScrap,
    potency: fighter.potency,
    exposeDamage: fighter.exposeDamage,
    virusStacks: fighter.virusStacks && fighter.virusStacks > 0 ? fighter.virusStacks : undefined,
    weakenStacks: fighter.weakenStacks > 0 ? fighter.weakenStacks : undefined,
    deckWraps: fighter.deckWraps,
    stunnedTurnsLeft: stun && stun.turnsLeft > 0 ? stun.turnsLeft : undefined,
  };
}
