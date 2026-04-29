import { SeededRandom, CardContentService, cardOfferStreamSeed } from '../content';
import { COMBAT_RULES } from '../rules';
import type { RunState, TravelEventOutcome, TravelNodeType, TravelOffer } from '../types';
import { activeQueueSlotsForAct, prepareEnemyForCombat } from './enemyRoll';
import { grantRelic, rollRelicForSource } from './relics';

const ACT_TRAVEL_DECK_TEMPLATE: TravelNodeType[] = [
  'shop',
  'event',
  'event',
  'event',
  'event',
  'event',
  'elite',
  'battle',
  'battle',
  'battle',
  'battle',
  'battle',
  'battle',
  'battle',
  'battle',
];

/** Per-act path length before a boss is forced; act 4 (`infiniteMode`) has no cap. */
export function stepsCapForAct(act: number): number {
  if (act <= 1) return 5;
  if (act === 2) return 7;
  if (act === 3) return 9;
  return 0;
}

const ACT4_PLAYER_HP_RAMP = 3;
const ACT4_ENEMY_STARTING_HP_BONUS = 2;
export { ACT4_ENEMY_STARTING_HP_BONUS };
const STARTING_HEARTS = 3;
const STARTING_GOLD = 50;
const STARTING_REROLLS = 3;
const STARTING_RESHUFFLES = 2;
const WIN_GOLD_BATTLE = 20;
const WIN_GOLD_BOSS = 60;
const WIN_GOLD_ELITE = 40;

function shuffleTravelDeck(seed: number, act: number): TravelNodeType[] {
  const rng = new SeededRandom(seed + act * 1741);
  const deck = [...ACT_TRAVEL_DECK_TEMPLATE];
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const a = deck[i]!;
    deck[i] = deck[j]!;
    deck[j] = a;
  }
  return deck;
}

function drawTravelNode(run: RunState): TravelNodeType | null {
  if (run.loop.infiniteMode) {
    return 'battle';
  }
  const draw = run.loop.travelDrawPile;
  if (draw.length > 0) {
    return draw.shift() ?? null;
  }
  if (run.loop.reshufflesRemaining <= 0 || run.loop.travelDiscard.length === 0) {
    return null;
  }
  run.loop.reshufflesRemaining -= 1;
  run.loop.travelDrawPile = [...run.loop.travelDiscard];
  const rng = new SeededRandom(run.seed + run.loop.totalStepsResolved * 73 + run.encounterIndex * 31);
  for (let i = run.loop.travelDrawPile.length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const tmp = run.loop.travelDrawPile[i]!;
    run.loop.travelDrawPile[i] = run.loop.travelDrawPile[j]!;
    run.loop.travelDrawPile[j] = tmp;
  }
  run.loop.travelDiscard = [];
  return run.loop.travelDrawPile.shift() ?? null;
}

function refillOneOffer(run: RunState, index: number): void {
  if (run.loop.infiniteMode) {
    run.loop.travelOffers[index] = {
      id: `endless_battle_${String(run.loop.totalStepsResolved)}_${String(index)}`,
      type: 'battle',
    };
    return;
  }
  const node = drawTravelNode(run);
  run.loop.travelOffers[index] = node
    ? {
        id: `travel_${String(run.loop.totalStepsResolved)}_${String(index)}_${node}`,
        type: node,
      }
    : null;
}

export function initRunLoop(run: RunState): void {
  run.loop.act = 1;
  run.loop.stepsInAct = 0;
  run.loop.totalStepsResolved = 0;
  run.loop.awakening = 0;
  run.loop.playerHp = COMBAT_RULES.startingHp;
  run.loop.playerHpMax = COMBAT_RULES.startingHp;
  run.loop.playerHpBaseMax = COMBAT_RULES.startingHp;
  run.loop.hearts = STARTING_HEARTS;
  run.loop.gold = STARTING_GOLD;
  run.loop.rerolls = STARTING_REROLLS;
  run.loop.reshufflesRemaining = STARTING_RESHUFFLES;
  run.loop.travelDrawPile = shuffleTravelDeck(run.seed, run.loop.act);
  run.loop.travelDiscard = [];
  run.loop.travelOffers = [null, null, null];
  run.loop.pendingEncounterType = null;
  run.loop.enemyHpMultiplier = 1;
  run.loop.freeCardRerollsThisFight = 0;
  run.loop.relicIds = [];
  run.loop.playerTraitIds = [];
  run.loop.retryAvailable = false;
  run.loop.battleReplaySpeed = 1;
  run.loop.earlyBattleBasicsRemaining = 2;
  run.loop.act4BattleIndex = 0;
  run.loop.infiniteMode = false;
  run.sandboxActiveQueueSlots = activeQueueSlotsForAct(run.loop.act);
  run.remainingLosses = STARTING_HEARTS;
  run.spirit.awakening = 0;
  for (let i = 0; i < run.loop.travelOffers.length; i += 1) {
    refillOneOffer(run, i);
  }
}

function forceBossOffer(run: RunState): void {
  run.loop.travelDrawPile = [];
  run.loop.travelDiscard = [];
  run.loop.travelOffers = [{ id: `boss_act_${String(run.loop.act)}`, type: 'boss' }, null, null];
}

