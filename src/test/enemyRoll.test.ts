import { describe, expect, it } from 'vitest';
import { CardContentService, SeededRandom } from '../core/content';
import { getPoolSlice, isFreeEnergyGeneratorInPool, unionPoolIds } from '../core/run/opponentDecks';
import type { OpponentCardRole } from '../core/run/opponentDecks';
import { isLegalEnemyCard } from '../core/run/opponentCardWeights';
import {
  rollEnemyLoadout,
  activeQueueSlotsForAct,
  mergeAfterDraft,
  ensureOpponentBatteryInProgram,
  ensureHpDamageInProgram,
  cardCanDealEnemyHpDamage,
  orderOpponentProgramByHeuristic,
  orderOpponentProgramActSlotBands,
  orderOpponentProgramThreeBands,
  slotBandMembershipPerIndex,
  A3_LAYOUT_BY_THEME,
  preferredA3LayoutForTheme,
  createNewRun,
  prepareEnemyForCombat,
} from '../core/run';

describe('rollEnemyLoadout', () => {
  const content = CardContentService.loadDefault(1);

  it('is deterministic for fixed input + rng seed bitstream', () => {
    const input = {
      act: 1,
      stepsInAct: 2,
      act4BattleIndex: 0,
      encounterIndex: 0,
      nodeType: 'battle' as const,
      enemyAwakening: 0 as const,
      activeQueueSlots: 5,
      basicsBattleRemaining: 0,
      faction: 'scavengers',
      runSeed: 123,
      basicsGate: false,
      themeOverride: 'gathering_strike' as const,
    };
    const a = rollEnemyLoadout(input, content, new SeededRandom(999));
    const b = rollEnemyLoadout(input, content, new SeededRandom(999));
    expect(a.filledQueue).toEqual(b.filledQueue);
    expect(a.theme).toBe('gathering_strike');
  });

  it('basics gate fills queue with basic strike program', () => {
    const r = rollEnemyLoadout(
      {
        act: 1,
        stepsInAct: 0,
        act4BattleIndex: 0,
        encounterIndex: 0,
        nodeType: 'battle',
        enemyAwakening: 0,
        activeQueueSlots: 5,
        basicsBattleRemaining: 1,
        faction: 'scavengers',
        runSeed: 1,
        basicsGate: true,
      },
      content,
      new SeededRandom(1),
    );
    expect(r.rollTrace.earlyBasics).toBe(true);
    expect(r.filledQueue.length).toBe(5);
    expect(r.filledQueue.every((id) => id === 'neutral_basic_strike_t1')).toBe(true);
  });

  it('output queue length matches activeQueueSlots', () => {
    const r = rollEnemyLoadout(
      {
        act: 2,
        stepsInAct: 3,
        act4BattleIndex: 0,
        encounterIndex: 1,
        nodeType: 'elite',
        enemyAwakening: 1,
        activeQueueSlots: 7,
        basicsBattleRemaining: 0,
        faction: 'scavengers',
        runSeed: 42,
        themeOverride: 'expose',
        basicsGate: false,
      },
      content,
      new SeededRandom(42),
    );
    expect(r.filledQueue.length).toBe(7);
  });

  it('draftRoundOverride controls draft round count', () => {
    const base = {
      act: 2,
      stepsInAct: 3,
      act4BattleIndex: 0,
      encounterIndex: 1,
      nodeType: 'battle' as const,
      enemyAwakening: 1 as const,
      activeQueueSlots: 7,
      basicsBattleRemaining: 0,
      faction: 'scavengers',
      runSeed: 42,
      themeOverride: 'gathering_strike' as const,
      basicsGate: false,
    };
    const a = rollEnemyLoadout(
      { ...base, draftRoundOverride: 3 },
      content,
      new SeededRandom(99),
    );
    const b = rollEnemyLoadout(
      { ...base, draftRoundOverride: 14 },
      content,
      new SeededRandom(99),
    );
    expect(a.rollTrace.draftRounds).toBe(3);
    expect(a.rollTrace.perRound.length).toBe(3);
    expect(b.rollTrace.draftRounds).toBe(14);
    expect(b.rollTrace.perRound.length).toBe(14);
  });

  it('Aw0 never slots awakening_min > 0 for scavenger cards', () => {
    const r = rollEnemyLoadout(
      {
        act: 1,
        stepsInAct: 0,
        act4BattleIndex: 0,
        encounterIndex: 0,
        nodeType: 'battle',
        enemyAwakening: 0,
        activeQueueSlots: 5,
        basicsBattleRemaining: 0,
        faction: 'scavengers',
        runSeed: 5,
        basicsGate: false,
      },
      content,
      new SeededRandom(777),
    );
    for (const id of r.filledQueue) {
      expect(content.get(id).awakening_min).toBe(0);
    }
  });
});

