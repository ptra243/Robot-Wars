import { create } from 'zustand';
import { CardContentService, cardOfferStreamSeed } from '../core/content';
import {
  applyLossRetryChoice,
  cloneRun,
  createNewRun,
  loadFatigueDeckFromHand,
  playEncounter,
  resolveRandomEvent,
  rerollTravelOffers,
  resolveTravelPick,
  simulateDeckCycleReport,
  setupEncounterForNode,
  drawStartingHand,
  buildDeployDeckFromQueueAndHand,
  grantRelic,
  rollRelicForSource,
  rollRelicOffers,
  setEnemyPlannedSlot,
  setPlayerPlannedSlot,
  type DeckCycleReport,
} from '../core/run';
import type { CombatResult, RunState, SavedDeckPayload, TravelModalState } from '../core/types';
import { NEUTRAL_STARTER_DECK, generateDraftOffers, generateRewardOffers, DRAFT_ROUNDS } from '../core/draft';
import { getPilotById } from '../core/pilots';

const DEFAULT_SEED = 905344;
type DeckEditTarget = 'player' | 'enemy';

function fitQueueLength(from: Array<string | null>, len: number): Array<string | null> {
  const next = from.slice(0, len);
  while (next.length < len) next.push(null);
  return next;
}

function mergeSavedDeckPayloadIntoRun(run: RunState, payload: SavedDeckPayload, editTarget: DeckEditTarget): void {
  if (editTarget === 'player') {
    run.deck = [...payload.deck];
    run.hand = [...payload.hand];
    run.plannedQueue = [...payload.plannedQueue];
    run.enemyPlannedQueue = [...payload.enemyPlannedQueue];
    run.sandboxActiveQueueSlots = payload.sandboxActiveQueueSlots;
    run.sandboxPlayerCoreScrap = payload.sandboxPlayerCoreScrap;
    run.sandboxEnemyCoreScrap = payload.sandboxEnemyCoreScrap;
    return;
  }
  const sourceEnemyQueue = payload.enemyPlannedQueue.some((slot) => slot != null)
    ? payload.enemyPlannedQueue
    : payload.plannedQueue;
  run.enemyPlannedQueue = fitQueueLength(sourceEnemyQueue, run.enemyPlannedQueue.length);
  run.sandboxEnemyCoreScrap = payload.sandboxEnemyCoreScrap;
}

export type AppPhase = 'pilot_select' | 'draft' | 'travel' | 'forge' | 'deck' | 'battle' | 'retry' | 'reward';

interface GameStore {
  seedInput: string;
  run: RunState;
  lastResult: CombatResult | undefined;
  statusMessage: string;
  playback: CombatResult | null;
  eventStep: number;
  playbackPaused: boolean;
  appPhase: AppPhase;
  deckCycleReport: DeckCycleReport | null;
  /** Per-round card ID offers for the draft phase (DRAFT_ROUNDS × 3). */
  draftOffers: string[][];
  /** Current draft round index (0 = first pick). */
  draftStep: number;
  /** Gold gained in the last victorious encounter (shown in reward screen). */
  rewardGold: number;
  /** Up to 3 card IDs offered as a post-battle reward pick. */
  rewardCardOffers: string[];
  /** Up to 3 relic IDs offered after elite/boss (pick one). */
  rewardRelicOffers: string[];
  /** Relic ID chosen on the reward screen, or null if none / not yet picked. */
  rewardRelic: string | null;
  /** Travel shop / event / draft overlay; null when closed. */
  travelModal: TravelModalState | null;

