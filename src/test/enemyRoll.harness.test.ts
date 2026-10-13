import { describe, expect, it } from 'vitest';
import { CardContentService, SeededRandom } from '../core/content';
import { rollEnemyLoadout } from '../core/run';

function fingerprint(result: ReturnType<typeof rollEnemyLoadout>): string {
  const picks = result.rollTrace.perRound.slice(0, 6).map((r) => r.pick).join(',');
  const queue = result.filledQueue.join(',');
  const battery = result.rollTrace.batteryFix?.with ?? '-';
  const relic = result.opponentRelicId ?? '-';
  return `${result.theme}|${queue}|${picks}|${battery}|${relic}`;
}

describe('enemyRoll harness', () => {
  const content = CardContentService.loadDefault(1);

  it('golden fingerprints stay stable for representative scenarios', () => {
    const scenarios = [
      {
        name: 'act1-battle-aw0',
        input: {
          act: 1,
          stepsInAct: 1,
          act4BattleIndex: 0,
          encounterIndex: 0,
          nodeType: 'battle' as const,
          enemyAwakening: 0 as const,
          activeQueueSlots: 5,
          basicsBattleRemaining: 0,
          faction: 'scavengers',
          runSeed: 101,
          basicsGate: false,
          themeOverride: 'gathering_strike' as const,
        },
        seed: 11,
        expected:
          'gathering_strike|junk_loader_t1,salvage_strike_t1,neutral_servo_t2,neutral_basic_strike_t1,neutral_gathering_strike_t1|junk_loader_t1,salvage_strike_t1,neutral_gathering_strike_t1,neutral_servo_t1,neutral_servo_t1|-|-',
      },
      {
        name: 'act2-elite-aw1',
        input: {
          act: 2,
          stepsInAct: 2,
          act4BattleIndex: 0,
          encounterIndex: 3,
          nodeType: 'elite' as const,
          enemyAwakening: 1 as const,
          activeQueueSlots: 7,
          basicsBattleRemaining: 0,
          faction: 'scavengers',
          runSeed: 202,
          basicsGate: false,
          themeOverride: 'expose' as const,
        },
        seed: 22,
        expected:
          'expose|neutral_harassing_strike_t2,field_diode_t1,neutral_multi_strike_t2,neutral_multi_strike_t2,neutral_expose_wiring_t2,neutral_expose_wiring_t1,neutral_multi_strike_t2|neutral_expose_wiring_t2,neutral_harassing_strike_t1,neutral_multi_strike_t2,field_diode_t1,neutral_harassing_strike_t1,neutral_harassing_strike_t1|-|charge_start_plus_2',
      },
      {
        name: 'act3-battle-aw1-slotbands',
        input: {
          act: 3,
          stepsInAct: 4,
          act4BattleIndex: 1,
          encounterIndex: 7,
          nodeType: 'battle' as const,
          enemyAwakening: 1 as const,
          activeQueueSlots: 9,
          basicsBattleRemaining: 0,
          faction: 'scavengers',
          runSeed: 303,
          basicsGate: false,
          themeOverride: 'junk_crown' as const,
          programOrderMode: 'actSlotBands' as const,
          a3SlotBandLayout: 'dualCycle' as const,
        },
        seed: 33,
        expected:
          'junk_crown|junk_loader_t2,junk_loader_t1,junk_ladder_t1,salvage_strike_t2,field_diode_t1,strip_mine_t2,neutral_basic_strike_t1,neutral_basic_strike_t1,salvage_strike_t1|junk_loader_t1,field_diode_t1,salvage_strike_t1,strip_mine_t1,salvage_strike_t1,junk_ladder_t1|-|-',
      },
      {
        name: 'act3-boss-aw1',
        input: {
          act: 3,
          stepsInAct: 5,
          act4BattleIndex: 0,
          encounterIndex: 9,
          nodeType: 'boss' as const,
          enemyAwakening: 1 as const,
          activeQueueSlots: 9,
          basicsBattleRemaining: 0,
          faction: 'scavengers',
          runSeed: 404,
          basicsGate: false,
          themeOverride: 'core_factory' as const,
        },
        seed: 44,
        expected:
          'core_factory|neutral_capacitor_feed_t1,core_tap_t1,core_rebirth_t2,core_rebirth_t2,core_refactoring_t2,core_refactoring_t2,core_refactoring_t2,neutral_urgent_repairs_t1,deep_core_tap_t1|core_tap_t1,neutral_urgent_repairs_t1,core_rebirth_t2,neutral_capacitor_feed_t1,core_refactoring_t2,gutter_offering_t1|-|charge_start_plus_2',
      },
    ];

    const actual = scenarios.map((s) => ({
      name: s.name,
      fp: fingerprint(rollEnemyLoadout(s.input, content, new SeededRandom(s.seed))),
    }));
    expect(actual).toEqual(
      scenarios.map((s) => ({
        name: s.name,
        fp: s.expected,
      })),
    );
  });

  it(
    'invariants hold across theme/act/node/awakening matrix',
    () => {
    const themes = ['gathering_strike', 'expose', 'junk_crown', 'junk_aegis', 'core_factory'] as const;
    const nodes = ['battle', 'boss'] as const;
    const acts = [1, 3] as const;
    for (const theme of themes) {
      for (const node of nodes) {
        for (const act of acts) {
          for (const enemyAwakening of [0, 1] as const) {
            const activeQueueSlots = act === 1 ? 5 : 9;
            const out = rollEnemyLoadout(
              {
                act,
                stepsInAct: 2,
                act4BattleIndex: 0,
                encounterIndex: 4,
                nodeType: node,
                enemyAwakening,
                activeQueueSlots,
                basicsBattleRemaining: 0,
                faction: 'scavengers',
                runSeed: 500 + act,
                basicsGate: false,
                themeOverride: theme,
              },
              content,
              new SeededRandom(9000 + act * 101 + enemyAwakening * 7 + node.length),
            );
            expect(out.filledQueue).toHaveLength(activeQueueSlots);
            expect(out.queue).toHaveLength(9);
            expect(out.fatigueDeck.length).toBeGreaterThan(0);
            for (const id of out.filledQueue) {
              const card = content.get(id);
              expect(card.awakening_min).toBeLessThanOrEqual(enemyAwakening);
            }
          }
        }
      }
    }
    },
    20000,
  );

  it(
    'theme distribution remains sane over many seeds',
    () => {
    const counts = new Map<string, number>();
    const trials = 250;
    for (let i = 0; i < trials; i += 1) {
      const out = rollEnemyLoadout(
        {
          act: 2,
          stepsInAct: i % 6,
          act4BattleIndex: 0,
          encounterIndex: i,
          nodeType: 'battle',
          enemyAwakening: (i % 2) as 0 | 1,
          activeQueueSlots: 7,
          basicsBattleRemaining: 0,
          faction: 'scavengers',
          runSeed: 7000 + i,
          basicsGate: false,
        },
        content,
        new SeededRandom(12000 + i * 17),
      );
      counts.set(out.theme, (counts.get(out.theme) ?? 0) + 1);
    }
    const minAllowed = Math.floor(trials * 0.1);
    const maxAllowed = Math.ceil(trials * 0.35);
    for (const c of counts.values()) {
      expect(c).toBeGreaterThanOrEqual(minAllowed);
      expect(c).toBeLessThanOrEqual(maxAllowed);
    }
    },
    20000,
  );
});

