import { CardContentService } from '../content';
import { CombatSimulator } from '../combat';
import { COMBAT_RULES } from '../rules';
import { callTraitOnCombatStart } from '../traits';
import type { CombatResult, RunState } from '../types';
import { buildEnemyDeck, createPreviewFighter, deckWithBasicsIfEmpty } from './combatSetup';
import { applyPostCombatRewards, initRunLoop } from './runLoop';
import {
  applyQueuePersistenceToPlayerDeck,
  persistedQueueSlotIdAfterCombat,
} from './queuePostCombat';

const RELIC_TRAIT_MAP: Record<string, string> = {
  if_no_shield_gain_shield_2: 'relic_reactive_plating',
  regen_start_turn_1: 'relic_repair_nanites',
  neutral_non_basic_gain_junk_2: 'relic_scrap_condenser',
  hp_pay_damage_equal: 'relic_berserker_instincts',
  transform_strike_2: 'relic_hot_swap_injector',
  trash_dynamo: 'relic_trash_dynamo',
  scrap_recycling: 'relic_scrap_recycling',
  junk_shrapnel: 'relic_junk_shrapnel',
  stall_shield_weaken: 'relic_stall_shield_weaken',
  delay_double_cast: 'relic_delay_double_cast',
  epic_prime_directive: 'relic_prime_directive',
  epic_overclock_mandate: 'relic_overclock_mandate',
  epic_basic_instincts: 'relic_basic_instincts',
  epic_emergency_junk_shield: 'relic_emergency_junk_shield',
};

/** Default sandbox hand (cards are not in `run.deck` until {@link loadFatigueDeckFromHand}). */
export const SANDBOX_STARTER_HAND: string[] = [
  'salvage_strike_t1',
  'junk_loader_t1',
  'field_diode_t1',
  'strip_mine_t1',
  'neutral_basic_strike_t1',
  'neutral_barrier_t1',
  'salvage_mantle_t1',
];

/** Shallow clone of run state for immutable updates before encounter simulation (deck builder + battle). */
export function cloneRun(run: RunState): RunState {
  return {
    ...run,
    spirit: { ...run.spirit },
    deck: [...run.deck],
    hand: [...run.hand],
    plannedQueue: [...run.plannedQueue],
    enemyPlannedQueue: [...run.enemyPlannedQueue],
    sandboxActiveQueueSlots: run.sandboxActiveQueueSlots,
    sandboxPlayerCoreScrap: run.sandboxPlayerCoreScrap,
    sandboxEnemyCoreScrap: run.sandboxEnemyCoreScrap,
    loop: {
      ...run.loop,
      travelDrawPile: [...run.loop.travelDrawPile],
      travelDiscard: [...run.loop.travelDiscard],
      travelOffers: [...run.loop.travelOffers],
      relicIds: [...run.loop.relicIds],
      playerTraitIds: [...run.loop.playerTraitIds],
    },
  };
}

export function createNewRun(seed: number): RunState {
  const run: RunState = {
    seed,
    remainingLosses: 3,
    encounterIndex: 0,
    faction: 'scavengers',
    spirit: {
      id: 'glint',
      awakening: 0,
      spiritXp: 0,
    },
    deck: [],
    hand: [...SANDBOX_STARTER_HAND],
    plannedQueue: Array.from({ length: COMBAT_RULES.queueSize }, () => null),
    enemyPlannedQueue: Array.from({ length: COMBAT_RULES.queueSize }, () => null),
    sandboxActiveQueueSlots: COMBAT_RULES.queueSize,
    sandboxPlayerCoreScrap: 0,
    sandboxEnemyCoreScrap: 0,
    loop: {
      act: 1,
      stepsInAct: 0,
      totalStepsResolved: 0,
      awakening: 0,
      playerHp: COMBAT_RULES.startingHp,
      playerHpMax: COMBAT_RULES.startingHp,
      hearts: 3,
      gold: 0,
      rerolls: 0,
      reshufflesRemaining: 0,
      travelDrawPile: [],
      travelDiscard: [],
      travelOffers: [null, null, null],
      pendingEncounterType: null,
      enemyHpMultiplier: 1,
      freeCardRerollsThisFight: 0,
      relicIds: [],
      playerTraitIds: [],
      retryAvailable: false,
      battleReplaySpeed: 1,
    },
  };

  initRunLoop(run);
  return run;
}