  handleReset: (nextSeed?: number) => void;
  handleSelectPilot: (pilotId: string, options?: { unlockAllAwakenings?: boolean }) => void;
  handleDraftPick: (cardId: string) => void;
  handleSimulateEncounter: () => void;
  handleEventScrub: (nextStep: number) => void;
  handleStartBattleFromDeck: () => void;
  handlePickTravelOffer: (slotIndex: number) => void;
  handleOpenForge: () => void;
  handleOpenDeckBuilder: () => void;
  handleBackToTravel: () => void;
  handleEnterBattleWithResult: (result: CombatResult) => void;
  /**
   * Called by ForgePOC when the player clicks Deploy during a run-mode forge session.
   * Writes the chosen queue card IDs into the run, then runs the real encounter through
   * the full playEncounter lifecycle (deck sync, hand draw, rewards, etc.).
   */
  handleDeployFromForge: (
    queueIds: (string | null)[],
    /** Hand pile card ids from the forge (excludes cards already in the queue). */
    handCardIds: string[],
  ) => void;
  handleGoToRetry: () => void;
  handleGoToReward: () => void;
  handlePickRewardCard: (cardId: string) => void;
  handlePickRewardRelic: (relicId: string) => void;
  handleRerollRewardCards: () => void;
  handleRerollRewardRelics: () => void;
  handleSkipReward: () => void;
  handleRerollTravelOffers: () => void;
  handleChooseRetryAssist: (choice: 'enemy_hp_down' | 'free_rerolls') => void;
  handleAdjustRerolls: (delta: number) => void;
  handleScrapHandCard: (cardId: string) => void;
  handleSetBattleReplaySpeed: (speed: RunState['loop']['battleReplaySpeed']) => void;
  handleAssignPlannedSlot: (editTarget: DeckEditTarget, slotIndex: number, cardId: string) => void;
  handleSwapPlannedSlots: (editTarget: DeckEditTarget, a: number, b: number) => void;
  handleMergeHandCards: (
    sourceId: string,
    targetId: string,
    sourceHandIndex: number,
    targetHandIndex: number,
    mergedId: string,
  ) => void;
  handleLoadFatigueDeckFromHand: () => void;
  handleApplySavedDeckPayload: (payload: SavedDeckPayload, editTarget: DeckEditTarget) => void;
  handleSetSandboxActiveQueueSlots: (value: number) => void;
  handleSetSandboxPlayerCoreScrap: (value: number) => void;
  handleSetSandboxEnemyCoreScrap: (value: number) => void;
  handleRerollHandCard: (cardId: string) => void;
  handleExitBattleToDeck: () => void;
  /** End battle replay immediately (combat already simulated). */
  handleSkipBattleReplay: () => void;
  handleSimulateDeckCycle: () => void;
  handleSeedStep: (delta: number) => void;
  dismissDeckCycleReport: () => void;
  dismissTravelModal: () => void;
  handleShopBuyCard: (cardId: string) => boolean;
  handleShopRerollOffers: () => void;
  handleShopBuyRerollToken: () => void;
  handleShopBuyCommonRelic: () => void;
  handleTravelDraftPick: (cardId: string) => void;
  handleAcceptEventCardOffer: () => void;
  handleRefuseEventCardOffer: () => void;
  handleAcceptEventUpgradeOffer: () => void;
  handleRefuseEventUpgradeOffer: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  seedInput: String(DEFAULT_SEED),
  run: createNewRun(DEFAULT_SEED),
  lastResult: undefined,
  statusMessage: 'Choose your pilot to begin.',
  playback: null,
  eventStep: -1,
  playbackPaused: false,
  appPhase: 'pilot_select',
  deckCycleReport: null,
  draftOffers: [],
  draftStep: 0,
  rewardGold: 0,
  rewardCardOffers: [],
  rewardRelicOffers: [],
  rewardRelic: null,
  travelModal: null,

  handleReset: (nextSeed) => {
    const seed = nextSeed === undefined ? Number(get().seedInput) || DEFAULT_SEED : nextSeed;
    set({
      run: createNewRun(seed),
      lastResult: undefined,
      playback: null,
      eventStep: -1,
      playbackPaused: false,
      appPhase: 'pilot_select',
      deckCycleReport: null,
      draftOffers: [],
      draftStep: 0,
      rewardGold: 0,
      rewardCardOffers: [],
      rewardRelicOffers: [],
      rewardRelic: null,
      travelModal: null,
      statusMessage: 'Choose your pilot to begin.',
    });
  },

