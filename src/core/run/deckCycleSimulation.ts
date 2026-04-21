import { CardContentService } from '../content';
import { CombatSimulator } from '../combat';
import { COMBAT_RULES } from '../rules';
import type { CombatEvent, CombatEventSnapshot, RunState } from '../types';
import { createCombatSetupFromDecklists, padQueueFromDeckList } from './combatSetup';
import { replaceEmptyDeckWithBasicStrikes } from './lifecycle';

/** Simulate until the player deck has wrapped this many times (full passes through the fatigue deck). */
export const DECK_CYCLE_DECK_PASSES = 3;

/** @deprecated Use {@link DECK_CYCLE_DECK_PASSES} */
export const DECK_CYCLE_SIM_ROUNDS = DECK_CYCLE_DECK_PASSES;

export interface DeckCycleRoundSummary {
  /** Which full deck pass (1st, 2nd, or 3rd time through the pile). */
  passIndex: number;
  /** Combat rounds that started while this deck-pass bucket was active (from `round_start` snapshots). */
  combatRoundsSpanned: number;
  /** Net change in energy (charge) across your card resolutions this round. */
  energyNet: number;
  /** Net junk change across your resolutions this round. */
  junkNet: number;
  /** Net refined scrap change across your resolutions this round. */
  coreNet: number;
  /** Sum of charge decreases per resolution (ignores gains on the same card); approximates energy paid to play. */
  energySpent: number;
  /** Junk decreases only (approx. spent before regains on the same card). */
  junkSpent: number;
  /** Core decreases only. */
  coreSpent: number;
  damageDealt: number;
  healingDone: number;
  shieldGained: number;
  stalls: number;
  buffsGenerated: Array<{ name: string; amount: number }>;
}

export interface DeckCycleReport {
  /** Combat rounds completed before the sim stopped. */
  roundsSimulated: number;
  /** Player deck wraps at end of sim (see {@link DECK_CYCLE_DECK_PASSES}). */
  playerDeckCycles: number;
  /** Total Strike damage to the enemy ÷ {@link roundsSimulated}. Stalls still advance rounds, so low values flag slow / stalled cycles. */
  damagePerCombatRound: number;
  /** Player stall events ÷ {@link roundsSimulated}. */
  stallsPerCombatRound: number;
  damageDealt: number;
  healingDone: number;
  shieldGained: number;
  stalls: number;
  buffsGenerated: Array<{ name: string; amount: number }>;
  roundSummaries: DeckCycleRoundSummary[];
  queueSource: 'planned' | 'deck_order';
  plannedSlotsFilled: number;
  activeQueueSlots: number;
  simulatedQueueSlotLabels: string[];
}

function labelsForSimulatedQueue(
  queue: Array<string | null>,
  cardContent: CardContentService,
): string[] {
  return Array.from({ length: COMBAT_RULES.queueSize }, (_, index) => {
    const id = queue[index];
    if (id == null || id === '') {
      return 'Basic Strike';
    }
    return cardContent.get(id).name;
  });
}

function prevPlayerDeckWraps(snapshot: CombatEventSnapshot | undefined): number {
  return snapshot?.player.deckWraps ?? 0;
}

/** Bucket 0 = first full pass through the deck; 1 = second; 2 = third (from wrap count before the action). */
function passBucketFromPrevWraps(prevWraps: number): number {
  return Math.min(DECK_CYCLE_DECK_PASSES - 1, Math.max(0, prevWraps));
}

function emptyRoundSummaries(): DeckCycleRoundSummary[] {
  return Array.from({ length: DECK_CYCLE_DECK_PASSES }, (_, i) => ({
    passIndex: i + 1,
    combatRoundsSpanned: 0,
    energyNet: 0,
    junkNet: 0,
    coreNet: 0,
    energySpent: 0,
    junkSpent: 0,
    coreSpent: 0,
    damageDealt: 0,
    healingDone: 0,
    shieldGained: 0,
    stalls: 0,
    buffsGenerated: [] as Array<{ name: string; amount: number }>,
  }));
}

