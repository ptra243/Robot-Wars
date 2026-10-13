import type { CardContentService } from '../../content';
import { SeededRandom } from '../../content';
import { COMBAT_RULES } from '../../rules';
import type { RunState } from '../../types';
import { materializeQueueBlankSlots, deckWithBasicsIfEmpty } from '../combatSetup';
import { pickMaxWeight, sampleThreeFromPool } from '../draftKernel';
import {
  type OpponentBand,
  type OpponentTheme,
  getPoolSlice,
  OPPONENT_BOSS_RELIC_POOL,
  OPPONENT_ELITE_RELIC_POOL,
  rollOpponentTheme,
  unionPoolIds,
} from '../opponentDecks';
import {
  buildWeightTable,
  cardBaseId,
  combinedDraftWeight,
  isLegalEnemyCard,
} from '../opponentCardWeights';
import { DRAFT_ROUNDS_BASE } from './enemyRollConfig';
import { activeQueueSlotsForAct, bandFromNode, extraDraftRoundsX } from './enemyRollMath';
import {
  allPrimaryBasesRepresented,
  applyMinPrimary,
  mergeAfterDraft,
  minPrimaryTarget,
  primaryBasesForSlice,
} from './enemyRollDraft';
import {
  classifyOpponentPhase,
  type A3SlotBandLayout,
  orderOpponentProgramActSlotBands,
  orderOpponentProgramThreeBands,
  preferredA3LayoutForTheme,
  sortFullMergedByHeuristic,
} from './enemyRollOrdering';
import { ensureHpDamageInProgram, ensureOpponentBatteryInProgram } from './enemyRollProgramGuards';

function fatigueFromQueueIds(queue: Array<string | null>): string[] {
  return queue.filter((id): id is string => Boolean(id));
}

export { activeQueueSlotsForAct, extraDraftRoundsX } from './enemyRollMath';
export { cardCanDealEnemyHpDamage } from './enemyRollDamage';
export {
  allPrimaryBasesRepresented,
  applyMinPrimary,
  mergeAfterDraft,
  minPrimaryTarget,
  primaryBasesForSlice,
} from './enemyRollDraft';

/** Pin payoff-tagged cards into the last K slots (boss). */
export function orderBossProgram(
  queue: string[],
  activeSlots: number,
  _theme: OpponentTheme,
  _band: OpponentBand,
  _aw: 0 | 1,
  payoff: Set<string>,
): string[] {
  if (activeSlots < 2 || payoff.size === 0) {
    return queue;
  }
  const head = queue.slice(0, activeSlots);
  const inPay = head.filter((id) => payoff.has(id));
  const notPay = head.filter((id) => !payoff.has(id));
  if (inPay.length === 0) {
    return head;
  }
  const k = Math.min(inPay.length, Math.max(1, Math.min(2, Math.ceil(activeSlots * 0.2))));
  const tail = inPay.slice(-k);
  const payRest = inPay.slice(0, inPay.length - k);
  const mid = [...notPay, ...payRest];
  return [...mid.slice(0, activeSlots - k), ...tail].slice(0, activeSlots);
}

export {
  A3_LAYOUT_BY_THEME,
  classifyOpponentPhase,
  orderOpponentProgramActSlotBands,
  orderOpponentProgramByHeuristic,
  orderOpponentProgramThreeBands,
  preferredA3LayoutForTheme,
  sortFullMergedByHeuristic,
  slotBandMembershipPerIndex,
} from './enemyRollOrdering';
export type { A3SlotBandLayout } from './enemyRollOrdering';

/** Placeholder: energy feasibility pass; identity until combat sim is wired. */
export function energyPassProvisionalQueue(
  q: string[],
  _content: CardContentService,
  _activeSlots: number,
): string[] {
  return q;
}
export { ensureHpDamageInProgram, ensureOpponentBatteryInProgram } from './enemyRollProgramGuards';