describe('activeQueueSlotsForAct', () => {
  it('returns 5 / 7 / 9 by act', () => {
    expect(activeQueueSlotsForAct(1)).toBe(5);
    expect(activeQueueSlotsForAct(2)).toBe(7);
    expect(activeQueueSlotsForAct(3)).toBe(9);
    expect(activeQueueSlotsForAct(4)).toBe(9);
  });
});

describe('ensureOpponentBatteryInProgram', () => {
  const content = CardContentService.loadDefault(1);

  it('injects battery at the first (left) oustable slot', () => {
    const slice = getPoolSlice('gathering_strike', 'normal', 0);
    const pool = unionPoolIds(slice).filter((id) => isLegalEnemyCard(id, 'scavengers', 0, content));
    const line = [
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
      'neutral_multi_strike_t1',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
    ];
    const r = ensureOpponentBatteryInProgram(
      line,
      slice,
      pool,
      content,
      'scavengers',
      0,
      new SeededRandom(0),
    );
    expect(r.injected).not.toBeNull();
    expect(r.injected?.at).toBe(0);
  });

  it('adds a 0-cost net-charge card when the line has spend and no battery', () => {
    const slice = getPoolSlice('gathering_strike', 'normal', 0);
    const pool = unionPoolIds(slice).filter((id) => isLegalEnemyCard(id, 'scavengers', 0, content));
    const line = [
      'neutral_multi_strike_t1',
      'salvage_strike_t1',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
    ];
    const r = ensureOpponentBatteryInProgram(
      line,
      slice,
      pool,
      content,
      'scavengers',
      0,
      new SeededRandom(0),
    );
    expect(r.injected).not.toBeNull();
    if (r.injected) {
      expect(isFreeEnergyGeneratorInPool(content.get(r.injected.with))).toBe(true);
    }
    expect(r.next.some((id) => isFreeEnergyGeneratorInPool(content.get(id)))).toBe(true);
  });
});

describe('ensureHpDamageInProgram', () => {
  const content = CardContentService.loadDefault(1);

  it('replaces first oustable slot when program has no enemy HP damage lines', () => {
    const slice = getPoolSlice('expose', 'normal', 1);
    const pool = unionPoolIds(slice).filter((id) => isLegalEnemyCard(id, 'scavengers', 1, content));
    const final = Array.from({ length: 5 }, () => 'gutter_offering_t1');
    const out = ensureHpDamageInProgram(
      final,
      slice,
      pool,
      content,
      'scavengers',
      1,
      new SeededRandom(0),
    );
    expect(out.some((id) => cardCanDealEnemyHpDamage(id, content))).toBe(true);
    expect(cardCanDealEnemyHpDamage(out[0]!, content)).toBe(true);
  });
});

