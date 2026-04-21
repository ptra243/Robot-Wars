import { CombatSimulator } from '../combat';
import type { CardContentService } from '../content';
import { COMBAT_RULES } from '../rules';
import type { CombatEvent } from '../types';
import { createCombatSetupFromDecklists } from './combatSetup';

/** Combat rounds simulated for the forge deck preview chart (player vs. dummy enemy). */
export const FORGE_DECK_SIM_ROUNDS = 20;

export interface ForgeDeckRoundMetrics {
  /** 1-based combat round index. */
  round: number;
  /** Player charge (energy) at round start (after shield decay + junk drip). */
  energy: number;
  /** Player shield block at round start. */
  shields: number;
  /** Player junk at round start. */
  junk: number;
  /** Strike damage dealt by the player this round (sum of resolve lines). */
  damage: number;
  /** Player stall events this round. */
  stalls: number;
  /**
   * Card id at the player’s program cursor for their first queue action this round
   * (resolve / stall / whiff / skip), for forge chart hover.
   */
  programCardId: string | null;
}

/** Player vitals at combat start (before round 1), for cumulative chart mode. */
export interface ForgeDeckSimulationPlayerBaseline {
  energy: number;
  shields: number;
  junk: number;
}

export interface ForgeDeckSimulationResult {
  rounds: ForgeDeckRoundMetrics[];
  initialPlayer: ForgeDeckSimulationPlayerBaseline;
}

const DEALT_RE = /dealt=(\d+)/;

/** Player turn event types where `snapshot.playerQueue[playerQueueCursor]` is the active program card. */
const PLAYER_PROGRAM_EVENTS = new Set([
  'resolve',
  'stall',
  'stall_skip',
  'whiff',
  'continuous_skip',
]);

function programCardIdFromPlayerSnapshot(ev: CombatEvent): string | null {
  const snap = ev.snapshot;
  if (!snap?.playerQueue || snap.playerQueueCursor === undefined) {
    return null;
  }
  const id = snap.playerQueue[snap.playerQueueCursor];
  if (id == null || id === '') {
    return null;
  }
  return id;
}

/**
 * First program card id the player acts on each round (for chart hover), from combat snapshots.
 */
export function aggregateProgramCardIdPerRound(
  events: CombatEvent[],
  roundCount: number,
): (string | null)[] {
  const byRound: (string | null)[] = Array.from({ length: roundCount }, () => null);
  for (const ev of events) {
    if (ev.actor !== 'Player') {
      continue;
    }
    if (!PLAYER_PROGRAM_EVENTS.has(ev.type)) {
      continue;
    }
    const r = ev.round;
    if (r < 1 || r > roundCount) {
      continue;
    }
    const idx = r - 1;
    if (byRound[idx] !== null) {
      continue;
    }
    byRound[idx] = programCardIdFromPlayerSnapshot(ev);
  }
  return byRound;
}

/**
 * Buckets combat log events into per-round metrics for the forge preview chart.
 */
export function aggregateForgeDeckMetricsFromEvents(
  events: CombatEvent[],
  roundCount: number,
): ForgeDeckRoundMetrics[] {
  const programIds = aggregateProgramCardIdPerRound(events, roundCount);
  const rounds: ForgeDeckRoundMetrics[] = Array.from({ length: roundCount }, (_, i) => ({
    round: i + 1,
    energy: 0,
    shields: 0,
    junk: 0,
    damage: 0,
    stalls: 0,
    programCardId: programIds[i] ?? null,
  }));

  for (const ev of events) {
    const r = ev.round;
    if (r < 1 || r > roundCount) {
      continue;
    }
    const idx = r - 1;

    if (ev.type === 'round_start' && ev.snapshot?.player) {
      const p = ev.snapshot.player;
      const row = rounds[idx]!;
      row.energy = p.charge;
      row.shields = p.block;
      row.junk = p.junk;
    }

    if (ev.type === 'stall' && ev.actor === 'Player') {
      rounds[idx]!.stalls += 1;
    }

    if (ev.type === 'resolve' && ev.actor === 'Player') {
      const m = DEALT_RE.exec(ev.text);
      const dealt = m ? Number(m[1]) : 0;
      rounds[idx]!.damage += dealt;
    }
  }

  return rounds;
}

/**
 * Runs a headless combat for the current forge queue + hand against a dummy basic-strike enemy,
 * capped at {@link FORGE_DECK_SIM_ROUNDS}. HP is raised so the fight lasts the full window.
 */
export function simulateForgeDeckMetrics(
  content: CardContentService,
  forgeSeed: number,
  queueIds: Array<string | null>,
  playerDeckCardIds: string[],
): ForgeDeckSimulationResult {
  const enemyDeck = Array.from({ length: COMBAT_RULES.queueSize }, () => 'neutral_basic_strike_t1');
  const setup = createCombatSetupFromDecklists({
    seed: forgeSeed,
    playerDeck: playerDeckCardIds,
    enemyDeck,
    playerQueue: queueIds,
    enemyQueue: enemyDeck,
  });
  setup.player.hp = 9999;
  setup.enemy.hp = 9999;
  setup.player.block = 0;
  setup.enemy.block = 0;

  const simulator = new CombatSimulator(content, forgeSeed);
  const result = simulator.run(setup, { stopAfterRounds: FORGE_DECK_SIM_ROUNDS });
  const p0 = result.initialSnapshot.player;
  return {
    rounds: aggregateForgeDeckMetricsFromEvents(result.events, FORGE_DECK_SIM_ROUNDS),
    initialPlayer: {
      energy: p0.charge,
      shields: p0.block,
      junk: p0.junk,
    },
  };
}