export function resolveTravelPick(run: RunState, slotIndex: number): TravelOffer | null {
  const offer = run.loop.travelOffers[slotIndex] ?? null;
  if (!offer) {
    return null;
  }
  run.loop.travelOffers[slotIndex] = null;
  run.loop.stepsInAct += 1;
  run.loop.totalStepsResolved += 1;
  run.loop.travelDiscard.push(offer.type);
  const cap = run.loop.infiniteMode ? 1_000_000 : stepsCapForAct(run.loop.act);
  if (cap > 0 && run.loop.stepsInAct >= cap && offer.type !== 'boss') {
    forceBossOffer(run);
  } else {
    refillOneOffer(run, slotIndex);
  }
  return offer;
}

export function rerollTravelOffers(run: RunState): boolean {
  if (run.loop.rerolls <= 0) {
    return false;
  }
  run.loop.rerolls -= 1;
  for (const offer of run.loop.travelOffers) {
    if (offer) {
      run.loop.travelDiscard.push(offer.type);
    }
  }
  run.loop.travelOffers = [null, null, null];
  for (let i = 0; i < run.loop.travelOffers.length; i += 1) {
    refillOneOffer(run, i);
  }
  return true;
}

export function setupEncounterForNode(
  run: RunState,
  nodeType: TravelNodeType,
  content?: CardContentService,
): void {
  if (nodeType !== 'battle' && nodeType !== 'elite' && nodeType !== 'boss') {
    run.loop.pendingEncounterType = null;
    run.loop.enemyHpMultiplier = 1;
    run.loop.freeCardRerollsThisFight = 0;
    run.loop.retryAvailable = false;
    return;
  }
  run.loop.pendingEncounterType = nodeType;
  run.loop.retryAvailable = true;
  run.loop.freeCardRerollsThisFight = 0;
  run.loop.enemyHpMultiplier = 1;
  if (content) {
    // Pre-roll enemy so Forge can preview enemy program/deck before deploy.
    prepareEnemyForCombat(run, content);
  }
}

export function applyPostCombatRewards(run: RunState, playerWon: boolean): void {
  if (!run.loop.pendingEncounterType) {
    return;
  }
  if (!playerWon) {
    run.loop.hearts = Math.max(0, run.loop.hearts - 1);
    run.remainingLosses = run.loop.hearts;
    return;
  }
  run.loop.playerHpMax += 10;
  run.loop.playerHpBaseMax += 10;
  run.loop.playerHp = run.loop.playerHpMax;
  if (run.loop.pendingEncounterType === 'battle' || run.loop.pendingEncounterType === 'elite') {
    if (run.loop.act >= 4) {
      run.loop.act4BattleIndex += 1;
      run.loop.playerHpMax += ACT4_PLAYER_HP_RAMP;
      run.loop.playerHp = run.loop.playerHpMax;
    }
  }
  if (run.loop.pendingEncounterType === 'battle') {
    run.loop.gold += WIN_GOLD_BATTLE;
  } else if (run.loop.pendingEncounterType === 'elite') {
    run.loop.gold += WIN_GOLD_ELITE;
    const rolled = rollRelicForSource(
      run,
      'elite',
      run.seed + run.loop.totalStepsResolved * 19 + run.encounterIndex * 7,
    );
    if (rolled) {
      grantRelic(run, rolled.id);
    }
  } else {
    run.loop.gold += WIN_GOLD_BOSS;
    const rolled = rollRelicForSource(
      run,
      'boss',
      run.seed + run.loop.totalStepsResolved * 23 + run.encounterIndex * 11,
    );
    if (rolled) {
      grantRelic(run, rolled.id);
    }
    run.loop.act += 1;
    run.loop.stepsInAct = 0;
    run.loop.awakening = Math.min(2, run.loop.awakening + 1);
    run.spirit.awakening = run.loop.awakening;
    if (run.loop.act === 4) {
      run.loop.infiniteMode = true;
      run.loop.travelDrawPile = [];
      run.loop.travelDiscard = [];
    } else {
      run.loop.travelDrawPile = shuffleTravelDeck(run.seed + run.loop.act * 97, run.loop.act);
      run.loop.travelDiscard = [];
    }
    run.loop.travelOffers = [null, null, null];
    for (let i = 0; i < run.loop.travelOffers.length; i += 1) {
      refillOneOffer(run, i);
    }
  }
  // Baron von Boar — wealth bonus: +50 gold per active baron trait after every won encounter
  const baronGold =
    (run.loop.playerTraitIds.includes('baron_base') ? 50 : 0) +
    (run.loop.playerTraitIds.includes('baron_aw0') ? 50 : 0);
  if (baronGold > 0) {
    run.loop.gold += baronGold;
  }

  run.loop.pendingEncounterType = null;
  run.loop.enemyHpMultiplier = 1;
  run.loop.freeCardRerollsThisFight = 0;
  run.loop.retryAvailable = false;
}