  handleSelectPilot: (pilotId, options) => {
    const nextRun = cloneRun(get().run);
    nextRun.spirit = { ...nextRun.spirit, id: pilotId };
    nextRun.deck = [...NEUTRAL_STARTER_DECK];
    // Base trait is always active for the chosen pilot.
    const pilot = getPilotById(pilotId);
    const unlockAllAwakenings = options?.unlockAllAwakenings === true;
    if (pilot) {
      nextRun.faction = pilot.faction;
      const allTraits = [pilot.traitIds.base, pilot.traitIds.aw0, pilot.traitIds.aw1];
      if (pilot.traitIds.aw2) allTraits.push(pilot.traitIds.aw2);
      nextRun.loop.playerTraitIds = unlockAllAwakenings
        ? allTraits
        : [pilot.traitIds.base];
    } else {
      nextRun.loop.playerTraitIds = [];
    }
    if (unlockAllAwakenings) {
      nextRun.loop.awakening = 2;
      nextRun.spirit.awakening = 2;
    }
    const content = CardContentService.loadDefault(nextRun.seed);
    const richGetRicher = pilot?.traitIds.base === 'baron_base';
    const offers = generateDraftOffers(
      nextRun.seed,
      nextRun.faction,
      nextRun.loop.awakening,
      content.getAll(),
      pilotId,
      richGetRicher,
    );
    set({
      run: nextRun,
      draftOffers: offers,
      draftStep: 0,
      appPhase: 'draft',
      travelModal: null,
      statusMessage: unlockAllAwakenings
        ? 'Draft 4 cards to complete your starting deck. All awakening traits enabled for this run.'
        : 'Draft 4 cards to complete your starting deck.',
    });
  },

  handleDraftPick: (cardId) => {
    const { draftStep, draftOffers } = get();
    const nextRun = cloneRun(get().run);
    nextRun.deck = [...nextRun.deck, cardId];
    const nextStep = draftStep + 1;
    const isDone = nextStep >= DRAFT_ROUNDS || nextStep >= draftOffers.length;
    if (isDone) {
      // Before the first battle, show the full deck in the forge so the player can
      // see and queue all their cards. After the first battle, playEncounter calls
      // drawStartingHand which replaces this with the normal random hand subset.
      nextRun.hand = [...nextRun.deck];
    }
    set({
      run: nextRun,
      draftStep: nextStep,
      appPhase: isDone ? 'travel' : 'draft',
      statusMessage: isDone
        ? 'Deck ready. Pick a travel node to begin your run.'
        : `Draft pick ${String(nextStep + 1)} of ${String(DRAFT_ROUNDS)}.`,
    });
  },

  handleSimulateEncounter: () => {
    const nextRun = cloneRun(get().run);
    const content = CardContentService.loadDefault(nextRun.seed);
    try {
      const result = playEncounter(nextRun, content);
      set({
        run: nextRun,
        lastResult: undefined,
        playback: result,
        eventStep: -1,
        playbackPaused: false,
        statusMessage: `Playing encounter (${result.events.length} steps)…`,
      });
    } catch (e) {
      set({
        statusMessage: e instanceof Error ? e.message : 'Deck invalid for combat.',
      });
    }
  },

  handleEventScrub: (nextStep) => {
    set((s) => ({
      eventStep: nextStep,
      ...(s.playback ? { playbackPaused: true } : {}),
    }));
  },

  handleStartBattleFromDeck: () => {
    const nextRun = cloneRun(get().run);
    const content = CardContentService.loadDefault(nextRun.seed);
    try {
      const result = playEncounter(nextRun, content);
      set({
        run: nextRun,
        lastResult: undefined,
        playback: result,
        eventStep: -1,
        playbackPaused: false,
        appPhase: 'battle',
        statusMessage: `Battle (${result.events.length} events)…`,
      });
    } catch (e) {
      set({
        statusMessage: e instanceof Error ? e.message : 'Deck invalid for combat.',
      });
    }
  },

