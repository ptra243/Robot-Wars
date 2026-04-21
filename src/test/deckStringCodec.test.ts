import { describe, expect, it } from 'vitest';
import { decodeDeckString, encodeDeckPayload, encodeDeckString, savedDeckPayloadFromRun } from '../core/run';
import type { RunState } from '../core/types';

function minimalRun(overrides: Partial<RunState> = {}): RunState {
  return {
    seed: 1,
    remainingLosses: 3,
    encounterIndex: 0,
    faction: 'scavengers',
    spirit: { id: 's', awakening: 0, spiritXp: 0 },
    deck: ['neutral_basic_strike_t1', 'salvage_strike_t1'],
    hand: ['junk_loader_t1'],
    plannedQueue: ['salvage_mantle_t1', null, 'neutral_basic_strike_t1'],
    enemyPlannedQueue: Array.from({ length: 9 }, () => null),
    sandboxActiveQueueSlots: 9,
    sandboxPlayerCoreScrap: 0,
    sandboxEnemyCoreScrap: 0,
    loop: {
      act: 1,
      stepsInAct: 0,
      totalStepsResolved: 0,
      awakening: 0,
      playerHp: 40,
      playerHpMax: 40,
      hearts: 3,
      gold: 50,
      rerolls: 3,
      reshufflesRemaining: 2,
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
    ...overrides,
  };
}

describe('deckStringCodec', () => {
  it('encodeDeckPayload matches encodeDeckString for the same snapshot', () => {
    const run = minimalRun();
    expect(encodeDeckPayload(savedDeckPayloadFromRun(run))).toBe(encodeDeckString(run));
  });

  it('round-trips deck state with version prefix RWDB1', () => {
    const run = minimalRun();
    const code = encodeDeckString(run);
    expect(code.startsWith('RWDB1.')).toBe(true);
    const back = decodeDeckString(code);
    expect(back).not.toBeNull();
    expect(back!.deck).toEqual(run.deck);
    expect(back!.hand).toEqual(run.hand);
    expect(back!.plannedQueue).toEqual(run.plannedQueue);
    expect(back!.enemyPlannedQueue).toEqual(run.enemyPlannedQueue);
    expect(back!.sandboxActiveQueueSlots).toBe(9);
  });

  it('rejects wrong version', () => {
    expect(decodeDeckString('RWDB99.eyJ2Ijo5OSwicCI6e319')).toBeNull();
  });

  it('rejects garbage', () => {
    expect(decodeDeckString('not-a-code')).toBeNull();
    expect(decodeDeckString('')).toBeNull();
  });
});