describe('slotBandMembershipPerIndex', () => {
  it('uses theme-tuned default act3 layout recommendations', () => {
    expect(A3_LAYOUT_BY_THEME.expose).toBe('wide');
    expect(A3_LAYOUT_BY_THEME.gathering_strike).toBe('dualCycle');
    expect(A3_LAYOUT_BY_THEME.junk_crown).toBe('dualCycle');
    expect(preferredA3LayoutForTheme('expose')).toBe('wide');
    expect(preferredA3LayoutForTheme('core_factory')).toBe('wide');
    expect(preferredA3LayoutForTheme('gathering_strike')).toBe('dualCycle');
    expect(preferredA3LayoutForTheme('junk_crown')).toBe('dualCycle');
  });

  it('A1 (5) overlaps early/middle and middle/late as in the plan', () => {
    const m = slotBandMembershipPerIndex(1, 5, 'wide');
    expect([...m.get(0)!].sort()).toEqual(['early']);
    expect([...m.get(1)!].sort()).toEqual(['early', 'middle']);
    expect([...m.get(2)!].sort()).toEqual(['early', 'middle']);
    expect([...m.get(3)!].sort()).toEqual(['late', 'middle']);
    expect([...m.get(4)!].sort()).toEqual(['late']);
  });

  it('A2 (7) uses late on the last two slots', () => {
    const m = slotBandMembershipPerIndex(2, 7, 'wide');
    expect(m.get(5)!.has('late')).toBe(true);
    expect(m.get(6)!.has('late')).toBe(true);
    expect(m.get(4)!.has('middle')).toBe(true);
  });

  it('A3 wide (9) triple-overlaps the bridge slots', () => {
    const m = slotBandMembershipPerIndex(3, 9, 'wide');
    expect([...m.get(2)!].sort()).toEqual(['early', 'middle']);
    expect([...m.get(5)!].sort()).toEqual(['late', 'middle']);
  });

  it('A3 dualCycle gives two local late beats at idx 3 and 8', () => {
    const m = slotBandMembershipPerIndex(3, 9, 'dualCycle');
    expect(m.get(3)!.has('late')).toBe(true);
    expect(m.get(8)!.has('late')).toBe(true);
    expect(m.get(1)!.has('early') && m.get(1)!.has('middle')).toBe(true);
  });
});

describe('orderOpponentProgramActSlotBands', () => {
  const content = CardContentService.loadDefault(1);
  const pay = new Set<string>();
  const role: Record<string, OpponentCardRole> = {};

  it('places a free battery in an early-biased slot when possible', () => {
    const program = [
      'neutral_overdrive_slam_t1',
      'neutral_capacitor_feed_t1',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
    ];
    const out = orderOpponentProgramActSlotBands(
      program,
      1,
      5,
      content,
      pay,
      role,
      'battle',
      'wide',
    );
    expect(out[0]).toBe('neutral_capacitor_feed_t1');
  });

  it('preserves multiset vs three-band concat (same cards, possibly different order)', () => {
    const slice = getPoolSlice('gathering_strike', 'normal', 0);
    const payoffSet = new Set(slice.payoffIds ?? []);
    const prog = [
      'neutral_capacitor_feed_t1',
      'neutral_multi_strike_t1',
      'neutral_gathering_strike_t1',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
    ];
    const three = orderOpponentProgramThreeBands(prog, content, payoffSet, slice.cardRoleById);
    const slot = orderOpponentProgramActSlotBands(
      prog,
      1,
      5,
      content,
      payoffSet,
      slice.cardRoleById ?? {},
      'battle',
      'wide',
    );
    expect([...three].sort()).toEqual([...slot].sort());
  });
});