  handlePickTravelOffer: (slotIndex) => {
    const nextRun = cloneRun(get().run);
    const content = CardContentService.loadDefault(nextRun.seed);
    const picked = resolveTravelPick(nextRun, slotIndex);
    if (!picked) {
      set({ statusMessage: 'No travel card in that slot.' });
      return;
    }
    if (picked.type === 'shop') {
      const shopC = CardContentService.loadDefault(
        cardOfferStreamSeed(nextRun.seed, nextRun.loop.totalStepsResolved * 79 + 11),
      );
      const offers = [
        shopC.drawWeighted(nextRun.faction, nextRun.loop.awakening).id,
        shopC.drawWeighted(nextRun.faction, nextRun.loop.awakening).id,
        shopC.drawWeighted(nextRun.faction, nextRun.loop.awakening).id,
      ];
      set({
        run: nextRun,
        appPhase: 'travel',
        travelModal: { kind: 'shop', offers, nonCardPurchases: 0 },
        statusMessage: 'Shop — pick a card or reroll.',
      });
      return;
    }
    if (picked.type === 'event') {
      const res = resolveRandomEvent(nextRun, content);
      if (res.outcome.kind === 'draft_pick') {
        set({
          run: nextRun,
          appPhase: 'travel',
          travelModal: { kind: 'draft', offers: res.outcome.offers },
          statusMessage: res.message,
        });
        return;
      }
      if (res.outcome.kind === 'card_offer') {
        set({
          run: nextRun,
          appPhase: 'travel',
          travelModal: {
            kind: 'event_card_offer',
            message: res.message,
            cardId: res.outcome.cardId,
            acceptCost: res.outcome.acceptCost,
            refuseGold: res.outcome.refuseGold,
          },
          statusMessage: res.message,
        });
        return;
      }
      if (res.outcome.kind === 'upgrade_offer') {
        set({
          run: nextRun,
          appPhase: 'travel',
          travelModal: {
            kind: 'event_upgrade_offer',
            message: res.message,
            beforeId: res.outcome.beforeId,
            afterId: res.outcome.afterId,
            acceptCost: res.outcome.acceptCost,
            refuseGold: res.outcome.refuseGold,
          },
          statusMessage: res.message,
        });
        return;
      }
      set({
        run: nextRun,
        appPhase: 'travel',
        travelModal: { kind: 'event', message: res.message, outcome: res.outcome },
        statusMessage: res.message,
      });
      return;
    }
    setupEncounterForNode(nextRun, picked.type, content);
    // Open the forge so the player can prepare their battle program before
    // the encounter resolves. The forge calls handleDeployFromForge when the
    // player is ready; that action runs the actual encounter and applies rewards.
    set({
      run: nextRun,
      appPhase: 'forge',
      statusMessage: `${String(picked.type).charAt(0).toUpperCase()}${String(picked.type).slice(1)} incoming — set your battle program and deploy.`,
    });
  },

  handleOpenForge: () => set({ appPhase: 'forge' }),

  handleOpenDeckBuilder: () => set({ appPhase: 'deck' }),

  handleBackToTravel: () => set({ appPhase: 'travel' }),

  handleEnterBattleWithResult: (result) =>
    set({
      lastResult: undefined,
      playback: result,
      eventStep: -1,
      playbackPaused: false,
      appPhase: 'battle',
      statusMessage: `Battle (${result.events.length} events)…`,
    }),

  handleDeployFromForge: (queueIds, handCardIds) => {
    const nextRun = cloneRun(get().run);
    const content = CardContentService.loadDefault(nextRun.seed);

    // Write the player's chosen queue into the run state before combat.
    for (let i = 0; i < nextRun.plannedQueue.length; i += 1) {
      nextRun.plannedQueue[i] = queueIds[i] ?? null;
    }

    // Sync merged / edited deck from the forge — previously only the queue was written,
    // so `run.deck` stayed stale and post-combat sync reverted merges.
    nextRun.deck = buildDeployDeckFromQueueAndHand(queueIds, handCardIds);

    // Snapshot pre-combat gold so we can show the delta on the reward screen.
    const goldBefore = nextRun.loop.gold;

    // Full encounter lifecycle: deck fill, combat sim, encounter index, deck sync,
    // post-combat rewards (gold/hearts/awakening), and fresh hand draw.
    let result: CombatResult;
    try {
      result = playEncounter(nextRun, content);
    } catch (e) {
      set({
        statusMessage: e instanceof Error ? e.message : 'Deck invalid for combat.',
      });
      return;
    }

    const goldGained = nextRun.loop.gold - goldBefore;

    // Always show the battle animation first. Victory/defeat actions live inside BattlePOC.
    set({
      run: nextRun,
      lastResult: undefined,
      playback: result,
      eventStep: -1,
      playbackPaused: false,
      appPhase: 'battle',
      rewardGold: goldGained,
      rewardRelic: null,
      rewardRelicOffers: [],
      statusMessage: result.playerWon
        ? `Victory! (${result.events.length} events)`
        : `Defeat. Hearts left: ${String(nextRun.loop.hearts)}.`,
    });
  },

  handleGoToRetry: () => set({ appPhase: 'retry' }),

