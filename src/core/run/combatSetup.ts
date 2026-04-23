import { COMBAT_RULES } from '../rules';
import type { CardContentService } from '../content';
import type { CombatSetup, FighterState, RunState } from '../types';

/**
 * Empty planning slots are stored as {@link COMBAT_RULES.blankQueueSlotCardId} so in-combat effects that
 * look for Neutral Basic Strike ids (e.g. Core Rebirth) see real entries — resolve-time fallback still applies if null slips in.
 */
export function materializeQueueBlankSlots(queue: Array<string | null>, size: number): string[] {
  return Array.from({ length: size }, (_, index) => {
    const id = queue[index];
    if (id == null || id === '') {
      return COMBAT_RULES.blankQueueSlotCardId;
    }
    return id;
  });
}

/** When the player deck is empty, combat and sim use a full pile of Neutral Basic Strike (same id as blank slots). */
export function deckWithBasicsIfEmpty(deck: string[]): string[] {
  if (deck.length > 0) {
    return [...deck];
  }
  return Array.from({ length: COMBAT_RULES.queueSize }, () => COMBAT_RULES.blankQueueSlotCardId);
}

/** Maps a deck list (up to `queueSize` cards) into a full queue; remaining slots are null (Basic Strike). */
export function padQueueFromDeckList(deckList: string[]): Array<string | null> {
  return Array.from({ length: COMBAT_RULES.queueSize }, (_, i) => deckList[i] ?? null);
}

/**
 * @param materializeBlankQueueSlots When true (combat only), empty slots become `blankQueueSlotCardId` so
 * in-fight effects see real basics. Deck preview / sandbox keeps nulls so empty planning slots stay empty in the UI.
 * @param traitIds Active pilot trait IDs for this fighter. Forwarded into combat engine for trait hooks.
 */
export function createPreviewFighter(
  name: string,
  deck: string[],
  queue: Array<string | null> | string[],
  coreScrap = 0,
  activeQueueSlots: number = COMBAT_RULES.queueSize,
  materializeBlankQueueSlots = false,
  traitIds: string[] = [],
): FighterState {
  const clampedActive = Math.max(3, Math.min(COMBAT_RULES.queueSize, Math.floor(activeQueueSlots)));
  const padded = Array.from({ length: COMBAT_RULES.queueSize }, (_, index) => queue[index] ?? null);
  const queueData = materializeBlankQueueSlots
    ? materializeQueueBlankSlots(padded, COMBAT_RULES.queueSize)
    : padded;
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
    coreScrap,
    potency: 0,
    exposeDamage: 0,
    weakenStacks: 0,
    deckCursor: 0,
    deckWraps: 0,
    queueCursor: 0,
    activeQueueSlots: clampedActive,
    stallCountAtCursor: 0,
    deck: [...deck],
    queue: queueData,
    auras: [],
    continuousTicksByQueueIndex: {},
    continuousNextTickRoundByQueueIndex: {},
    nextStrikePierceCharges: 0,
    mitigateNextIncomingStrike: 0,
    strikeResolutionsThisCombat: 0,
    traitIds: [...traitIds],
    tempUpgrade: null,
    emergencyProtocolStacks: 0,
    mirrorCoreSelfDamage: false,
    overclockBonusUsedThisTurn: false,
    scheduledEffects: [],
    lastDeckWrapsSeenForRelics: 0,
    primeDirectiveActiveThisTurn: false,
    preventEmergencyProtocolSpendThisTurn: false,
  };
}

export function buildEnemyDeck(run: RunState, content: CardContentService): string[] {
  const awakening = run.loop.awakening;
  const encounterType = run.loop.pendingEncounterType;
  if (encounterType === 'battle' || encounterType === 'elite' || encounterType === 'boss') {
    return Array.from({ length: 7 }, () => 'neutral_basic_strike_t1');
  }
  const deck: string[] = [];

  for (let index = 0; index < 7; index += 1) {
    deck.push(String(content.drawWeighted('scavengers', awakening).id));
  }

  const allBasicStrikes = deck.every((id) => id === 'neutral_basic_strike_t1');
  if (allBasicStrikes) {
    return ['salvage_strike_t1', ...deck.slice(1)];
  }

  return deck;
}

/**
 * Build a combat setup from explicit deck lists (headless / tests). The same list is used for the
 * fighter `deck` (fatigue wraps) and, by default, the planned `queue` in order (slots 0…).
 */
export function createCombatSetupFromDecklists(options: {
  seed: number;
  playerDeck: string[];
  enemyDeck: string[];
  playerQueue?: Array<string | null>;
  enemyQueue?: Array<string | null>;
  playerCoreScrap?: number;
  enemyCoreScrap?: number;
  activeQueueSlots?: number;
}): CombatSetup {
  const pq = options.playerQueue ?? padQueueFromDeckList(options.playerDeck);
  const eq = options.enemyQueue ?? padQueueFromDeckList(options.enemyDeck);
  return {
    seed: options.seed,
    player: createPreviewFighter(
      'Player',
      [...options.playerDeck],
      pq,
      options.playerCoreScrap ?? 0,
      options.activeQueueSlots ?? COMBAT_RULES.queueSize,
      true,
    ),
    enemy: createPreviewFighter(
      'Enemy',
      [...options.enemyDeck],
      eq,
      options.enemyCoreScrap ?? 0,
      options.activeQueueSlots ?? COMBAT_RULES.queueSize,
      true,
    ),
  };
}