export interface EnemyRollInput {
  act: number;
  stepsInAct: number;
  act4BattleIndex: number;
  encounterIndex: number;
  nodeType: 'battle' | 'elite' | 'boss';
  /** Player awakening on the run. */
  enemyAwakening: 0 | 1;
  activeQueueSlots: number;
  /** First battles use all basics. */
  basicsBattleRemaining: number;
  faction: string;
  runSeed: number;
  /** Optional: fix theme. */
  themeOverride?: OpponentTheme;
  basicsGate: boolean;
  /** Tests / lab: override computed `5 + X` draft rounds. */
  draftRoundOverride?: number;
  /**
   * Final program order after merge + battery + HP pass.
   * - `actSlotBands` (default): overlapping act-based slot windows + permutation search.
   * - `threeBandConcat`: legacy [early][middle][late] concat.
   */
  programOrderMode?: 'actSlotBands' | 'threeBandConcat';
  /** When using act slot bands and act ≥ 3. Ignored for act 1–2. Default `wide`. */
  a3SlotBandLayout?: A3SlotBandLayout;
}

export interface EnemyRollResult {
  /** Materialized 9-wide queue (blank slots = basic). */
  queue: string[];
  /** First `activeQueueSlots` entries are the program; may be shorter before pad. */
  filledQueue: string[];
  fatigueDeck: string[];
  notUsedInProgram: string[];
  theme: OpponentTheme;
  rollTrace: {
    draftRounds: number;
    perRound: Array<{ offers: string[]; pick: string }>;
    earlyBasics: boolean;
    /** Replaced a oust or low-cost play with a 0-cost battery when the line had spend and no net-charge. */
    batteryFix?: { at: number; with: string; replaced: string };
  };
  opponentRelicId: string | null;
}