  handleGoToReward: () => {
    const { run } = get();
    const content = CardContentService.loadDefault(run.seed);
    const offers = generateRewardOffers(
      run.seed + run.encounterIndex * 31,
      run.faction,
      run.loop.awakening,
      content.getAll(),
      run.loop.playerTraitIds.includes('baron_base'),
    );
    const relicSource = run.loop.pendingRelicRewardSource;
    const relicOffers = relicSource
      ? rollRelicOffers(
          run,
          relicSource,
          run.seed + run.encounterIndex * 47 + run.loop.totalStepsResolved * 3,
          3,
        )
      : [];
    set({
      appPhase: 'reward',
      rewardCardOffers: offers,
      rewardRelicOffers: relicOffers,
      rewardRelic: null,
    });
  },

  handlePickRewardRelic: (relicId) => {
    const nextRun = cloneRun(get().run);
    if (!grantRelic(nextRun, relicId)) {
      set({ statusMessage: 'Could not grant that relic.' });
      return;
    }
    nextRun.loop.pendingRelicRewardSource = null;
    set({
      run: nextRun,
      rewardRelic: relicId,
      rewardRelicOffers: [],
      statusMessage: 'Relic acquired. Choose a card reward or skip.',
    });
  },

  handleRerollRewardCards: () => {
    const { run, rewardCardOffers } = get();
    if (run.loop.rerolls <= 0) {
      set({ statusMessage: 'No rerolls left.' });
      return;
    }
    const nextRun = cloneRun(run);
    nextRun.loop.rerolls -= 1;
    const stream = cardOfferStreamSeed(
      nextRun.seed,
      nextRun.encounterIndex * 1000 + (3 - nextRun.loop.rerolls) * 17 + 9001,
    );
    const content = CardContentService.loadDefault(stream);
    const offers = generateRewardOffers(
      stream,
      nextRun.faction,
      nextRun.loop.awakening,
      content.getAll(),
      nextRun.loop.playerTraitIds.includes('baron_base'),
      rewardCardOffers,
    );
    set({ run: nextRun, rewardCardOffers: offers, statusMessage: 'Rerolled card rewards.' });
  },

  handleRerollRewardRelics: () => {
    const { run, rewardRelicOffers, rewardRelic } = get();
    if (rewardRelic || rewardRelicOffers.length === 0) return;
    if (run.loop.rerolls <= 0) {
      set({ statusMessage: 'No rerolls left.' });
      return;
    }
    const source = run.loop.pendingRelicRewardSource;
    if (!source) return;
    const nextRun = cloneRun(run);
    nextRun.loop.rerolls -= 1;
    const stream = cardOfferStreamSeed(
      nextRun.seed,
      nextRun.encounterIndex * 1000 + (3 - nextRun.loop.rerolls) * 19 + 7001,
    );
    const offers = rollRelicOffers(nextRun, source, stream, 3).filter(
      (id) => !rewardRelicOffers.includes(id),
    );
    const filled =
      offers.length >= 3
        ? offers.slice(0, 3)
        : [
            ...offers,
            ...rollRelicOffers(nextRun, source, stream + 1, 3).filter((id) => !offers.includes(id)),
          ].slice(0, 3);
    set({
      run: nextRun,
      rewardRelicOffers: filled.length > 0 ? filled : rollRelicOffers(nextRun, source, stream + 2, 3),
      statusMessage: 'Rerolled relic rewards.',
    });
  },

  handlePickRewardCard: (cardId) => {
    const nextRun = cloneRun(get().run);
    nextRun.deck = [...nextRun.deck, cardId];
    nextRun.hand = [...nextRun.deck];
    nextRun.loop.pendingRelicRewardSource = null;
    set({
      run: nextRun,
      appPhase: 'travel',
      rewardCardOffers: [],
      rewardRelicOffers: [],
      rewardGold: 0,
      rewardRelic: null,
      travelModal: null,
      statusMessage: 'Card added to deck. Choose your next travel node.',
    });
  },

  handleSkipReward: () => {
    const nextRun = cloneRun(get().run);
    nextRun.loop.pendingRelicRewardSource = null;
    set({
      run: nextRun,
      appPhase: 'travel',
      rewardCardOffers: [],
      rewardRelicOffers: [],
      rewardGold: 0,
      rewardRelic: null,
      travelModal: null,
      statusMessage: 'Reward skipped. Choose your next travel node.',
    });
  },

  handleRerollTravelOffers: () => {
    const nextRun = cloneRun(get().run);
    if (!rerollTravelOffers(nextRun)) {
      set({ statusMessage: 'No rerolls available for travel offers.' });
      return;
    }
    set({ run: nextRun, statusMessage: 'Rerolled travel offers.' });
  },