describe('rollEnemyLoadout programOrderMode', () => {
  const content = CardContentService.loadDefault(1);

  it('same draft picks but order mode only changes final filledQueue arrangement', () => {
    const base = {
      act: 1,
      stepsInAct: 1,
      act4BattleIndex: 0,
      encounterIndex: 2,
      nodeType: 'battle' as const,
      enemyAwakening: 0 as const,
      activeQueueSlots: 5,
      basicsBattleRemaining: 0,
      faction: 'scavengers',
      runSeed: 2026,
      themeOverride: 'gathering_strike' as const,
      basicsGate: false,
      draftRoundOverride: 8,
    };
    const a = rollEnemyLoadout(
      { ...base, programOrderMode: 'actSlotBands' },
      content,
      new SeededRandom(55),
    );
    const b = rollEnemyLoadout(
      { ...base, programOrderMode: 'threeBandConcat' },
      content,
      new SeededRandom(55),
    );
    expect(JSON.stringify(a.rollTrace.perRound)).toBe(JSON.stringify(b.rollTrace.perRound));
    expect(a.filledQueue.length).toBe(b.filledQueue.length);
  });

  it('uses theme default A3 layout when a3SlotBandLayout is omitted', () => {
    const base = {
      act: 3,
      stepsInAct: 4,
      act4BattleIndex: 0,
      encounterIndex: 5,
      nodeType: 'battle' as const,
      enemyAwakening: 0 as const,
      activeQueueSlots: 9,
      basicsBattleRemaining: 0,
      faction: 'scavengers',
      runSeed: 2026,
      themeOverride: 'junk_crown' as const,
      basicsGate: false,
      draftRoundOverride: 18,
      programOrderMode: 'actSlotBands' as const,
    };
    const implicit = rollEnemyLoadout(base, content, new SeededRandom(77));
    const explicit = rollEnemyLoadout(
      { ...base, a3SlotBandLayout: 'dualCycle' as const },
      content,
      new SeededRandom(77),
    );
    expect(implicit.filledQueue).toEqual(explicit.filledQueue);
  });
});

describe('mergeAfterDraft', () => {
  const c = CardContentService.loadDefault(1);
  it('coalesces 2×t1 to t2 when data supports', () => {
    const out = mergeAfterDraft(
      ['neutral_basic_strike_t1', 'neutral_basic_strike_t1'],
      c,
    );
    expect(out.length).toBe(1);
    expect(out[0]).toBe('neutral_basic_strike_t2');
  });
});

describe('orderOpponentProgramByHeuristic', () => {
  const content = CardContentService.loadDefault(1);

  it('pushes batteries left and finishers/high-cost cards right', () => {
    const queue = [
      'neutral_overdrive_slam_t1',
      'neutral_basic_strike_t1',
      'neutral_capacitor_feed_t1',
      'neutral_multi_strike_t2',
    ];
    const out = orderOpponentProgramByHeuristic(
      queue,
      queue.length,
      content,
      new Set(['neutral_overdrive_slam_t1']),
    );
    expect(out[0]).toBe('neutral_capacitor_feed_t1');
    expect(out[out.length - 1]).toBe('neutral_overdrive_slam_t1');
    expect(out.indexOf('neutral_multi_strike_t2')).toBeGreaterThan(out.indexOf('neutral_basic_strike_t1'));
  });
});

describe('prepareEnemyForCombat', () => {
  const content = CardContentService.loadDefault(1);

  it('uses basic strikes for first 2 battles, then generates from themes', () => {
    const run = createNewRun(123);
    run.loop.pendingEncounterType = 'battle';

    prepareEnemyForCombat(run, content);
    expect(run.loop.earlyBattleBasicsRemaining).toBe(1);
    const act1Slots = activeQueueSlotsForAct(1);
    expect(run.enemyPlannedQueue.slice(0, act1Slots).every((id) => id === 'neutral_basic_strike_t1')).toBe(true);

    // Simulate combat setup consuming the prepared fatigue deck for this encounter.
    run.combatEnemyFatigueDeck = null;
    run.encounterIndex += 1;
    prepareEnemyForCombat(run, content);
    expect(run.loop.earlyBattleBasicsRemaining).toBe(0);
    expect(run.enemyPlannedQueue.slice(0, act1Slots).every((id) => id === 'neutral_basic_strike_t1')).toBe(true);

    run.combatEnemyFatigueDeck = null;
    run.encounterIndex += 1;
    prepareEnemyForCombat(run, content);
    expect(run.loop.earlyBattleBasicsRemaining).toBe(0);
    expect(run.enemyPlannedQueue.slice(0, act1Slots).some((id) => id !== 'neutral_basic_strike_t1')).toBe(true);
  });
});