export function rollEnemyLoadout(
  input: EnemyRollInput,
  content: CardContentService,
  rng: Pick<SeededRandom, 'next' | 'nextInt'>,
): EnemyRollResult {
  const node = input.nodeType;
  const band = bandFromNode(node);
  const aw = (input.enemyAwakening > 0 ? 1 : 0) as 0 | 1;
  const theme = input.themeOverride ?? rollOpponentTheme(rng);
  const slice = getPoolSlice(theme, band, aw);
  const pool = unionPoolIds(slice).filter((id) => isLegalEnemyCard(id, input.faction, aw, content));
  if (input.basicsGate && node === 'battle' && input.basicsBattleRemaining > 0) {
    const basic = COMBAT_RULES.blankQueueSlotCardId;
    const filled = Array.from({ length: input.activeQueueSlots }, () => basic);
    return {
      queue: filled,
      filledQueue: filled,
      fatigueDeck: deckWithBasicsIfEmpty(fatigueFromQueueIds(filled.map((x) => x as string | null))),
      notUsedInProgram: pool.filter((id) => id !== basic).slice(0, 20),
      theme,
      rollTrace: { draftRounds: 0, perRound: [], earlyBasics: true },
      opponentRelicId: null,
    };
  }
  const table = buildWeightTable(theme, band, aw, slice, content, input.faction, aw);
  const poolIds = pool.filter((id) => (table.get(id) ?? 0) > 0);
  if (poolIds.length === 0) {
    const basic = COMBAT_RULES.blankQueueSlotCardId;
    const filled = Array.from({ length: input.activeQueueSlots }, () => basic);
    return {
      queue: filled,
      filledQueue: filled,
      fatigueDeck: deckWithBasicsIfEmpty([...filled]),
      notUsedInProgram: [],
      theme,
      rollTrace: { draftRounds: 0, perRound: [], earlyBasics: false },
      opponentRelicId: null,
    };
  }
  const w = (id: string) => table.get(id) ?? 0;
  const x = extraDraftRoundsX(input.act, input.stepsInAct, input.act4BattleIndex, node);
  const draftRounds =
    input.draftRoundOverride !== undefined ? input.draftRoundOverride : DRAFT_ROUNDS_BASE + x;
  const payoffSetDraft = new Set(slice.payoffIds ?? []);
  const roleDraft = slice.cardRoleById;
  const perRound: Array<{ offers: string[]; pick: string }> = [];
  const picks: string[] = [];
  for (let r = 0; r < draftRounds; r += 1) {
    const offers = sampleThreeFromPool(poolIds, w, rng);
    if (offers.length === 0) {
      break;
    }
    const breadthDone =
      allPrimaryBasesRepresented(slice, picks) ||
      picks.length >= Math.ceil(Math.max(1, draftRounds) * 0.55);
    let earlyN = 0;
    let midN = 0;
    let lateN = 0;
    for (const p of picks) {
      const ph = classifyOpponentPhase(p, content, payoffSetDraft, roleDraft);
      if (ph === 'early') earlyN += 1;
      else if (ph === 'late') lateN += 1;
      else midN += 1;
    }
    const pickW = (id: string) => {
      let wt = combinedDraftWeight(id, theme, band, aw, slice, content, input.faction);
      const base = cardBaseId(id);
      const need = primaryBasesForSlice(slice);
      const cnt = picks.filter((p) => cardBaseId(p) === base).length;
      const isPrimaryFamily = need.has(base);
      if (!breadthDone && cnt >= 1 && isPrimaryFamily) {
        wt *= 0.12;
      } else if (breadthDone && isPrimaryFamily && cnt >= 3) {
        wt = 0;
      } else if (cnt >= 4) {
        wt *= 0.05;
      }
      const ph = classifyOpponentPhase(id, content, payoffSetDraft, roleDraft);
      if (earlyN < 1 && ph === 'early') wt *= 1.35;
      if (lateN < 1 && ph === 'late') wt *= 1.28;
      if (midN < 2 && ph === 'middle') wt *= 1.18;
      return wt;
    };
    const pick = pickMaxWeight(offers, pickW, rng);
    picks.push(pick);
    perRound.push({ offers, pick });
  }
  let merged = mergeAfterDraft(picks, content);
  merged = energyPassProvisionalQueue(merged, content, input.activeQueueSlots);
  const minP = minPrimaryTarget(input.activeQueueSlots, input.act, node);
  merged = applyMinPrimary(merged, minP, slice, content, input.faction, aw, rng);
  merged = sortFullMergedByHeuristic(merged, content, payoffSetDraft, slice.cardRoleById);
  let programHead = merged.slice(0, input.activeQueueSlots);
  programHead = orderOpponentProgramThreeBands(
    programHead,
    content,
    payoffSetDraft,
    slice.cardRoleById,
  );
  const payoffSet = payoffSetDraft;
  if (node === 'boss' && payoffSet.size > 0) {
    programHead = orderBossProgram(
      programHead,
      input.activeQueueSlots,
      theme,
      'boss',
      aw,
      payoffSet,
    );
  }
  let mergedOrdered = [...programHead, ...merged.slice(input.activeQueueSlots)];
  let final = mergedOrdered.slice(0, input.activeQueueSlots);
  if (final.length < input.activeQueueSlots) {
    const dud = slice.dud[0] ?? COMBAT_RULES.blankQueueSlotCardId;
    while (final.length < input.activeQueueSlots) {
      final.push(
        isLegalEnemyCard(dud, input.faction, aw, content) ? dud : COMBAT_RULES.blankQueueSlotCardId,
      );
    }
  } else if (final.length > input.activeQueueSlots) {
    final = final.slice(0, input.activeQueueSlots);
  }
  const fixedEnergy = ensureOpponentBatteryInProgram(
    final,
    slice,
    pool,
    content,
    input.faction,
    aw,
    rng,
  );
  final = fixedEnergy.next;
  final = ensureHpDamageInProgram(final, slice, pool, content, input.faction, aw, rng);
  const orderMode = input.programOrderMode ?? 'actSlotBands';
  const a3Layout = input.a3SlotBandLayout ?? preferredA3LayoutForTheme(theme);
  if (orderMode === 'threeBandConcat') {
    final = orderOpponentProgramThreeBands(final, content, payoffSet, slice.cardRoleById);
  } else {
    final = orderOpponentProgramActSlotBands(
      final,
      input.act,
      input.activeQueueSlots,
      content,
      payoffSet,
      slice.cardRoleById ?? {},
      node,
      a3Layout,
    );
  }
  const fullQueue = Array.from({ length: COMBAT_RULES.queueSize }, (_, i) => (i < final.length ? final[i]! : null));
  const notUsed = poolIds.filter((id) => !final.includes(id) && !picks.includes(id));
  const fullDraftDeck = [...mergedOrdered];
  for (let i = 0; i < final.length; i += 1) {
    fullDraftDeck[i] = final[i]!;
  }
  const fatigue = fullDraftDeck.filter((id): id is string => Boolean(id));
  const relicPool = node === 'boss' ? OPPONENT_BOSS_RELIC_POOL : OPPONENT_ELITE_RELIC_POOL;
  const opponentRelicId =
    (node === 'elite' || node === 'boss') && relicPool.length > 0
      ? relicPool[rng.nextInt(relicPool.length)]!
      : null;
  const queue = materializeQueueBlankSlots(
    fullQueue as Array<string | null>,
    COMBAT_RULES.queueSize,
    input.activeQueueSlots,
  ).map((id) => id ?? COMBAT_RULES.blankQueueSlotCardId);
  return {
    queue,
    filledQueue: final,
    fatigueDeck: fatigue.length > 0 ? fatigue : deckWithBasicsIfEmpty(fatigue),
    notUsedInProgram: notUsed,
    theme,
    rollTrace: {
      draftRounds,
      perRound,
      earlyBasics: false,
      ...(fixedEnergy.injected
        ? {
            batteryFix: {
              at: fixedEnergy.injected.at,
              with: fixedEnergy.injected.with,
              replaced: fixedEnergy.injected.replaced,
            },
          }
        : {}),
    },
    opponentRelicId,
  };
}