  handleChooseRetryAssist: (choice) => {
    const nextRun = cloneRun(get().run);
    applyLossRetryChoice(nextRun, choice);
    set({
      run: nextRun,
      appPhase: 'forge',
      statusMessage:
        choice === 'enemy_hp_down'
          ? 'Enemy HP reduced by 10%. Adjust your program and redeploy.'
          : '+3 free card rerolls added. Adjust your program and redeploy.',
    });
  },

  handleAdjustRerolls: (delta) => {
    if (!Number.isFinite(delta) || delta === 0) return;
    const nextRun = cloneRun(get().run);
    nextRun.loop.rerolls = Math.max(0, nextRun.loop.rerolls + Math.trunc(delta));
    set({ run: nextRun });
  },

  handleScrapHandCard: (cardId) => {
    const nextRun = cloneRun(get().run);
    const handIndex = nextRun.hand.indexOf(cardId);
    if (handIndex < 0) {
      set({ statusMessage: 'Card is not in hand.' });
      return;
    }
    nextRun.hand.splice(handIndex, 1);
    const deckIndex = nextRun.deck.indexOf(cardId);
    if (deckIndex >= 0) nextRun.deck.splice(deckIndex, 1);
    nextRun.loop.gold += 50;
    nextRun.loop.rerolls += 1;
    set({ run: nextRun, statusMessage: 'Card scrapped for 50 gold and +1 reroll.' });
  },

  handleSetBattleReplaySpeed: (speed) => {
    const nextRun = cloneRun(get().run);
    nextRun.loop.battleReplaySpeed = speed;
    set({ run: nextRun });
  },

  handleAssignPlannedSlot: (editTarget, slotIndex, cardId) => {
    const nextRun = cloneRun(get().run);
    if (editTarget === 'player') setPlayerPlannedSlot(nextRun, slotIndex, cardId);
    else setEnemyPlannedSlot(nextRun, slotIndex, cardId);
    set({ run: nextRun });
  },

  handleSwapPlannedSlots: (editTarget, a, b) => {
    if (a === b) return;
    const nextRun = cloneRun(get().run);
    const queue = editTarget === 'player' ? nextRun.plannedQueue : nextRun.enemyPlannedQueue;
    if (a < 0 || b < 0 || a >= queue.length || b >= queue.length) return;
    const t = queue[a];
    queue[a] = queue[b];
    queue[b] = t;
    set({ run: nextRun });
  },

  handleMergeHandCards: (sourceId, targetId, sourceHandIndex, targetHandIndex, mergedId) => {
    const nextRun = cloneRun(get().run);
    const removeFirst = (arr: string[], id: string) => {
      const ix = arr.indexOf(id);
      if (ix >= 0) arr.splice(ix, 1);
    };
    removeFirst(nextRun.deck, sourceId);
    removeFirst(nextRun.deck, targetId);
    nextRun.deck.push(mergedId);
    const [lo, hi] =
      sourceHandIndex < targetHandIndex
        ? [sourceHandIndex, targetHandIndex]
        : [targetHandIndex, sourceHandIndex];
    if (lo < 0 || hi < 0 || hi >= nextRun.hand.length) return;
    nextRun.hand.splice(hi, 1);
    nextRun.hand.splice(lo, 1);
    nextRun.hand.push(mergedId);
    set({ run: nextRun });
  },

  handleLoadFatigueDeckFromHand: () => {
    const nextRun = cloneRun(get().run);
    loadFatigueDeckFromHand(nextRun);
    set({ run: nextRun });
  },

  handleApplySavedDeckPayload: (payload, editTarget) => {
    const nextRun = cloneRun(get().run);
    mergeSavedDeckPayloadIntoRun(nextRun, payload, editTarget);
    set({ run: nextRun });
  },

  handleSetSandboxActiveQueueSlots: (value) => {
    const nextRun = cloneRun(get().run);
    nextRun.sandboxActiveQueueSlots = value;
    set({ run: nextRun });
  },

  handleSetSandboxPlayerCoreScrap: (value) => {
    const nextRun = cloneRun(get().run);
    nextRun.sandboxPlayerCoreScrap = value;
    set({ run: nextRun });
  },

  handleSetSandboxEnemyCoreScrap: (value) => {
    const nextRun = cloneRun(get().run);
    nextRun.sandboxEnemyCoreScrap = value;
    set({ run: nextRun });
  },

