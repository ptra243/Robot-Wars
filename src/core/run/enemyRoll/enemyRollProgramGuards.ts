import type { CardContentService } from '../../content';
import { SeededRandom } from '../../content';
import { COMBAT_RULES } from '../../rules';
import { cardCanDealEnemyHpDamage } from './enemyRollDamage';
import { isLegalEnemyCard } from '../opponentCardWeights';
import { OPPONENT_BATTERY_FALLBACK_IDS, getPoolSlice, isFreeEnergyGeneratorInPool } from '../opponentDecks';

function programHasNonZeroChargeCost(ids: string[], content: CardContentService): boolean {
  return ids.some((id) => (content.get(id).charge_cost ?? 0) > 0);
}

function programHasAnyBattery(ids: string[], content: CardContentService): boolean {
  return ids.some((id) => isFreeEnergyGeneratorInPool(content.get(id)));
}

/** Ensures at least one net-charge battery exists if program contains non-zero-cost cards. */
export function ensureOpponentBatteryInProgram(
  final: string[],
  slice: ReturnType<typeof getPoolSlice>,
  unionPool: string[],
  content: CardContentService,
  faction: string,
  aw: 0 | 1,
  _rng: Pick<SeededRandom, 'nextInt'>,
):
  | { next: string[]; injected: { at: number; with: string; replaced: string } }
  | { next: string[]; injected: null } {
  if (!programHasNonZeroChargeCost(final, content) || programHasAnyBattery(final, content)) {
    return { next: final, injected: null };
  }
  const legal = (id: string): boolean => isLegalEnemyCard(id, faction, aw, content);
  const battery = (id: string): boolean => legal(id) && isFreeEnergyGeneratorInPool(content.get(id));
  const fromTheme = unionPool.filter(battery);
  const fromBackstop = [...OPPONENT_BATTERY_FALLBACK_IDS].filter(battery);
  const candidates = fromTheme.length > 0 ? fromTheme : fromBackstop;
  if (candidates.length === 0) return { next: final, injected: null };

  const pick =
    candidates.sort((a, b) => {
      const aCap = a.includes('capacitor_feed') ? 1 : 0;
      const bCap = b.includes('capacitor_feed') ? 1 : 0;
      if (bCap !== aCap) return bCap - aCap;
      return (content.get(b).gain_charge ?? 0) - (content.get(a).gain_charge ?? 0);
    })[0]!;

  const isOustable = (id: string): boolean => {
    if (isFreeEnergyGeneratorInPool(content.get(id))) return false;
    if (slice.dud.includes(id)) return true;
    if (id === COMBAT_RULES.blankQueueSlotCardId) return true;
    if (id.toLowerCase().includes('neutral_basic_strike')) return true;
    if (slice.secondary.includes(id) && !slice.primary.includes(id)) return (content.get(id).charge_cost ?? 0) === 0;
    if (!slice.primary.includes(id) && (content.get(id).charge_cost ?? 0) === 0) return true;
    return false;
  };

  for (let i = 0; i < final.length; i += 1) {
    if (isOustable(final[i]!)) {
      const replaced = final[i]!;
      const next = final.map((x, j) => (j === i ? pick : x)) as string[];
      return { next, injected: { at: i, with: pick, replaced } };
    }
  }

  const costs = final.map((id) => content.get(id).charge_cost ?? 0);
  const payers = costs.map((c, i) => (c > 0 ? i : -1)).filter((i) => i >= 0);
  if (payers.length > 0) {
    const minC = Math.min(...payers.map((i) => costs[i]!));
    for (let i = 0; i < final.length; i += 1) {
      if (costs[i] === minC) {
        const replaced = final[i]!;
        const next = final.map((x, j) => (j === i ? pick : x)) as string[];
        return { next, injected: { at: i, with: pick, replaced } };
      }
    }
  }
  return { next: final, injected: null };
}

function canOustProgramSlot(
  id: string,
  slice: ReturnType<typeof getPoolSlice>,
  content: CardContentService,
): boolean {
  if (isFreeEnergyGeneratorInPool(content.get(id))) return false;
  if (slice.dud.includes(id)) return true;
  if (id === COMBAT_RULES.blankQueueSlotCardId) return true;
  if (id.toLowerCase().includes('neutral_basic_strike')) return true;
  if (slice.secondary.includes(id) && !slice.primary.includes(id)) return (content.get(id).charge_cost ?? 0) === 0;
  if (!slice.primary.includes(id) && (content.get(id).charge_cost ?? 0) === 0) return true;
  return false;
}

/** If no card in program deals HP damage, inject a damage-capable replacement. */
export function ensureHpDamageInProgram(
  final: string[],
  slice: ReturnType<typeof getPoolSlice>,
  unionPool: string[],
  content: CardContentService,
  faction: string,
  aw: 0 | 1,
  rng: Pick<SeededRandom, 'nextInt'>,
): string[] {
  if (final.some((id) => cardCanDealEnemyHpDamage(id, content))) return final;
  const legal = (id: string): boolean => isLegalEnemyCard(id, faction, aw, content);
  const damageCandidates = unionPool.filter((id) => legal(id) && cardCanDealEnemyHpDamage(id, content));
  if (damageCandidates.length > 0) {
    const pick = damageCandidates[rng.nextInt(damageCandidates.length)]!;
    for (let i = 0; i < final.length; i += 1) {
      if (canOustProgramSlot(final[i]!, slice, content)) {
        const next = [...final];
        next[i] = pick;
        return next;
      }
    }
  }
  for (let i = 0; i < final.length; i += 1) {
    if (canOustProgramSlot(final[i]!, slice, content)) {
      const next = [...final];
      next[i] = COMBAT_RULES.blankQueueSlotCardId;
      return next;
    }
  }
  if (final.length > 0) {
    const next = [...final];
    next[final.length - 1] = COMBAT_RULES.blankQueueSlotCardId;
    return next;
  }
  return [COMBAT_RULES.blankQueueSlotCardId];
}

