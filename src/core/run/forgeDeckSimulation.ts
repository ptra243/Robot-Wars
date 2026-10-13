import { CombatSimulator } from '../combat';
import type { CardContentService } from '../content';
import { COMBAT_RULES } from '../rules';
import { callTraitOnCombatStart } from '../traits';
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
  /** Player Continuous aura ticks this round. */
  continuousTicks: number;
  /** Player queue skips caused by already-armed Continuous this round. */
  continuousSkips: number;
  /**
   * Card id at the player’s program cursor for their first queue action this round
   * (resolve / stall / whiff / skip), for forge chart hover.
   */
  programCardId: string | null;
  /** Multiple cards resolved from the same round start (e.g. Overclock bonus). */
  programCardIds: string[];
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
  // Continuous cards should not appear as the round's highlighted program card.
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
): { first: (string | null)[]; all: string[][] } {
  const byRound: (string | null)[] = Array.from({ length: roundCount }, () => null);
  const byRoundAll: string[][] = Array.from({ length: roundCount }, () => []);
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
    const id = programCardIdFromPlayerSnapshot(ev);
    if (!id) continue;
    if (byRound[idx] == null) byRound[idx] = id;
    const arr = byRoundAll[idx]!;
    if (arr.length < 2 && arr[arr.length - 1] !== id) arr.push(id);
  }
  return { first: byRound, all: byRoundAll };
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
    continuousTicks: 0,
    continuousSkips: 0,
    programCardId: programIds.first[i] ?? null,
    programCardIds: programIds.all[i] ?? [],
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

    if (ev.type === 'continuous_tick' && ev.actor === 'Player') {
      rounds[idx]!.continuousTicks += 1;
    }

    if (ev.type === 'continuous_skip' && ev.actor === 'Player') {
      rounds[idx]!.continuousSkips += 1;
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
  playerTraitIds: string[] = [],
  /** Program width for the player (and dummy enemy) — must match combat’s active queue slots. */
  activeQueueSlots: number = COMBAT_RULES.queueSize,
): ForgeDeckSimulationResult {
  const enemyDeck = Array.from({ length: COMBAT_RULES.queueSize }, () => 'neutral_basic_strike_t1');
  const setup = createCombatSetupFromDecklists({
    seed: forgeSeed,
    playerDeck: playerDeckCardIds,
    enemyDeck,
    playerQueue: queueIds,
    enemyQueue: enemyDeck,
    activeQueueSlots,
  });
  setup.player.traitIds = [...playerTraitIds];
  if (setup.player.traitIds.includes('rust_ranger_base')) {
    setup.player.junkCapacity = 5;
  }
  callTraitOnCombatStart(setup.player, content);
  setup.player.hp = 9999;
  setup.player.maxHp = 9999;
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