  handleRerollHandCard: (cardId) => {
    const nextRun = cloneRun(get().run);
    const index = nextRun.hand.indexOf(cardId);
    if (index < 0) {
      set({ statusMessage: 'Card is not in hand.' });
      return;
    }
    if (nextRun.loop.freeCardRerollsThisFight > 0) {
      nextRun.loop.freeCardRerollsThisFight -= 1;
    } else if (nextRun.loop.rerolls > 0) {
      nextRun.loop.rerolls -= 1;
    } else {
      set({ statusMessage: 'No rerolls available.' });
      return;
    }
    const stream = cardOfferStreamSeed(
      nextRun.seed,
      nextRun.encounterIndex * 500 + nextRun.loop.rerolls * 31 + index * 13 + 4242,
    );
    const content = CardContentService.loadDefault(stream);
    let tierCard;
    try {
      tierCard = content.get(cardId);
    } catch {
      tierCard = null;
    }
    nextRun.hand[index] = tierCard
      ? content.drawWeightedSameTier(
          nextRun.faction,
          nextRun.loop.awakening,
          tierCard,
          cardId,
        ).id
      : content.drawWeighted(nextRun.faction, nextRun.loop.awakening).id;
    set({ run: nextRun, statusMessage: 'Rerolled hand card.' });
  },

  handleExitBattleToDeck: () => {
    set({ appPhase: 'travel' });
  },

  handleSkipBattleReplay: () => {
    const { playback } = get();
    if (!playback) {
      return;
    }
    const lastIdx = Math.max(0, playback.events.length - 1);
    set({
      lastResult: playback,
      playback: null,
      playbackPaused: true,
      eventStep: lastIdx,
      statusMessage: `Encounter complete: ${playback.playerWon ? 'WIN' : 'LOSS'} in ${String(playback.rounds)} rounds.`,
    });
  },

  handleSimulateDeckCycle: () => {
    const { run } = get();
    const content = CardContentService.loadDefault(run.seed);
    set({
      deckCycleReport: simulateDeckCycleReport(run, content),
    });
  },

  handleSeedStep: (delta) => {
    const { seedInput, run } = get();
    const nextSeed = (Number(seedInput) || run.seed) + delta;
    set({ seedInput: String(nextSeed) });
    get().handleReset(nextSeed);
  },

  dismissDeckCycleReport: () => set({ deckCycleReport: null }),

  dismissTravelModal: () => set({ travelModal: null }),

