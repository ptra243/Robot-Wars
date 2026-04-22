import { create } from 'zustand';
import { CardContentService, cardOfferStreamSeed } from '../core/content';
import {
  applyLossRetryChoice,
  cloneRun,
  createNewRun,
  playEncounter,
  resolveRandomEvent,
  rerollTravelOffers,
  resolveTravelPick,
  simulateDeckCycleReport,
  setupEncounterForNode,
  validateDeckComposition,
  drawStartingHand,
  buildDeployDeckFromQueueAndHand,
  type DeckCycleReport,
} from '../core/run';
import type { CombatResult, RunState, TravelModalState } from '../core/types';
import { NEUTRAL_STARTER_DECK, generateDraftOffers, generateRewardOffers, DRAFT_ROUNDS } from '../core/draft';
import { getPilotById } from '../core/pilots';

const DEFAULT_SEED = 905344;

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
  /** Relic ID gained from the last encounter (elite/boss), or null. */
  rewardRelic: string | null;
  /** Travel shop / event / draft overlay; null when closed. */
  travelModal: TravelModalState | null;

  setRun: (value: RunState | ((prev: RunState) => RunState)) => void;
  setEventStep: (value: number | ((prev: number) => number)) => void;
  setPlaybackPaused: (value: boolean | ((prev: boolean) => boolean)) => void;

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
  handleSkipReward: () => void;
  handleRerollTravelOffers: () => void;
  handleChooseRetryAssist: (choice: 'enemy_hp_down' | 'free_rerolls') => void;
  handleRerollHandCard: (cardId: string) => void;
  handleExitBattleToDeck: () => void;
  handleSimulateDeckCycle: () => void;
  handleSeedStep: (delta: number) => void;
  dismissDeckCycleReport: () => void;
  dismissTravelModal: () => void;
  handleShopBuyCard: (cardId: string) => boolean;
  handleShopRerollOffers: () => void;
  handleShopBuyRerollToken: () => void;
  handleTravelDraftPick: (cardId: string) => void;
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
  rewardRelic: null,
  travelModal: null,

  setRun: (value) =>
    set((s) => ({
      run: typeof value === 'function' ? (value as (prev: RunState) => RunState)(s.run) : value,
    })),

  setEventStep: (value) =>
    set((s) => ({
      eventStep: typeof value === 'function' ? (value as (p: number) => number)(s.eventStep) : value,
    })),

  setPlaybackPaused: (value) =>
    set((s) => ({
      playbackPaused:
        typeof value === 'function' ? (value as (p: boolean) => boolean)(s.playbackPaused) : value,
    })),

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
      nextRun.loop.playerTraitIds = unlockAllAwakenings
        ? [pilot.traitIds.base, pilot.traitIds.aw0, pilot.traitIds.aw1]
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
    const offers = generateDraftOffers(nextRun.seed, nextRun.faction, content.getAll(), richGetRicher);
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
    const deckErr = validateDeckComposition(nextRun, content);
    if (deckErr) {
      set({ statusMessage: deckErr });
      return;
    }
    const result = playEncounter(nextRun, content);
    set({
      run: nextRun,
      lastResult: undefined,
      playback: result,
      eventStep: -1,
      playbackPaused: false,
      statusMessage: `Playing encounter (${result.events.length} steps)…`,
    });
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
    const deckErr = validateDeckComposition(nextRun, content);
    if (deckErr) {
      set({ statusMessage: deckErr });
      return;
    }
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
      set({
        run: nextRun,
        appPhase: 'travel',
        travelModal: { kind: 'event', message: res.message, outcome: res.outcome },
        statusMessage: res.message,
      });
      return;
    }
    setupEncounterForNode(nextRun, picked.type);
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
    const deployDeckErr = validateDeckComposition(nextRun, content);
    if (deployDeckErr) {
      set({ statusMessage: deployDeckErr });
      return;
    }

    // Snapshot pre-combat gold and relics so we can show deltas in the reward screen.
    const goldBefore = nextRun.loop.gold;
    const relicsBefore = new Set(nextRun.loop.relicIds);

    // Full encounter lifecycle: deck fill, combat sim, encounter index, deck sync,
    // post-combat rewards (gold/hearts/awakening), and fresh hand draw.
    const result = playEncounter(nextRun, content);

    const goldGained = nextRun.loop.gold - goldBefore;
    const newRelic = nextRun.loop.relicIds.find((r) => !relicsBefore.has(r)) ?? null;

    // Always show the battle animation first. Victory/defeat actions live inside BattlePOC.
    set({
      run: nextRun,
      lastResult: undefined,
      playback: result,
      eventStep: -1,
      playbackPaused: false,
      appPhase: 'battle',
      rewardGold: goldGained,
      rewardRelic: newRelic,
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
    set({ appPhase: 'reward', rewardCardOffers: offers });
  },

  handlePickRewardCard: (cardId) => {
    const nextRun = cloneRun(get().run);
    nextRun.deck = [...nextRun.deck, cardId];
    nextRun.hand = [...nextRun.deck];
    set({
      run: nextRun,
      appPhase: 'travel',
      rewardCardOffers: [],
      rewardGold: 0,
      rewardRelic: null,
      travelModal: null,
      statusMessage: 'Card added to deck. Choose your next travel node.',
    });
  },

  handleSkipReward: () =>
    set({
      appPhase: 'travel',
      rewardCardOffers: [],
      rewardGold: 0,
      rewardRelic: null,
      travelModal: null,
      statusMessage: 'Reward skipped. Choose your next travel node.',
    }),

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
    const content = CardContentService.loadDefault(nextRun.seed);
    nextRun.hand[index] = content.drawWeighted(nextRun.faction, nextRun.loop.awakening).id;
    set({ run: nextRun, statusMessage: 'Rerolled hand card.' });
  },

  handleExitBattleToDeck: () => {
    set({ appPhase: 'travel' });
  },

  handleSimulateDeckCycle: () => {
    const { run } = get();
    const content = CardContentService.loadDefault(run.seed);
    const deckErr = validateDeckComposition(run, content);
    if (deckErr) {
      set({ statusMessage: deckErr });
      return;
    }
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

  handleTravelDraftPick: (cardId) => {
    const modal = get().travelModal;
    if (!modal || modal.kind !== 'draft') return;
    const nextRun = cloneRun(get().run);
    const content = CardContentService.loadDefault(nextRun.seed);
    nextRun.deck = [...nextRun.deck, cardId];
    drawStartingHand(nextRun);
    const deckErr = validateDeckComposition(nextRun, content);
    if (deckErr) {
      set({ statusMessage: `Cannot add that card: ${deckErr}` });
      return;
    }
    set({
      run: nextRun,
      travelModal: null,
      statusMessage: 'Card added to deck.',
    });
  },
}));
