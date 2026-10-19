import { COMBAT_RULES } from '../rules';
import type { CardContentService } from '../content';
import type { CombatSetup, FighterState, RunState } from '../types';

/**
 * Empty **active** planning slots (indices below `activeQueueSlots`) are stored as
 * {@link COMBAT_RULES.blankQueueSlotCardId} so in-combat effects (e.g. Core Rebirth) see real basic ids in the real program.
 * Out-of-width indices stay `null` (inert; the resolver only advances within active width).
 */
/** Blank / empty active slots become this card id (relics may upgrade basics). */
export function blankCardIdForTraits(traitIds: readonly string[]): string {
  if (traitIds.includes('relic_multistrike_protocol')) {
    return 'neutral_multi_strike_t1';
  }
  if (traitIds.includes('relic_tempered_blanks')) {
    return 'neutral_basic_strike_t2';
  }
  return COMBAT_RULES.blankQueueSlotCardId;
}

export function materializeQueueBlankSlots(
  queue: Array<string | null>,
  size: number,
  activeQueueSlots: number = COMBAT_RULES.queueSize,
  blankCardId: string = COMBAT_RULES.blankQueueSlotCardId,
): Array<string | null> {
  const ac = Math.max(5, Math.min(COMBAT_RULES.queueSize, Math.floor(activeQueueSlots)));
  return Array.from({ length: size }, (_, index) => {
    if (index >= ac) {
      return null;
    }
    const id = queue[index];
    if (id == null || id === '') {
      return blankCardId;
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
  const clampedActive = Math.max(5, Math.min(COMBAT_RULES.queueSize, Math.floor(activeQueueSlots)));
  const padded = Array.from({ length: COMBAT_RULES.queueSize }, (_, index) => queue[index] ?? null);
  const blankId = blankCardIdForTraits(traitIds);
  const queueData = materializeBlankQueueSlots
    ? materializeQueueBlankSlots(padded, COMBAT_RULES.queueSize, clampedActive, blankId)
    : padded;
  return {
    name,
    hp: COMBAT_RULES.startingHp,
    maxHp: COMBAT_RULES.startingHp,
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
    persistentResolvedByQueueIndex: {},
    nextStrikePierceCharges: 0,
    mitigateNextIncomingStrike: 0,
    strikeResolutionsThisCombat: 0,
    traitIds: [...traitIds],
    tempUpgrade: null,
    scrapEngineCount: 0,
    scrapHoundAttackStacks: 0,
    scrapHoundShieldStacks: 0,
    scrapEnergyEngineStacks: 0,
    scrapExposeEngineStacks: 0,
    emergencyProtocolStacks: 0,
    mirrorCoreSelfDamage: false,
    overclockBonusUsedThisTurn: false,
    primeSlotStrikePotencyBonus: 0,
    faithStacks: 0,
    clockworkSequencePrev: null,
    temporaryPrimeSlots: [],
    primeSlotOverrides: [],
    scheduledEffects: [],
    lastDeckWrapsSeenForRelics: 0,
    primeDirectiveActiveThisTurn: false,
    preventEmergencyProtocolSpendThisTurn: false,
    stance: null,
    shuriken: 0,
    evadeStacks: 0,
    virusStacks: 0,
    virulentRetributionStacks: 0,
    nextTigerCardOverclock: false,
    nextTigerCardPierce: false,
    nextTigerCardPotencyGain: 0,
    nextTigerCardPotencyAfterCardLoss: 0,
    nextTigerCardExposePerEnergy: null,
    nextTigerCardExtraStrikeFromTargetVirusCap: null,
    nextShurikenUnloadImbueVirusPerHit: 0,
    activatedDragonThisCombat: false,
    activatedTigerThisCombat: false,
    activatedBirdThisCombat: false,
    activatedTortoiseThisCombat: false,
    lastResolvedCardFaction: null,
  };
}

export function buildEnemyDeck(run: RunState, content: CardContentService): string[] {
  const awakening = run.loop.awakening;
  if (run.combatEnemyFatigueDeck && run.combatEnemyFatigueDeck.length > 0) {
    const built = deckWithBasicsIfEmpty([...run.combatEnemyFatigueDeck]);
    run.combatEnemyFatigueDeck = null;
    return built;
  }
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