function mapToSortedBuffs(m: Map<string, number>): Array<{ name: string; amount: number }> {
  return [...m.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((x, y) => y.amount - x.amount || x.name.localeCompare(y.name));
}

/** Count `round_start` events per deck-pass bucket (wrap count at round start → pass index). */
function countCombatRoundsPerPassBucket(events: CombatEvent[]): number[] {
  const counts = Array.from({ length: DECK_CYCLE_DECK_PASSES }, () => 0);
  for (const ev of events) {
    if (ev.type !== 'round_start') {
      continue;
    }
    const w = ev.snapshot?.player.deckWraps ?? 0;
    const br = passBucketFromPrevWraps(w);
    if (br >= 0 && br < DECK_CYCLE_DECK_PASSES) {
      counts[br] += 1;
    }
  }
  return counts;
}

export function simulateDeckCycleReport(run: RunState, content: CardContentService): DeckCycleReport {
  replaceEmptyDeckWithBasicStrikes(run);
  const plannedSlotsFilled = run.plannedQueue.filter((id) => id != null && id !== '').length;
  const queueSource: DeckCycleReport['queueSource'] =
    plannedSlotsFilled > 0 ? 'planned' : 'deck_order';
  const cycleQueue =
    queueSource === 'planned' ? [...run.plannedQueue] : padQueueFromDeckList(run.deck);
  const simulatedQueueSlotLabels = labelsForSimulatedQueue(cycleQueue, content);

  const setup = createCombatSetupFromDecklists({
    seed: run.seed + run.encounterIndex,
    playerDeck: [...run.deck],
    enemyDeck: ['neutral_basic_strike_t1'],
    playerQueue: cycleQueue,
    enemyQueue: padQueueFromDeckList(['neutral_basic_strike_t1']),
    playerCoreScrap: run.sandboxPlayerCoreScrap,
    enemyCoreScrap: 0,
    activeQueueSlots: run.sandboxActiveQueueSlots,
  });
  setup.player.hp = 9999;
  setup.enemy.hp = 9999;
  setup.player.block = 0;
  setup.enemy.block = 0;

  const simulator = new CombatSimulator(content, setup.seed);
  const result = simulator.run(setup, { stopWhenPlayerDeckWrapsAtLeast: DECK_CYCLE_DECK_PASSES });

  const roundSummaries = emptyRoundSummaries();
  const roundBuffs = Array.from({ length: DECK_CYCLE_DECK_PASSES }, () => new Map<string, number>());

  let damageDealt = 0;
  let healingDone = 0;
  let shieldGained = 0;
  let stalls = 0;
  const buffTotals = new Map<string, number>();

  let prevPlayerHp = setup.player.hp;
  let prevPlayerBlock = setup.player.block;
  let prevPlayerPotency = setup.player.potency;
  let prevPlayerExpose = setup.player.exposeDamage;
  let prevPlayerBulk = setup.player.bulkStacks;
  let prevPlayerCharge = setup.player.charge;

  const addBuff = (br: number, name: string, amount: number): void => {
    if (amount <= 0) return;
    buffTotals.set(name, (buffTotals.get(name) ?? 0) + amount);
    if (br >= 0 && br < DECK_CYCLE_DECK_PASSES) {
      const m = roundBuffs[br]!;
      m.set(name, (m.get(name) ?? 0) + amount);
    }
  };

  for (let i = 0; i < result.events.length; i += 1) {
    const ev = result.events[i]!;
    const prevSnap = i > 0 ? result.events[i - 1]?.snapshot : undefined;
    const prevWraps = prevPlayerDeckWraps(prevSnap);
    const br = passBucketFromPrevWraps(prevWraps);

    if (ev.type === 'stall' && ev.actor === 'Player') {
      stalls += 1;
      roundSummaries[br]!.stalls += 1;
    }

    if (ev.type === 'resolve' && ev.actor === 'Player') {
      const dealtMatch = /dealt=(\d+)/.exec(ev.text);
      const dealt = dealtMatch ? Number(dealtMatch[1] ?? '0') : 0;
      damageDealt += dealt;
      roundSummaries[br]!.damageDealt += dealt;

      const snap = ev.snapshot?.player;
      if (!snap) {
        continue;
      }

      const heal = Math.max(0, snap.hp - prevPlayerHp);
      const shield = Math.max(0, snap.block - prevPlayerBlock);
      healingDone += heal;
      shieldGained += shield;
      roundSummaries[br]!.healingDone += heal;
      roundSummaries[br]!.shieldGained += shield;

      addBuff(br, 'Energy gained', Math.max(0, snap.charge - prevPlayerCharge));
      addBuff(br, 'Bulk gained', Math.max(0, snap.bulkStacks - prevPlayerBulk));
      addBuff(br, 'Potency gained', Math.max(0, snap.potency - prevPlayerPotency));
      addBuff(br, 'Expose applied', Math.max(0, snap.exposeDamage - prevPlayerExpose));

      if (prevSnap) {
        const p0 = prevSnap.player;
        const p1 = snap;
        const rs = roundSummaries[br]!;
        rs.energyNet += p1.charge - p0.charge;
        rs.junkNet += p1.junk - p0.junk;
        rs.coreNet += p1.coreScrap - p0.coreScrap;
        rs.energySpent += Math.max(0, p0.charge - p1.charge);
        rs.junkSpent += Math.max(0, p0.junk - p1.junk);
        rs.coreSpent += Math.max(0, p0.coreScrap - p1.coreScrap);
      }

      prevPlayerHp = snap.hp;
      prevPlayerBlock = snap.block;
      prevPlayerPotency = snap.potency;
      prevPlayerExpose = snap.exposeDamage;
      prevPlayerBulk = snap.bulkStacks;
      prevPlayerCharge = snap.charge;
    }
  }

  for (let r = 0; r < DECK_CYCLE_DECK_PASSES; r += 1) {
    roundSummaries[r]!.buffsGenerated = mapToSortedBuffs(roundBuffs[r]!);
  }

  const roundsPerPass = countCombatRoundsPerPassBucket(result.events);
  for (let r = 0; r < DECK_CYCLE_DECK_PASSES; r += 1) {
    roundSummaries[r]!.combatRoundsSpanned = roundsPerPass[r] ?? 0;
  }

  const rounds = Math.max(1, result.rounds);

  return {
    roundsSimulated: result.rounds,
    playerDeckCycles: result.playerDeckCycles,
    damagePerCombatRound: damageDealt / rounds,
    stallsPerCombatRound: stalls / rounds,
    damageDealt,
    healingDone,
    shieldGained,
    stalls,
    buffsGenerated: mapToSortedBuffs(buffTotals),
    roundSummaries,
    queueSource,
    plannedSlotsFilled,
    activeQueueSlots: run.sandboxActiveQueueSlots,
    simulatedQueueSlotLabels,
  };
}