/** Persist {@link deckWithBasicsIfEmpty} into `run.deck` when it is empty (combat / deck-cycle sim). */
export function replaceEmptyDeckWithBasicStrikes(run: RunState): void {
  if (run.deck.length === 0) {
    run.deck = deckWithBasicsIfEmpty(run.deck);
  }
}

/** Sandbox: copy {@link RunState.hand} into `deck` when `deck` is still empty (before first load-deck). */
export function syncDeckFromHandIfEmpty(run: RunState): void {
  if (run.deck.length === 0 && run.hand.length > 0) {
    run.deck = [...run.hand];
  }
}

/** Copy hand into the player deck, then draw a fresh opening hand (sandbox). */
export function loadFatigueDeckFromHand(run: RunState): void {
  if (run.hand.length === 0) {
    return;
  }
  run.deck = [...run.hand];
  run.hand = [];
  drawStartingHand(run);
}

export function drawStartingHand(run: RunState): void {
  run.hand = [...run.deck];
}

/**
 * Rebuilds the fatigue deck from forge deploy: battle-program slots first, then the hand pile.
 * Matches {@link ForgePOC} standalone deploy and deck-cycle sim ordering.
 */
export function buildDeployDeckFromQueueAndHand(
  queueIds: Array<string | null>,
  handCardIds: string[],
): string[] {
  const fromQueue = queueIds.filter((id): id is string => Boolean(id));
  return [...fromQueue, ...handCardIds];
}

export function tryAssignQueueSlot(run: RunState, slotIndex: number, cardId: string): boolean {
  if (slotIndex < 0 || slotIndex >= COMBAT_RULES.queueSize) {
    return false;
  }

  if (!run.hand.includes(cardId)) {
    return false;
  }

  run.plannedQueue[slotIndex] = cardId;
  return true;
}

export function tryClearQueueSlot(run: RunState, slotIndex: number): boolean {
  if (slotIndex < 0 || slotIndex >= COMBAT_RULES.queueSize) {
    return false;
  }

  run.plannedQueue[slotIndex] = null;
  return true;
}

/** Sandbox: assign planned queue without requiring the card to be in hand (e.g. drag from carousel). */
export function setPlayerPlannedSlot(run: RunState, slotIndex: number, cardId: string | null): boolean {
  if (slotIndex < 0 || slotIndex >= COMBAT_RULES.queueSize) {
    return false;
  }

  run.plannedQueue[slotIndex] = cardId;
  return true;
}

export function setEnemyPlannedSlot(run: RunState, slotIndex: number, cardId: string | null): boolean {
  if (slotIndex < 0 || slotIndex >= COMBAT_RULES.queueSize) {
    return false;
  }

  run.enemyPlannedQueue[slotIndex] = cardId;
  return true;
}

function createCombatSetup(run: RunState, content: CardContentService) {
  const enemyDeck = buildEnemyDeck(run, content);

  const player = createPreviewFighter(
    'Player',
    run.deck,
    run.plannedQueue,
    run.sandboxPlayerCoreScrap,
    run.sandboxActiveQueueSlots,
    true,
    run.loop.playerTraitIds,
  );
  for (const relicId of run.loop.relicIds) {
    const mapped = RELIC_TRAIT_MAP[relicId];
    if (mapped) {
      player.traitIds.push(mapped);
    }
  }
  player.hp = run.loop.playerHp;
  callTraitOnCombatStart(player, content);

  const enemy = createPreviewFighter(
    'Enemy',
    enemyDeck,
    run.enemyPlannedQueue,
    run.sandboxEnemyCoreScrap,
    run.sandboxActiveQueueSlots,
    true,
  );
  const potencyStacks = run.loop.relicIds.filter((id) => id === 'potency_start_plus_1').length;
  if (potencyStacks > 0) {
    player.potency += potencyStacks;
  }
  const chargeStacks = run.loop.relicIds.filter((id) => id === 'charge_start_plus_2').length;
  if (chargeStacks > 0) {
    player.charge += chargeStacks * 2;
  }

  // Baron von Boar — The Whole Hog (Aw1): +1 potency per 50 gold at combat start
  if (run.loop.playerTraitIds.includes('baron_aw1')) {
    player.potency += Math.floor(run.loop.gold / 50);
  }
  if (run.loop.playerTraitIds.includes('rust_ranger_base')) {
    player.junkCapacity = 5;
  }
  enemy.hp = Math.max(1, Math.floor(enemy.hp * run.loop.enemyHpMultiplier));

  return {
    seed: run.seed + run.encounterIndex,
    player,
    enemy,
  };
}


