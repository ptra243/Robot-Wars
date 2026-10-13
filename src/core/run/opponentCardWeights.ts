import type { CardContentService } from '../content';
import type { CardDef } from '../types';
import type { OpponentBand, OpponentPoolSlice, OpponentTheme } from './opponentDecks';
import { getPoolSlice, isFreeEnergyGeneratorInPool, unionPoolIds } from './opponentDecks';

const EPS_DUD = 0.08;
const LAMBDA_FLAVOR = 0.35;
const MANIFEST_MU = 0.2;

const PRIMARY_GOAL = 1;
const SECONDARY_GOAL = 0.4;
const DUD_GOAL = 0.05;
const ILLEGAL = 0;

function cardBaseId(id: string): string {
  return id.replace(/_t[0-9]+$/i, '');
}


function dudSet(slice: OpponentPoolSlice): Set<string> {
  return new Set(slice.dud);
}

/**
 * Faction + awakening legality (plan §1.8).
 */
export function isLegalEnemyCard(
  id: string,
  faction: string,
  enemyAwakening: 0 | 1,
  content: CardContentService,
): boolean {
  const c = content.get(id);
  if (c.awakening_min > enemyAwakening) {
    return false;
  }
  if (c.neutral) {
    return true;
  }
  return c.faction === faction;
}

/**
 * 1.0 = not a dud bucket card; `ε` if in dud list.
 */
export function dudDrawWeight(id: string, slice: OpponentPoolSlice): number {
  return dudSet(slice).has(id) ? EPS_DUD : 1;
}

/** Upgrade tier from `_tN` suffix, default 1. */
export function manifestTierNumber(id: string, content: CardContentService): number {
  const c = content.get(id);
  return Math.max(1, c.card_tier);
}

export function manifestTierWeight(id: string, content: CardContentService): number {
  return 1 + MANIFEST_MU * (manifestTierNumber(id, content) - 1);
}

/**
 * Flavor: tiny tie-break 0.9–1.1 from theme-agnostic strike vs engine heuristics.
 */
export function flavorWeight(id: string, content: CardContentService, theme: OpponentTheme): number {
  const c = content.get(id);
  const strikeish = c.base_damage > 0 || c.strike_potency_gain > 0;
  const engineish = c.gain_charge > 0 || c.gain_junk > 0;
  const junkish = c.gain_junk > 2;
  if (theme === 'junk_crown' || theme === 'junk_aegis') {
    return 0.5 * (junkish ? 1 : 0) + 0.5 * (engineish ? 0.5 : 0);
  }
  if (theme === 'core_factory') {
    return c.gain_core > 0 || c.spend_core > 0 ? 0.4 : 0.1;
  }
  if (theme === 'expose' || theme === 'gathering_strike') {
    return strikeish ? 0.45 : 0.15;
  }
  return strikeish ? 0.25 : 0.15;
}

/**
 * goalMatchWeight: primary > secondary > dud by static lists (base match for goal lists).
 */
export function goalMatchWeight(
  id: string,
  theme: OpponentTheme,
  band: OpponentBand,
  enemyAw: 0 | 1,
  _content: CardContentService,
): number {
  const slice = getPoolSlice(theme, band, enemyAw);
  const b = cardBaseId(id);
  for (const p of slice.primary) {
    if (p === id || cardBaseId(p) === b) {
      return PRIMARY_GOAL;
    }
  }
  for (const p of slice.secondary) {
    if (p === id || cardBaseId(p) === b) {
      return SECONDARY_GOAL;
    }
  }
  if (slice.dud.includes(id) || dudSet(slice).has(id)) {
    return DUD_GOAL;
  }
  return DUD_GOAL;
}

/**
 * `w` = product used for argmax 3-pick-1 and weighted sampling.
 */
export function combinedDraftWeight(
  id: string,
  theme: OpponentTheme,
  band: OpponentBand,
  enemyAw: 0 | 1,
  slice: OpponentPoolSlice,
  content: CardContentService,
  faction: string,
): number {
  if (!isLegalEnemyCard(id, faction, enemyAw, content)) {
    return ILLEGAL;
  }
  const g = goalMatchWeight(id, theme, band, enemyAw, content);
  const dudW = dudDrawWeight(id, slice);
  const m = manifestTierWeight(id, content);
  const f = 1 + LAMBDA_FLAVOR * flavorWeight(id, content, theme);
  return g * dudW * m * f;
}

/**
 * @returns every legal id in P with positive weight, for building the offer table.
 */
export function buildWeightTable(
  theme: OpponentTheme,
  band: OpponentBand,
  enemyAw: 0 | 1,
  slice: OpponentPoolSlice,
  content: CardContentService,
  faction: string,
  enemyAwForLegal: 0 | 1,
): Map<string, number> {
  const ids = unionPoolIds(slice);
  const map = new Map<string, number>();
  for (const id of ids) {
    if (!isLegalEnemyCard(id, faction, enemyAwForLegal, content)) continue;
    const w = combinedDraftWeight(id, theme, band, enemyAw, slice, content, faction);
    if (w > 0) {
      map.set(id, w);
    }
  }
  return map;
}

export { LAMBDA_FLAVOR, isFreeEnergyGeneratorInPool, cardBaseId, unionPoolIds };

/**
 * Reject dud list entries that are "free energy" generators (plan: must be good tier).
 * Call in tests / CI, not in hot path.
 */
export function validateDudExcludesFreeEnergy(slice: OpponentPoolSlice, all: CardDef[]): string[] {
  const bad: string[] = [];
  const byId = new Map(all.map((c) => [c.id, c] as const));
  for (const d of slice.dud) {
    const c = byId.get(d);
    if (c && isFreeEnergyGeneratorInPool(c)) {
      bad.push(d);
    }
  }
  return bad;
}