/** Derives RNG from run + encounter. */
export function makeEnemyRng(run: RunState): SeededRandom {
  const t = run.loop.pendingEncounterType ?? 'battle';
  return new SeededRandom(
    (run.seed + 901 + run.encounterIndex * 97 + run.loop.act * 1709 + t.length * 13) >>> 0,
  );
}

/**
 * Fills `run.enemyPlannedQueue` and `run.combatEnemyFatigueDeck` for the next fight.
 * If this encounter was already prepared (e.g. Travel node selection pre-roll), reuse the cached build.
 */
export function prepareEnemyForCombat(run: RunState, content: CardContentService): void {
  const pending = run.loop.pendingEncounterType;
  if (pending !== 'battle' && pending !== 'elite' && pending !== 'boss') {
    return;
  }
  const ac = activeQueueSlotsForAct(run.loop.act);
  run.sandboxActiveQueueSlots = ac;
  if ((run.combatEnemyFatigueDeck?.length ?? 0) > 0) {
    return;
  }
  const themeOverride = undefined;
  const rng = makeEnemyRng(run);
  const aw = (run.loop.awakening > 0 ? 1 : 0) as 0 | 1;
  const basicsBattleRemaining = run.loop.earlyBattleBasicsRemaining;
  const basicsGate = pending === 'battle' && basicsBattleRemaining > 0;
  const r = rollEnemyLoadout(
    {
      act: run.loop.act,
      stepsInAct: run.loop.stepsInAct,
      act4BattleIndex: run.loop.act4BattleIndex,
      encounterIndex: run.encounterIndex,
      nodeType: pending,
      enemyAwakening: aw,
      activeQueueSlots: ac,
      basicsBattleRemaining,
      faction: run.faction,
      runSeed: run.seed,
      themeOverride,
      basicsGate,
    },
    content,
    rng,
  );
  for (let i = 0; i < COMBAT_RULES.queueSize; i += 1) {
    run.enemyPlannedQueue[i] = i < r.filledQueue.length ? r.filledQueue[i]! : null;
  }
  if (r.rollTrace.earlyBasics) {
    run.loop.earlyBattleBasicsRemaining = Math.max(0, run.loop.earlyBattleBasicsRemaining - 1);
  }
  run.combatEnemyFatigueDeck = r.fatigueDeck;
  run.sandboxActiveQueueSlots = ac;
  run.combatOpponentRelicId = r.opponentRelicId;
}
