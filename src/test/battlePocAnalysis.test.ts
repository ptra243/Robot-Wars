import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import { CombatSimulator } from '../core/combat';
import { buildBattleAnalysisSeries } from '../components/poc/battlePocAnalysis';
import { makeTestFighter } from './helpers';

describe('buildBattleAnalysisSeries', () => {
  const content = CardContentService.loadDefault(42);

  it('attributes energy and expose to the card that applied them', () => {
    const player = makeTestFighter(
      'Player',
      ['neutral_capacitor_feed_t1', 'neutral_expose_wiring_t1'],
      ['neutral_capacitor_feed_t1', 'neutral_expose_wiring_t1'],
    );
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
    const series = buildBattleAnalysisSeries(result);
    const energyCat = series.playerStatCategories.find((c) => c.id === 'energy');
    const exposeCat = series.playerStatCategories.find((c) => c.id === 'expose');
    expect(energyCat).toBeTruthy();
    expect(exposeCat).toBeTruthy();
    expect(energyCat!.total).toBeGreaterThan(0);
    expect(exposeCat!.total).toBeGreaterThan(0);
    expect(energyCat!.contributors.some((c) => c.cardId.includes('capacitor'))).toBe(true);
    expect(exposeCat!.contributors.some((c) => c.cardId.includes('expose'))).toBe(true);
  });

  it('keeps Overclock self-damage on the follow-up card, not the Overclock card', () => {
    const player = makeTestFighter(
      'Player',
      ['neutral_overclock_t1', 'core_refactoring_t1'],
      ['neutral_overclock_t1', 'core_refactoring_t1'],
    );
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 1 });
    const series = buildBattleAnalysisSeries(result);
    const selfCat = series.playerStatCategories.find((c) => c.id === 'selfDamage');
    expect(selfCat?.total).toBe(5);
    expect(selfCat?.contributors).toEqual([
      expect.objectContaining({ cardId: 'core_refactoring_t1', value: 5 }),
    ]);
    const overclock = series.playerCardContributions.find((c) => c.cardId === 'neutral_overclock_t1');
    expect(overclock?.selfDamage ?? 0).toBe(0);
  });
});