  handleShopBuyCard: (cardId) => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'shop') return false;
    const CARD_PRICE = 40;
    const nextRun = cloneRun(get().run);
    if (nextRun.loop.gold < CARD_PRICE) return false;
    const content = CardContentService.loadDefault(nextRun.seed);
    const cardName = content.get(cardId).name;
    nextRun.loop.gold -= CARD_PRICE;
    nextRun.deck.push(cardId);
    drawStartingHand(nextRun);
    set({
      run: nextRun,
      travelModal: {
        kind: 'shop',
        offers: modal.offers,
        nonCardPurchases: modal.nonCardPurchases,
      },
      statusMessage: `${cardName} bought.`,
    });
    return true;
  },

  handleShopRerollOffers: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'shop') return;
    const nextRun = cloneRun(get().run);
    const price = 50 + 50 * modal.nonCardPurchases;
    if (nextRun.loop.gold < price) return;
    const nextStream = modal.nonCardPurchases + 1;
    const c = CardContentService.loadDefault(cardOfferStreamSeed(nextRun.seed, nextStream));
    const offers = [
      c.drawWeighted(nextRun.faction, nextRun.loop.awakening).id,
      c.drawWeighted(nextRun.faction, nextRun.loop.awakening).id,
      c.drawWeighted(nextRun.faction, nextRun.loop.awakening).id,
    ];
    nextRun.loop.gold -= price;
    set({
      run: nextRun,
      travelModal: { kind: 'shop', offers, nonCardPurchases: modal.nonCardPurchases + 1 },
      statusMessage: 'Shop offers rerolled.',
    });
  },

  handleShopBuyRerollToken: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'shop') return;
    const nextRun = cloneRun(get().run);
    const price = 50 + 50 * modal.nonCardPurchases;
    if (nextRun.loop.gold < price) return;
    nextRun.loop.gold -= price;
    nextRun.loop.rerolls += 1;
    set({
      run: nextRun,
      travelModal: {
        kind: 'shop',
        offers: modal.offers,
        nonCardPurchases: modal.nonCardPurchases + 1,
      },
      statusMessage: 'Bought +1 card reroll.',
    });
  },

  handleShopBuyCommonRelic: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'shop') return;
    const nextRun = cloneRun(get().run);
    const price = 100 * 2 ** nextRun.loop.shopRelicPurchaseCount;
    if (nextRun.loop.gold < price) return;
    const rolled = rollRelicForSource(
      nextRun,
      'shop',
      nextRun.seed +
        nextRun.loop.totalStepsResolved * 97 +
        nextRun.loop.shopRelicPurchaseCount * 13,
    );
    if (!rolled) {
      set({ statusMessage: 'No common relic available in the shop pool.' });
      return;
    }
    if (!grantRelic(nextRun, rolled.id)) {
      set({ statusMessage: 'Could not buy relic from shop.' });
      return;
    }
    nextRun.loop.gold -= price;
    nextRun.loop.shopRelicPurchaseCount += 1;
    set({
      run: nextRun,
      travelModal: {
        kind: 'shop',
        offers: modal.offers,
        nonCardPurchases: modal.nonCardPurchases,
      },
      statusMessage: `${rolled.name} bought.`,
    });
  },

  handleTravelDraftPick: (cardId) => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'draft') return;
    const nextRun = cloneRun(get().run);
    nextRun.deck = [...nextRun.deck, cardId];
    drawStartingHand(nextRun);
    set({
      run: nextRun,
      travelModal: null,
      statusMessage: 'Card added to deck.',
    });
  },

  handleAcceptEventCardOffer: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'event_card_offer') return;
    const nextRun = cloneRun(get().run);
    const { cardId, acceptCost } = modal;
    if (nextRun.loop.gold < acceptCost) {
      set({ statusMessage: 'Not enough gold to accept the card offer.' });
      return;
    }
    let cardName = 'Card';
    try {
      cardName = CardContentService.loadDefault(nextRun.seed).get(cardId).name;
    } catch {
      /* ignore */
    }
    nextRun.loop.gold -= acceptCost;
    nextRun.deck.push(cardId);
    drawStartingHand(nextRun);
    set({
      run: nextRun,
      travelModal: null,
      statusMessage: `${cardName} added for ${String(acceptCost)}g.`,
    });
  },

  handleRefuseEventCardOffer: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'event_card_offer') return;
    const nextRun = cloneRun(get().run);
    nextRun.loop.gold += modal.refuseGold;
    set({
      run: nextRun,
      travelModal: null,
      statusMessage: `Card offer refused. +${String(modal.refuseGold)}g.`,
    });
  },

  handleAcceptEventUpgradeOffer: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'event_upgrade_offer') return;
    const nextRun = cloneRun(get().run);
    const { beforeId, afterId, acceptCost } = modal;
    if (nextRun.loop.gold < acceptCost) {
      set({ statusMessage: 'Not enough gold to upgrade.' });
      return;
    }
    const deckIdx = nextRun.deck.indexOf(beforeId);
    if (deckIdx < 0) {
      set({ statusMessage: 'That card is no longer in your deck.' });
      return;
    }
    nextRun.loop.gold -= acceptCost;
    nextRun.deck[deckIdx] = afterId;
    const handIdx = nextRun.hand.indexOf(beforeId);
    if (handIdx >= 0) nextRun.hand[handIdx] = afterId;
    for (let i = 0; i < nextRun.plannedQueue.length; i += 1) {
      if (nextRun.plannedQueue[i] === beforeId) {
        nextRun.plannedQueue[i] = afterId;
      }
    }
    let afterName = afterId;
    try {
      afterName = CardContentService.loadDefault(nextRun.seed).get(afterId).name;
    } catch {
      /* ignore */
    }
    set({
      run: nextRun,
      travelModal: null,
      statusMessage: `Upgraded to ${afterName} for ${String(acceptCost)}g.`,
    });
  },

  handleRefuseEventUpgradeOffer: () => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'event_upgrade_offer') return;
    const nextRun = cloneRun(get().run);
    nextRun.loop.gold += modal.refuseGold;
    set({
      run: nextRun,
      travelModal: null,
      statusMessage: `Upgrade refused. +${String(modal.refuseGold)}g.`,
    });
  },
}));
