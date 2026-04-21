import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import { COMBAT_RULES } from '../core/rules';
import {
  SANDBOX_STARTER_HAND,
  createNewRun,
  loadFatigueDeckFromHand,
  simulateDeckCycleReport,
} from '../core/run';

describe('sandbox run defaults', () => {
  it('starts with starter cards in hand and an empty deck', () => {
    const run = createNewRun(99);
    expect(run.deck).toEqual([]);
    expect(run.hand).toEqual(SANDBOX_STARTER_HAND);
  });

  it('replaces an empty player deck with basic strikes for deck-cycle simulation', () => {
    const run = createNewRun(99);
    const content = CardContentService.loadDefault(99);
    expect(run.deck).toEqual([]);
    simulateDeckCycleReport(run, content);
    expect(run.deck.length).toBe(COMBAT_RULES.queueSize);
    expect(run.deck.every((id) => id === COMBAT_RULES.blankQueueSlotCardId)).toBe(true);
  });

  it('load deck from hand still builds a non-basic deck', () => {
    const run = createNewRun(99);
    const content = CardContentService.loadDefault(99);
    loadFatigueDeckFromHand(run);
    expect(run.deck.some((id) => id !== COMBAT_RULES.blankQueueSlotCardId)).toBe(true);
    const report = simulateDeckCycleReport(run, content);
    expect(report.roundsSimulated).toBeGreaterThan(0);
    expect(report.roundSummaries).toHaveLength(3);
    expect(report.damagePerCombatRound).toBe(
      report.damageDealt / Math.max(1, report.roundsSimulated),
    );
    const roundsCounted = report.roundSummaries.reduce((s, r) => s + r.combatRoundsSpanned, 0);
    expect(roundsCounted).toBe(report.roundsSimulated);
  });
});
