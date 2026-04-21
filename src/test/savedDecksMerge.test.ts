import { describe, expect, it } from 'vitest';
import { cloneRun, createNewRun } from '../core/run';
import { mergePayloadIntoRunForEditTarget } from '../ui/savedDecksStorage';
import type { SavedDeckPayload } from '../core/types';

describe('mergePayloadIntoRunForEditTarget', () => {
  it('enemy edit: uses plannedQueue when saved enemyPlannedQueue is all null', () => {
    const run = createNewRun(1);
    const payload: SavedDeckPayload = {
      deck: ['a'],
      hand: ['b'],
      plannedQueue: ['card_a', 'card_b', null, null, null, null, null, null, null],
      enemyPlannedQueue: Array.from({ length: 9 }, () => null),
      sandboxActiveQueueSlots: 9,
      sandboxPlayerCoreScrap: 0,
      sandboxEnemyCoreScrap: 3,
    };
    const merged = cloneRun(run);
    mergePayloadIntoRunForEditTarget(merged, payload, 'enemy');
    expect(merged.enemyPlannedQueue).toEqual(payload.plannedQueue);
    expect(merged.sandboxEnemyCoreScrap).toBe(3);
    expect(merged.plannedQueue).toEqual(run.plannedQueue);
    expect(merged.deck).toEqual(run.deck);
  });

  it('enemy edit: keeps enemyPlannedQueue from payload when any slot is set', () => {
    const run = createNewRun(1);
    const payload: SavedDeckPayload = {
      deck: ['a'],
      hand: ['b'],
      plannedQueue: Array.from({ length: 9 }, () => 'player_only'),
      enemyPlannedQueue: ['e1', null, null, null, null, null, null, null, null],
      sandboxActiveQueueSlots: 9,
      sandboxPlayerCoreScrap: 0,
      sandboxEnemyCoreScrap: 0,
    };
    const merged = cloneRun(run);
    mergePayloadIntoRunForEditTarget(merged, payload, 'enemy');
    expect(merged.enemyPlannedQueue[0]).toBe('e1');
    expect(merged.enemyPlannedQueue.slice(1).every((s) => s === null)).toBe(true);
  });
});
