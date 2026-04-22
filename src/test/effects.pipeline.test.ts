import { describe, expect, it } from 'vitest';
import { CardContentService, normalizeCard } from '../core/content';
import { CombatSimulator } from '../core/combat';
import { finalizeEffectPipeline, getResolvedEffectPipeline } from '../core/effects/compileLegacy';
import { COMBAT_RULES } from '../core/rules';
import type { CardDef } from '../core/types';
import { makeTestFighter } from './helpers';

/** All printed cards legal at awakening 0 (data-driven baseline for smoke tests). */
function awakening0CardsSorted(content: CardContentService): CardDef[] {
  return content
    .getAll()
    .filter((c) => c.awakening_min === 0)
    .sort((a, b) => a.id.localeCompare(b.id));
}

describe('effect pipeline', () => {
  const content = CardContentService.loadDefault(42);

  describe('Awakening 0 — resolution uses baked effects from data', () => {
    const cards = awakening0CardsSorted(content);

    it('has at least one awakening 0 card from data', () => {
      expect(cards.length).toBeGreaterThan(0);
    });

    it.each(cards.map((c) => [c.id, c] as const))(
      'getResolved matches card.effects for %s',
      (_id, card) => {
        expect(card.effects?.length).toBeGreaterThan(0);
        expect(finalizeEffectPipeline(getResolvedEffectPipeline(card))).toEqual(
          finalizeEffectPipeline([...(card.effects ?? [])]),
        );
      },
    );

    it.each(cards.map((c) => [c.id, c] as const))(
      'combat: %s appears in at least one Player resolve line',
      (_id, card) => {
        const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [card.id]);
        player.charge = 99;
        player.junk = 99;
        player.coreScrap = 99;
        const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
        const sim = new CombatSimulator(content, 1);
        const result = sim.run({ seed: 1, player, enemy });
        const playerResolves = result.events.filter((e) => e.type === 'resolve' && e.actor === 'Player');
        expect(playerResolves.some((e) => e.text.includes(card.name))).toBe(true);
      },
    );
  });

  it('Core Tap: 0 refined scrap only factory-resets (no damage); ≥1 spends and deals 8', () => {
    const sim = new CombatSimulator(content, 1);
    const run = (core: number) => {
      const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['core_tap_t1']);
      player.charge = 99;
      player.coreScrap = core;
      const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
      return sim.run({ seed: 1, player, enemy });
    };
    const firstCoreTapHp = (result: ReturnType<typeof run>) => {
      const ev = result.events.find(
        (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Core Tap'),
      );
      return ev?.snapshot?.enemy.hp;
    };
    const firstCoreTapQueue0 = (result: ReturnType<typeof run>) => {
      const ev = result.events.find(
        (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Core Tap'),
      );
      return ev?.snapshot?.playerQueue?.[0];
    };
    expect(firstCoreTapHp(run(0))).toBe(40);
    expect(firstCoreTapQueue0(run(0))).toBe('neutral_basic_strike_t1');
    expect(firstCoreTapHp(run(1))).toBe(40 - 8);
    expect(firstCoreTapQueue0(run(1))).toBe('neutral_basic_strike_t1');
  });

  it('Core Sacrifice: ≥1 refined scrap spends all for bulk, deals 12, transforms slot; 0 scrap only transforms', () => {
    const sim = new CombatSimulator(content, 1);
    const run = (core: number) => {
      const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['deep_core_tap_t1']);
      player.charge = 99;
      player.coreScrap = core;
      const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
      return sim.run({ seed: 1, player, enemy });
    };
    const sacEv = (result: ReturnType<typeof run>) =>
      result.events.find(
        (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Core Sacrifice'),
      );
    expect(sacEv(run(0))?.snapshot?.enemy.hp).toBe(40);
    expect(sacEv(run(0))?.snapshot?.playerQueue?.[0]).toBe('neutral_basic_strike_t1');
    expect(sacEv(run(3))?.snapshot?.enemy.hp).toBe(40 - 12);
    expect(sacEv(run(3))?.snapshot?.player.coreScrap).toBe(0);
    expect(sacEv(run(3))?.snapshot?.player.bulkStacks).toBe(3);
    expect(sacEv(run(3))?.snapshot?.playerQueue?.[0]).toBe('neutral_basic_strike_t1');
  });

  it('Core Rebirth: gains refined scrap and replaces a Neutral Basic Strike slot with a CoreParts card', () => {
    const sim = new CombatSimulator(content, 42);
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'core_rebirth_t1',
      'neutral_basic_strike_t1',
    ]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const result = sim.run({ seed: 1, player, enemy });
    const ev = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Core Rebirth'),
    );
    expect(ev?.snapshot?.player.coreScrap).toBeGreaterThanOrEqual(1);
    const upgrades = result.events.filter(
      (e) => e.type === 'core_rebirth_queue' && e.actor === 'Player' && e.text.includes('→'),
    );
    expect(upgrades.length).toBeGreaterThanOrEqual(1);
    const q = ev?.snapshot?.playerQueue ?? [];
    expect(q[0]).toBe('neutral_basic_strike_t1');
    const nonBasicNeutral = q.filter(
      (id) => id && !/^neutral_basic_strike_t[123]$/.test(id),
    );
    expect(nonBasicNeutral.length).toBeGreaterThanOrEqual(1);
  });

  it('Core Rebirth+ (tier 2) replaces two Neutral Basic Strike slots when two are present', () => {
    const sim = new CombatSimulator(content, 42);
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'core_rebirth_t2',
      'neutral_basic_strike_t1',
      'neutral_basic_strike_t1',
      ...Array.from({ length: COMBAT_RULES.queueSize - 3 }, () => null),
    ]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const result = sim.run({ seed: 1, player, enemy });
    const ev = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Core Rebirth+'),
    );
    const upgrades = result.events.filter(
      (e) => e.type === 'core_rebirth_queue' && e.actor === 'Player' && e.text.includes('→'),
    );
    expect(upgrades.length).toBeGreaterThanOrEqual(2);
    const q = ev?.snapshot?.playerQueue ?? [];
    expect(q[0]).toBe('neutral_basic_strike_t2');
    const basicCount = q.filter((id) => id === 'neutral_basic_strike_t1').length;
    expect(basicCount).toBe(6);
  });

  it('explicit effects list matches legacy Basic Strike resolution (enemy HP)', () => {
    const base = content.get('neutral_basic_strike_t1');
    const explicit: CardDef = normalizeCard({
      ...base,
      id: 'test_effects_mirror_basic_strike',
      effects: [{ type: 'StrikeDamage', baseDamage: base.base_damage, pierce: false }],
    });

    const map = new Map(content.getAll().map((c) => [c.id, c]));
    map.set(explicit.id, explicit);
    const testContent = new CardContentService(map, 1);

    const runWithQueue = (cardId: string) => {
      const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [cardId]);
      const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
      const sim = new CombatSimulator(testContent, 1);
      return sim.run({ seed: 1, player, enemy });
    };

    const hpLegacy = runWithQueue('neutral_basic_strike_t1').finalState.enemy.hp;
    const hpExplicit = runWithQueue('test_effects_mirror_basic_strike').finalState.enemy.hp;
    expect(hpExplicit).toBe(hpLegacy);
  });
});
