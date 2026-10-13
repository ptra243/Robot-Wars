import type { CardContentService } from '../../content';
import { isFreeEnergyGeneratorInPool, type OpponentCardRole, type OpponentTheme } from '../opponentDecks';

type PhaseBand = 'early' | 'middle' | 'late';

function isFinisherCard(
  id: string,
  content: CardContentService,
  payoffIds: Set<string>,
  roleById?: Record<string, OpponentCardRole>,
): boolean {
  const c = content.get(id);
  const role = roleById?.[id];
  if (payoffIds.has(id) || role === 'payoff' || role === 'junkSpender') return true;
  if ((c.spend_junk ?? 0) > 0 && c.base_damage > 0) return true;
  if ((c.spend_core ?? 0) > 0 && c.base_damage > 0) return true;
  if ((c.charge_cost ?? 0) >= 2 && c.base_damage >= 6) return true;
  return false;
}

export function classifyOpponentPhase(
  id: string,
  content: CardContentService,
  payoffIds: Set<string>,
  roleById: Record<string, OpponentCardRole> | undefined,
): PhaseBand {
  const c = content.get(id);
  if (isFreeEnergyGeneratorInPool(c)) return 'early';
  if ((c.keywords ?? []).some((k) => k.type === 'Persistent')) return 'early';
  if (isFinisherCard(id, content, payoffIds, roleById)) return 'late';
  return 'middle';
}

function heuristicScoreForOrdering(
  id: string,
  index: number,
  content: CardContentService,
  payoffIds: Set<string>,
  roleById?: Record<string, OpponentCardRole>,
): number {
  const c = content.get(id);
  const cost = c.charge_cost ?? 0;
  const freeBattery = isFreeEnergyGeneratorInPool(c);
  const lowCostBattery = !freeBattery && (c.gain_charge ?? 0) > 0 && cost <= 1;
  const finisher = isFinisherCard(id, content, payoffIds, roleById);
  let score = 0;
  if (freeBattery) score -= 5;
  else if (lowCostBattery) score -= 2;
  if (finisher) score += 6;
  score += cost * 2;
  return score + index * 1e-6;
}

/** Sort the entire merged pick list so the head `activeSlots` captures the strongest sequencing candidates. */
export function sortFullMergedByHeuristic(
  merged: string[],
  content: CardContentService,
  payoffIds: Set<string>,
  roleById?: Record<string, OpponentCardRole>,
): string[] {
  const scored = merged.map((id, index) => ({
    id,
    score: heuristicScoreForOrdering(id, index, content, payoffIds, roleById),
  }));
  scored.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
  return scored.map((x) => x.id);
}

/** Order active program as [early][middle][late] buckets (three-band concat). */
export function orderOpponentProgramThreeBands(
  program: string[],
  content: CardContentService,
  payoffIds: Set<string>,
  roleById: Record<string, OpponentCardRole> | undefined,
): string[] {
  const early: string[] = [];
  const middle: string[] = [];
  const late: string[] = [];
  for (let i = 0; i < program.length; i += 1) {
    const id = program[i]!;
    const band = classifyOpponentPhase(id, content, payoffIds, roleById);
    if (band === 'early') early.push(id);
    else if (band === 'late') late.push(id);
    else middle.push(id);
  }
  const sortBand = (ids: string[]) =>
    [...ids]
      .map((id, i) => ({ id, i }))
      .sort(
        (a, b) =>
          heuristicScoreForOrdering(a.id, a.i, content, payoffIds, roleById) -
          heuristicScoreForOrdering(b.id, b.i, content, payoffIds, roleById),
      )
      .map((x) => x.id);
  return [...sortBand(early), ...sortBand(middle), ...sortBand(late)];
}

/** Act 3+ line layout for overlapping UI slot bands (see plan: wide vs dual-cycle). */
export type A3SlotBandLayout = 'wide' | 'dualCycle';

/**
 * Data-tuned defaults for act-3+ slot-band layout.
 * Balance tweaks: edit values here (or override per-call via `EnemyRollInput.a3SlotBandLayout`).
 */
export const A3_LAYOUT_BY_THEME: Partial<Record<OpponentTheme, A3SlotBandLayout>> = {
  expose: 'wide',
  gathering_strike: 'dualCycle',
  junk_crown: 'dualCycle',
  core_factory: 'wide',
  junk_aegis: 'wide',
};

export function preferredA3LayoutForTheme(theme: OpponentTheme): A3SlotBandLayout {
  return A3_LAYOUT_BY_THEME[theme] ?? 'wide';
}

/**
 * Overlapping act-based slot bands (UI slots 1..N → indices 0..N-1).
 */
export function slotBandMembershipPerIndex(
  act: number,
  activeSlots: number,
  layout: A3SlotBandLayout,
): Map<number, Set<PhaseBand>> {
  const m = new Map<number, Set<PhaseBand>>();
  const add = (idx: number, b: PhaseBand) => {
    if (idx < 0 || idx >= activeSlots) return;
    if (!m.has(idx)) m.set(idx, new Set());
    m.get(idx)!.add(b);
  };

  if (activeSlots <= 0) return m;
  const useDual = layout === 'dualCycle' && activeSlots >= 9 && act >= 3;

  if (useDual) {
    add(0, 'early');
    add(1, 'early');
    add(1, 'middle');
    add(2, 'middle');
    add(3, 'late');
    add(4, 'early');
    add(5, 'early');
    add(5, 'middle');
    add(6, 'middle');
    add(7, 'middle');
    add(8, 'late');
  } else if (act <= 1) {
    for (let i = 0; i <= Math.min(2, activeSlots - 1); i += 1) add(i, 'early');
    for (let i = 1; i <= Math.min(3, activeSlots - 1); i += 1) add(i, 'middle');
    for (let i = 3; i <= Math.min(4, activeSlots - 1); i += 1) add(i, 'late');
  } else if (act === 2) {
    for (let i = 0; i <= Math.min(2, activeSlots - 1); i += 1) add(i, 'early');
    for (let i = 2; i <= Math.min(4, activeSlots - 1); i += 1) add(i, 'middle');
    for (let i = 5; i <= Math.min(6, activeSlots - 1); i += 1) add(i, 'late');
  } else {
    for (let i = 0; i <= Math.min(3, activeSlots - 1); i += 1) add(i, 'early');
    for (let i = 2; i <= Math.min(5, activeSlots - 1); i += 1) add(i, 'middle');
    for (let i = 5; i <= activeSlots - 1; i += 1) add(i, 'late');
  }

  for (let i = 0; i < activeSlots; i += 1) {
    if (!m.has(i)) m.set(i, new Set<PhaseBand>(['middle']));
  }
  return m;
}