export function playEncounter(run: RunState, content: CardContentService): CombatResult {
  const initialPlanned = [...run.plannedQueue];
  const initialEnemyPlanned = [...run.enemyPlannedQueue];
  run.loop.playerHp = run.loop.playerHpMax;
  syncDeckFromHandIfEmpty(run);
  replaceEmptyDeckWithBasicStrikes(run);
  const deckBeforeCombat = [...run.deck];
  const setup = createCombatSetup(run, content);
  const simulator = new CombatSimulator(content, setup.seed);
  const result = simulator.run(setup);

  run.encounterIndex += 1;
  syncRunFromCombatResult(run, result, initialPlanned, initialEnemyPlanned, deckBeforeCombat);
  applyPostCombatRewards(run, result.playerWon);
  if (run.deck.length > 0) {
    drawStartingHand(run);
  }
  return result;
}

/**
 * Apply combat outcome to the run after a fight (used by {@link playEncounter};
 * export for tests and tooling). On defeat, deck/planned queues are restored; on
 * victory, in-combat-only queue transforms (factory reset, temp tier upgrade) are reverted
 * to pre-combat planned cards while persisting real grafts and deck sync.
 */
export function syncRunFromCombatResult(
  run: RunState,
  result: CombatResult,
  initialPlanned: Array<string | null>,
  initialEnemyPlanned: Array<string | null>,
  deckBeforeCombat: string[],
): void {
  const blank = COMBAT_RULES.blankQueueSlotCardId;

  if (!result.playerWon) {
    run.deck = [...deckBeforeCombat];
    run.plannedQueue = [...initialPlanned];
    run.enemyPlannedQueue = [...initialEnemyPlanned];
    run.hand = [...deckBeforeCombat];
    run.loop.playerHp = run.loop.playerHpMax;
    return;
  }

  run.loop.playerHp = Math.max(0, result.finalState.player.hp);

  const finalPlayerQ = result.finalState.player.queue;
  const nextPlanned: Array<string | null> = [];
  for (let i = 0; i < COMBAT_RULES.queueSize; i += 1) {
    nextPlanned[i] = persistedQueueSlotIdAfterCombat(
      initialPlanned[i],
      finalPlayerQ[i] ?? null,
      blank,
    );
  }
  // Scrap Ping (Aw0): revert the temporary queue upgrade so it never persists across combats.
  const upgrade = result.finalState.player.tempUpgrade;
  if (upgrade) {
    nextPlanned[upgrade.slotIndex] = upgrade.originalId;
  }
  run.plannedQueue = nextPlanned;
  run.deck = applyQueuePersistenceToPlayerDeck(
    result.finalState.player.deck,
    finalPlayerQ,
    nextPlanned,
  );

  const finalEnemyQ = result.finalState.enemy.queue;
  const nextEnemy: Array<string | null> = [];
  for (let i = 0; i < COMBAT_RULES.queueSize; i += 1) {
    nextEnemy[i] = persistedQueueSlotIdAfterCombat(
      initialEnemyPlanned[i],
      finalEnemyQ[i] ?? null,
      blank,
    );
  }
  run.enemyPlannedQueue = nextEnemy;
}

export function buildDeckSummary(run: RunState, content: CardContentService): string {
  const groups = new Map<string, number>();
  for (const id of run.deck) {
    groups.set(id, (groups.get(id) ?? 0) + 1);
  }

  return [...groups.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([id, count]) => `${content.get(id).name} x${count}`)
    .join(', ');
}
