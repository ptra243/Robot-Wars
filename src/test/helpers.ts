import { materializeQueueBlankSlots } from '../core/run';
import { COMBAT_RULES } from '../core/rules';
import type { FighterState } from '../core/types';

/** Minimal fighter for headless combat tests. */
export function makeTestFighter(
  name: string,
  deck: string[],
  queue: Array<string | null>,
  activeQueueSlots = COMBAT_RULES.queueSize,
): FighterState {
  const padded = Array.from({ length: COMBAT_RULES.queueSize }, (_, i) => queue[i] ?? null);
  return {
    name,
    hp: COMBAT_RULES.startingHp,
    block: 0,
    charge: 0,
    junk: 0,
    junkCapacity: Number.POSITIVE_INFINITY,
    programCycleCount: 0,
    pendingRustRangerCircuit: false,
    bulkStacks: 0,
    coreScrap: 0,
    potency: 0,
    exposeDamage: 0,
    deckCursor: 0,
    deckWraps: 0,
    queueCursor: 0,
    activeQueueSlots,
    stallCountAtCursor: 0,
    deck: [...deck],
    queue: materializeQueueBlankSlots(padded, COMBAT_RULES.queueSize),
    auras: [],
    continuousTicksByQueueIndex: {},
    continuousNextTickRoundByQueueIndex: {},
    nextStrikePierceCharges: 0,
    mitigateNextIncomingStrike: 0,
    strikeResolutionsThisCombat: 0,
    traitIds: [],
    tempUpgrade: null,
  };
}
