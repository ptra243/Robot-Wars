import type { CardContentService } from '../../content';
import { SeededRandom } from '../../content';
import { cardBaseId, isLegalEnemyCard } from '../opponentCardWeights';
import { getPoolSlice } from '../opponentDecks';

function mergeTierFromT1(
  t1Id: string,
  content: CardContentService,
  target: 2 | 3,
): string | null {
  const c1 = content.get(t1Id);
  const t2 = c1.merge_to ? content.get(c1.merge_to) : null;
  if (target === 2) return t2?.id ?? null;
  if (!c1.merge_to) return null;
  const c2 = content.get(c1.merge_to);
  if (c2.merge_to) return c2.merge_to;
  return null;
}

/** 4×t1 → t3, 2×t1 → t2, 3×t1 → t2+t1 when possible (plan §1.5). */
export function mergeAfterDraft(picks: string[], content: CardContentService): string[] {
  const count = new Map<string, number>();
  for (const p of picks) count.set(p, (count.get(p) ?? 0) + 1);
  const out: string[] = [];
  for (const [t1, n0] of count) {
    let n = n0;
    if (!t1.toLowerCase().endsWith('_t1')) {
      for (let i = 0; i < n; i += 1) out.push(t1);
      continue;
    }
    while (n >= 4) {
      const t3 = mergeTierFromT1(t1, content, 3);
      if (t3) {
        out.push(t3);
        n -= 4;
        continue;
      }
      const t2 = mergeTierFromT1(t1, content, 2);
      if (t2) {
        out.push(t2, t2);
        n -= 4;
        continue;
      }
      for (let i = 0; i < 4; i += 1) out.push(t1);
      n -= 4;
    }
    if (n === 3) {
      const t2 = mergeTierFromT1(t1, content, 2);
      if (t2) out.push(t2, t1);
      else for (let i = 0; i < 3; i += 1) out.push(t1);
      n = 0;
    }
    if (n === 2) {
      const t2 = mergeTierFromT1(t1, content, 2);
      if (t2) out.push(t2);
      else for (let i = 0; i < 2; i += 1) out.push(t1);
      n = 0;
    }
    if (n === 1) out.push(t1);
  }
  return out;
}

export function minPrimaryTarget(activeSlots: number, act: number, node: 'battle' | 'elite' | 'boss'): number {
  const p = 0.2 + act * 0.08 + (node === 'elite' ? 0.1 : 0) + (node === 'boss' ? 0.1 : 0);
  return Math.max(1, Math.min(activeSlots, Math.round(activeSlots * Math.min(0.95, p))));
}

export function primaryBasesForSlice(slice: ReturnType<typeof getPoolSlice>): Set<string> {
  return new Set(slice.primary.map((id) => cardBaseId(id)));
}

export function applyMinPrimary(
  queue: string[],
  minP: number,
  slice: ReturnType<typeof getPoolSlice>,
  content: CardContentService,
  faction: string,
  aw: 0 | 1,
  rng: Pick<SeededRandom, 'nextInt'>,
): string[] {
  const bases = primaryBasesForSlice(slice);
  const q = [...queue];
  let prim = q.filter((id) => {
    const b = cardBaseId(id);
    return slice.primary.includes(id) || bases.has(b);
  }).length;
  if (prim >= minP) return q;
  const dudOrSec = (id: string) =>
    slice.dud.includes(id) || slice.secondary.includes(id) || !slice.primary.includes(id);
  let need = minP - prim;
  const candidates = slice.primary.filter((id) => isLegalEnemyCard(id, faction, aw, content));
  while (need > 0 && q.some(dudOrSec) && candidates.length > 0) {
    const idxFromRight = [...q.keys()].filter((i) => dudOrSec(q[i]!)).pop();
    if (idxFromRight === undefined) break;
    q[idxFromRight] = candidates[rng.nextInt(candidates.length)]!;
    need -= 1;
  }
  return q;
}

export function allPrimaryBasesRepresented(
  slice: ReturnType<typeof getPoolSlice>,
  picks: string[],
): boolean {
  const need = primaryBasesForSlice(slice);
  if (need.size === 0) return true;
  const got = new Set<string>();
  for (const id of picks) {
    const b = cardBaseId(id);
    if (need.has(b)) got.add(b);
  }
  for (const b of need) if (!got.has(b)) return false;
  return true;
}

