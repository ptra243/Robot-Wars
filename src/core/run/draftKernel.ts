import { SeededRandom } from '../content';
import { DRAFT_OFFERS_PER_ROUND } from '../draft';

/**
 * Sample up to 3 *distinct* ids with replacement across the *candidate list* (weighted).
 */
export function sampleThreeFromPool(
  poolIds: string[],
  wById: (id: string) => number,
  rng: Pick<SeededRandom, 'next' | 'nextInt'>,
): string[] {
  if (poolIds.length === 0) {
    return [];
  }
  const out: string[] = [];
  const used = new Set<string>();
  for (let k = 0; k < DRAFT_OFFERS_PER_ROUND; k += 1) {
    const avail = poolIds.filter((id) => !used.has(id) && wById(id) > 0);
    if (avail.length === 0) {
      break;
    }
    let total = 0;
    for (const id of avail) {
      total += wById(id);
    }
    let r = rng.next() * total;
    for (const id of avail) {
      r -= wById(id);
      if (r <= 0) {
        out.push(id);
        used.add(id);
        break;
      }
    }
  }
  return out;
}

/**
 * argmax w; **deterministic** tie: lexicographic `id` ascending, then one rng int.
 */
export function pickMaxWeight(
  offers: string[],
  wById: (id: string) => number,
  rng: Pick<SeededRandom, 'nextInt'>,
): string {
  if (offers.length === 0) {
    return '';
  }
  const sorted = [...offers].sort();
  let best: string = sorted[0]!;
  let bestW = wById(best);
  for (const id of sorted.slice(1)) {
    const wi = wById(id);
    if (wi > bestW) {
      best = id;
      bestW = wi;
    }
  }
  const ties = sorted.filter((id) => wById(id) === bestW);
  if (ties.length === 1) {
    return best;
  }
  return ties[rng.nextInt(ties.length)]!;
}
