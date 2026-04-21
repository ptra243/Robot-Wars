import { COMBAT_RULES } from '../rules';
import type {
  ArenaSnapshot,
  CombatEvent,
  CombatEventSnapshot,
  CombatFighterSnapshot,
  CombatResult,
  FighterState,
  RunState,
} from '../types';
import { createPreviewFighter, deckWithBasicsIfEmpty } from './combatSetup';

export function mergeFighterVitals(base: FighterState, snap: CombatFighterSnapshot): FighterState {
  return {
    ...base,
    hp: snap.hp,
    block: snap.block,
    charge: snap.charge,
    junk: snap.junk,
    bulkStacks: snap.bulkStacks,
    coreScrap: snap.coreScrap,
    potency: snap.potency,
    exposeDamage: snap.exposeDamage,
  };
}

function padQueueToSize(queue: Array<string | null>, size: number): Array<string | null> {
  const out = [...queue];
  while (out.length < size) {
    out.push(null);
  }
  return out.slice(0, size);
}

export function buildEncounterSnapshot(run: RunState, result?: CombatResult): ArenaSnapshot {
  if (result) {
    return {
      roundIndex: result.finalState.roundIndex,
      player: result.finalState.player,
      enemy: result.finalState.enemy,
      recentEvents: result.events.slice(-6),
      result,
      fatigueArmed: result.finalState.fatigueArmed,
      fatigueRoundsElapsed: result.finalState.fatigueRoundsElapsed,
    };
  }

  return {
    roundIndex: 0,
    fatigueArmed: false,
    fatigueRoundsElapsed: 0,
    player: createPreviewFighter(
      'Player',
      deckWithBasicsIfEmpty(run.deck),
      run.plannedQueue,
      run.sandboxPlayerCoreScrap,
      run.sandboxActiveQueueSlots,
    ),
    enemy: createPreviewFighter(
      'Enemy',
      [],
      run.enemyPlannedQueue,
      run.sandboxEnemyCoreScrap,
      run.sandboxActiveQueueSlots,
    ),
    recentEvents: [],
  };
}

export function buildArenaFromReplaySlice(
  result: CombatResult,
  snap: CombatEventSnapshot,
  visibleEvents: CombatEvent[],
): ArenaSnapshot {
  const playerMerged = mergeFighterVitals(result.finalState.player, snap.player);
  const enemyMerged = mergeFighterVitals(result.finalState.enemy, snap.enemy);
  const playerQueue = snap.playerQueue ?? result.finalState.player.queue;
  const enemyQueue = snap.enemyQueue ?? result.finalState.enemy.queue;

  return {
    roundIndex: snap.roundIndex,
    player: {
      ...playerMerged,
      queue: padQueueToSize(playerQueue, COMBAT_RULES.queueSize),
      queueCursor: snap.playerQueueCursor ?? result.finalState.player.queueCursor,
    },
    enemy: {
      ...enemyMerged,
      queue: padQueueToSize(enemyQueue, COMBAT_RULES.queueSize),
      queueCursor: snap.enemyQueueCursor ?? result.finalState.enemy.queueCursor,
    },
    recentEvents: visibleEvents.slice(-6),
    result,
    fatigueArmed: snap.fatigueArmed ?? result.finalState.fatigueArmed,
    fatigueRoundsElapsed: snap.fatigueRoundsElapsed ?? result.finalState.fatigueRoundsElapsed,
  };
}
