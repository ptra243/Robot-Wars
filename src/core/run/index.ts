/**
 * Run / sandbox domain: encounter flow, arena snapshots, deck-cycle simulation, combat setup helpers.
 * Split across modules; import from `core/run` as before.
 */
export {
  DECK_CYCLE_DECK_PASSES,
  DECK_CYCLE_SIM_ROUNDS,
  type DeckCycleReport,
  type DeckCycleRoundSummary,
  simulateDeckCycleReport,
} from './deckCycleSimulation';

export {
  FORGE_DECK_SIM_ROUNDS,
  type ForgeDeckRoundMetrics,
  type ForgeDeckSimulationPlayerBaseline,
  type ForgeDeckSimulationResult,
  aggregateForgeDeckMetricsFromEvents,
  aggregateProgramCardIdPerRound,
  simulateForgeDeckMetrics,
} from './forgeDeckSimulation';

export {
  SANDBOX_STARTER_HAND,
  cloneRun,
  createNewRun,
  replaceEmptyDeckWithBasicStrikes,
  syncDeckFromHandIfEmpty,
  loadFatigueDeckFromHand,
  drawStartingHand,
  buildDeployDeckFromQueueAndHand,
  tryAssignQueueSlot,
  tryClearQueueSlot,
  setPlayerPlannedSlot,
  setEnemyPlannedSlot,
  playEncounter,
  buildDeckSummary,
} from './lifecycle';

export {
  initRunLoop,
  rerollTravelOffers,
  resolveTravelPick,
  setupEncounterForNode,
  resolveRandomEvent,
  applyLossRetryChoice,
  applyPostCombatRewards,
  type TravelEventResolution,
} from './runLoop';

export {
  buildEncounterSnapshot,
  mergeFighterVitals,
  buildArenaFromReplaySlice,
} from './arenaSnapshot';

export {
  materializeQueueBlankSlots,
  deckWithBasicsIfEmpty,
  padQueueFromDeckList,
  createPreviewFighter,
  createCombatSetupFromDecklists,
} from './combatSetup';

export {
  DECK_STRING_FORMAT_VERSION,
  savedDeckPayloadFromRun,
  encodeDeckPayload,
  encodeDeckString,
  decodeDeckString,
} from './deckStringCodec';

export {
  MAX_CONTINUOUS_OR_PERSISTENT_PER_DECK,
  MAX_COPIES_PER_NON_UNIQUE_CARD_ID,
  aggregateDeckCardIds,
  isUnlimitedCopyNeutralStapleId,
  validateDeckComposition,
} from '../deckRules';