export function applyLossRetryChoice(run: RunState, choice: 'enemy_hp_down' | 'free_rerolls'): void {
  if (choice === 'enemy_hp_down') {
    run.loop.enemyHpMultiplier = Math.max(0.25, run.loop.enemyHpMultiplier * 0.9);
    return;
  }
  run.loop.freeCardRerollsThisFight += 3;
}

export interface TravelEventResolution {
  message: string;
  outcome: TravelEventOutcome;
}

export function resolveRandomEvent(run: RunState, content: CardContentService): TravelEventResolution {
  const rng = new SeededRandom(run.seed + run.loop.totalStepsResolved * 41 + run.encounterIndex * 13);
  const eventType = rng.nextInt(8);
  if (eventType === 0) {
    if (run.deck.length > 0) {
      const index = rng.nextInt(run.deck.length);
      const current = run.deck[index]!;
      try {
        const def = content.get(current);
        if (def.merge_to) {
          content.get(def.merge_to);
          const afterId = def.merge_to;
          run.deck[index] = afterId;
          return {
            message: 'Random event: upgraded a random deck card tier.',
            outcome: { kind: 'upgrade', beforeId: current, afterId },
          };
        }
      } catch {
        /* fall through */
      }
      if (current.includes('_t1')) {
        const upgraded = current.replace('_t1', '_t2');
        try {
          content.get(upgraded);
          run.deck[index] = upgraded;
          return {
            message: 'Random event: upgraded a random deck card tier.',
            outcome: { kind: 'upgrade', beforeId: current, afterId: upgraded },
          };
        } catch {
          /* noop */
        }
      }
    }
    return {
      message: 'Random event: no card could be upgraded.',
      outcome: { kind: 'noop', reason: 'no_upgrade' },
    };
  }
  if (eventType === 1) {
    if (run.loop.gold >= 20) {
      run.loop.gold -= 20;
      const paidDraw = CardContentService.loadDefault(
        cardOfferStreamSeed(run.seed, run.loop.totalStepsResolved * 79 + 2),
      );
      const cardId = paidDraw.drawWeighted(run.faction, run.loop.awakening).id;
      run.deck.push(cardId);
      return {
        message: 'Random event: spent 20 gold to add a weighted card.',
        outcome: { kind: 'paid_card', goldSpent: 20, cardId },
      };
    }
    return {
      message: 'Random event: not enough gold for paid draft.',
      outcome: { kind: 'noop', reason: 'not_enough_gold' },
    };
  }
  if (eventType === 2) {
    if (run.loop.hearts < STARTING_HEARTS) {
      run.loop.hearts += 1;
      run.remainingLosses = run.loop.hearts;
      return {
        message: 'Random event: restored 1 heart.',
        outcome: { kind: 'heart_restore', amount: 1, hearts: run.loop.hearts },
      };
    }
    run.loop.gold += 15;
    return {
      message: 'Random event: already full hearts, gained 15 gold.',
      outcome: { kind: 'hearts_full_gold', goldGained: 15, totalGold: run.loop.gold },
    };
  }
  if (eventType === 3) {
    const draftDraw = CardContentService.loadDefault(
      cardOfferStreamSeed(run.seed, run.loop.totalStepsResolved * 79 + 8),
    );
    const offers = [
      draftDraw.drawWeighted(run.faction, run.loop.awakening).id,
      draftDraw.drawWeighted(run.faction, run.loop.awakening).id,
      draftDraw.drawWeighted(run.faction, run.loop.awakening).id,
    ];
    return {
      message: 'Random event: choose one card to add to your deck.',
      outcome: { kind: 'draft_pick', offers },
    };
  }
  if (eventType === 4) {
    if (run.hand.length > 0) {
      const lostIdx = rng.nextInt(run.hand.length);
      const cardId = run.hand[lostIdx]!;
      run.hand.splice(lostIdx, 1);
      return {
        message: 'Random event: lost a random hand card.',
        outcome: { kind: 'lost_hand_card', cardId },
      };
    }
    return {
      message: 'Random event: no hand card to discard.',
      outcome: { kind: 'noop', reason: 'no_hand' },
    };
  }
  if (eventType === 5) {
    const rolled = rollRelicForSource(
      run,
      'event',
      run.seed + run.loop.totalStepsResolved * 61 + run.encounterIndex * 17,
    );
    if (rolled && grantRelic(run, rolled.id)) {
      return {
        message: `Random event: gained relic ${rolled.name}.`,
        outcome: { kind: 'relic_gain', relicId: rolled.id },
      };
    }
    return {
      message: 'Random event: no eligible relic reward.',
      outcome: { kind: 'noop', reason: 'no_relic_available' },
    };
  }
  if (eventType === 6) {
    run.loop.hearts = Math.max(0, run.loop.hearts - 1);
    run.remainingLosses = run.loop.hearts;
    return {
      message: 'Random event: lost 1 heart.',
      outcome: { kind: 'heart_loss', heartsRemaining: run.loop.hearts },
    };
  }
  const lost = Math.min(20, run.loop.gold);
  run.loop.gold = Math.max(0, run.loop.gold - 20);
  return {
    message: 'Random event: lost 20 gold.',
    outcome: { kind: 'gold_loss', amount: lost, totalGold: run.loop.gold },
  };
}