function bandMismatchCost(phase: PhaseBand, slotBands: Set<PhaseBand>): number {
  if (slotBands.has(phase)) return 0;
  if (
    (phase === 'early' && slotBands.has('middle')) ||
    (phase === 'late' && slotBands.has('middle')) ||
    (phase === 'middle' && (slotBands.has('early') || slotBands.has('late')))
  ) {
    return 2;
  }
  return 10;
}

function nextPermutationLex(a: number[]): boolean {
  let i = a.length - 2;
  while (i >= 0 && a[i]! >= a[i + 1]!) i -= 1;
  if (i < 0) return false;
  let j = a.length - 1;
  while (a[j]! <= a[i]!) j -= 1;
  [a[i], a[j]] = [a[j]!, a[i]!];
  for (let l = i + 1, r = a.length - 1; l < r; l += 1, r -= 1) [a[l], a[r]] = [a[r]!, a[l]!];
  return true;
}

function* indexPermutations(n: number): Generator<number[]> {
  if (n <= 0) {
    yield [];
    return;
  }
  const a = Array.from({ length: n }, (_, i) => i);
  while (true) {
    yield [...a];
    if (!nextPermutationLex(a)) break;
  }
}

function lexLessPerm(a: number[], b: number[] | null): boolean {
  if (b == null || b.length !== a.length) return true;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i]! < b[i]!;
  }
  return false;
}

function placementCostAtSlot(
  cardId: string,
  slotIndex: number,
  masks: Map<number, Set<PhaseBand>>,
  content: CardContentService,
  payoffIds: Set<string>,
  roleById: Record<string, OpponentCardRole> | undefined,
  nodeType: 'battle' | 'elite' | 'boss',
): number {
  const phase = classifyOpponentPhase(cardId, content, payoffIds, roleById);
  const slotBands = masks.get(slotIndex) ?? new Set<PhaseBand>(['middle']);
  let c = bandMismatchCost(phase, slotBands);
  c += heuristicScoreForOrdering(cardId, slotIndex, content, payoffIds, roleById) * 0.001;
  if (nodeType === 'boss' && payoffIds.has(cardId) && slotBands.has('late')) c -= 3;
  return c;
}

/** Permutes active program to minimize band mismatch + heuristic tie-break. */
export function orderOpponentProgramActSlotBands(
  program: string[],
  act: number,
  activeSlots: number,
  content: CardContentService,
  payoffIds: Set<string>,
  roleById: Record<string, OpponentCardRole> | undefined,
  nodeType: 'battle' | 'elite' | 'boss',
  a3Layout: A3SlotBandLayout,
): string[] {
  const n = Math.min(program.length, activeSlots);
  if (n <= 1) return program;
  if (n > 9) return orderOpponentProgramThreeBands(program, content, payoffIds, roleById);

  const head = program.slice(0, n);
  const masks = slotBandMembershipPerIndex(act, activeSlots, a3Layout);
  let bestCost = Number.POSITIVE_INFINITY;
  let bestPerm: number[] | null = null;

  for (const perm of indexPermutations(n)) {
    let total = 0;
    for (let slot = 0; slot < n; slot += 1) {
      const cardId = head[perm[slot]!]!;
      total += placementCostAtSlot(cardId, slot, masks, content, payoffIds, roleById, nodeType);
    }
    if (total < bestCost || (total === bestCost && lexLessPerm(perm, bestPerm))) {
      bestCost = total;
      bestPerm = perm;
    }
  }

  const perm = bestPerm ?? Array.from({ length: n }, (_, i) => i);
  const reordered = Array.from({ length: n }, (_, slot) => head[perm[slot]!]!);
  return [...reordered, ...program.slice(n)];
}

/** Deterministic ordering heuristic for generated enemy program slots. */
export function orderOpponentProgramByHeuristic(
  queue: string[],
  activeSlots: number,
  content: CardContentService,
  payoffIds: Set<string>,
  roleById?: Record<string, OpponentCardRole>,
): string[] {
  const head = queue.slice(0, activeSlots);
  const scored = head.map((id, index) => {
    const c = content.get(id);
    const cost = c.charge_cost ?? 0;
    const freeBattery = isFreeEnergyGeneratorInPool(c);
    const lowCostBattery = !freeBattery && (c.gain_charge ?? 0) > 0 && cost <= 1;
    const finisher = isFinisherCard(id, content, payoffIds, roleById);
    let score = 0;
    if (freeBattery) score -= 5;
    else if (lowCostBattery) score -= 2;
    if (finisher) score += 6;
    score += cost * 2;
    return { id, index, score };
  });
  scored.sort((a, b) => a.score - b.score || a.index - b.index);
  return scored.map((x) => x.id);
}

