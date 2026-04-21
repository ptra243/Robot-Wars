import { describe, expect, it } from 'vitest';
import { CardContentService, normalizeCard } from '../core/content';
import { CombatSimulator } from '../core/combat';
import { compileLegacyToEffects } from '../core/effects/compileLegacy';
import { COMBAT_RULES } from '../core/rules';
import { buildArenaFromReplaySlice } from '../core/run';
import type { CardDef } from '../core/types';
import { makeTestFighter } from './helpers';

describe('CombatSimulator', () => {
  const content = CardContentService.loadDefault(42);

  it('substitutes Neutral Basic Strike when a queue slot is empty', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [null]);
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const strike = content.get('neutral_basic_strike_t1');
    expect(strike.base_damage).toBe(2);
    const resolveTexts = result.events.filter((e) => e.type === 'resolve').map((e) => e.text);
    expect(resolveTexts.some((t) => t.includes('Basic Strike') || t.includes('neutral'))).toBe(true);
  });

  it('decays carried Shield at each round start (50% retained by default)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_barrier_t1']);
    player.charge = 99;
    const enemy = makeTestFighter(
      'Enemy',
      ['needle_driver_t1'],
      Array.from({ length: COMBAT_RULES.queueSize }, () => 'needle_driver_t1'),
    );
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const roundStarts = result.events.filter((e) => e.type === 'round_start');
    expect(roundStarts.length).toBeGreaterThanOrEqual(2);
    expect(roundStarts[1]!.snapshot?.player.block).toBe(Math.floor(3 * 0.5));
  });

  it('Shield Conditioning uses 25% Shield decay (75% retained) for the rest of battle', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'neutral_shield_conditioning_t1',
      'neutral_barrier_t1',
      'neutral_basic_strike_t1',
    ]);
    player.charge = 99;
    const enemy = makeTestFighter(
      'Enemy',
      ['needle_driver_t1'],
      Array.from({ length: COMBAT_RULES.queueSize }, () => 'needle_driver_t1'),
    );
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const roundStarts = result.events.filter((e) => e.type === 'round_start');
    expect(roundStarts.length).toBeGreaterThanOrEqual(3);
    expect(roundStarts[2]!.snapshot?.player.block).toBe(Math.floor(3 * 0.75));
  });

  it('Shield Reinforcement doubles current block without using potency', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'neutral_barrier_t1',
      'neutral_shield_reinforcement_t1',
    ]);
    player.charge = 99;
    player.potency = 0;
    const enemy = makeTestFighter(
      'Enemy',
      ['needle_driver_t1'],
      Array.from({ length: COMBAT_RULES.queueSize }, () => 'needle_driver_t1'),
    );
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const barrier = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Barrier'),
    );
    expect(barrier?.snapshot?.player.block).toBe(3);
    const reinforcement = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Shield Reinforcement'),
    );
    expect(reinforcement?.snapshot?.player.block).toBe(2);
  });

  it('does not auto-convert junk to bulk after a resolve (junk stacks freely)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_basic_strike_t1']);
    player.junk = 5;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const firstPlayerResolve = result.events.find((e) => e.type === 'resolve' && e.actor === 'Player');
    // 5 start; no round junk drip; Basic Strike does not spend or gain junk → still 5 junk, 0 bulk.
    expect(firstPlayerResolve?.text).toMatch(/J=5.*B=0/);
  });

  it('Gathering Strike adds damage from prior StrikeDamage steps this combat (Multi-strike feeds the tally)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'neutral_multi_strike_t1',
      'neutral_gathering_strike_t1',
    ]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const gatheringResolve = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Gathering Strike'),
    );
    expect(gatheringResolve?.text).toMatch(/dealt=3/);
  });

  it('Needle Driver Strike uses potency on the hit (10 base + potency)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['needle_driver_t1']);
    player.charge = 99;
    player.potency = 10;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const firstPlayerResolve = result.events.find((e) => e.type === 'resolve' && e.actor === 'Player');
    expect(firstPlayerResolve?.text).toMatch(/dealt=20/);
    expect(firstPlayerResolve?.text).toMatch(/Enemy HP=/);
  });

  it('bulk stacks reduce incoming strike damage to HP by 1 per stack (consumed)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_basic_strike_t1']);
    player.charge = 99;
    player.bulkStacks = 2;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], ['neutral_basic_strike_t1']);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const firstEnemyResolve = result.events.find((e) => e.type === 'resolve' && e.actor === 'Enemy');
    expect(firstEnemyResolve?.text).toMatch(/dealt=0/);
    expect(firstEnemyResolve?.snapshot?.player.hp).toBe(40);
    expect(firstEnemyResolve?.snapshot?.player.bulkStacks).toBe(0);
  });

  it('arms thermal fatigue after configured combat rounds', () => {
    const emptyQueue = Array.from({ length: COMBAT_RULES.queueSize }, () => null);
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], emptyQueue);
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], emptyQueue);
    player.hp = 5000;
    enemy.hp = 5000;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 20 });
    const armed = result.events.some((e) => e.type === 'fatigue_armed');
    expect(armed).toBe(true);
  });

  it('FactoryReset replaces the resolved slot with Neutral Basic Strike tier and replay snapshots restore queue', () => {
    const base = content.get('neutral_basic_strike_t1');
    const { effects: _omitEffects, ...baseWithoutEffects } = base;
    const spec: Omit<CardDef, 'effects'> = {
      ...baseWithoutEffects,
      id: 'test_factory_reset_kw',
      name: 'Factory Reset KW',
      merge_to: undefined,
      keywords: [{ type: 'FactoryReset', value: 3 }],
    };
    const testCard: CardDef = normalizeCard({
      ...spec,
      effects: compileLegacyToEffects(normalizeCard({ ...spec, effects: undefined } as CardDef)),
    });
    const map = new Map(content.getAll().map((c) => [c.id, c]));
    map.set(testCard.id, testCard);
    const testContent = new CardContentService(map, 1);

    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [testCard.id]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(testContent, 1);
    const result = sim.run({ seed: 1, player, enemy });

    expect(result.initialSnapshot.playerQueue?.[0]).toBe(testCard.id);

    const firstPlayerResolveIdx = result.events.findIndex(
      (e) => e.type === 'resolve' && e.actor === 'Player',
    );
    expect(firstPlayerResolveIdx).toBeGreaterThanOrEqual(0);
    const afterResolve = result.events[firstPlayerResolveIdx];
    expect(afterResolve.snapshot?.playerQueue?.[0]).toBe('neutral_basic_strike_t3');

    const before = buildArenaFromReplaySlice(result, result.initialSnapshot, []);
    expect(before.player.queue[0]).toBe(testCard.id);

    const after = buildArenaFromReplaySlice(
      result,
      afterResolve.snapshot!,
      result.events.slice(0, firstPlayerResolveIdx + 1),
    );
    expect(after.player.queue[0]).toBe('neutral_basic_strike_t3');
  });

  it('Perpetual Motion grants round-start charge ticks for several rounds', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_perpetual_motion_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const ticks = result.events.filter(
      (e) => e.type === 'perpetual_charge_tick' && e.actor === 'Player',
    );
    expect(ticks.length).toBeGreaterThanOrEqual(1);
  });

  it('Expose adds to strike damage and clears after the attack resolves', () => {
    const player = makeTestFighter(
      'Player',
      ['neutral_basic_strike_t1'],
      ['neutral_expose_wiring_t1', 'neutral_basic_strike_t1'],
    );
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    // One card per fighter per round — need two rounds to play Expose then Basic Strike.
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
    const finishers = result.events.filter((e) => e.type === 'expose_finisher' && e.actor === 'Player');
    expect(finishers.length).toBe(1);
    const cleared = result.events.filter((e) => e.type === 'expose_cleared' && e.actor === 'Player');
    expect(cleared.length).toBe(1);
    expect(result.finalState.enemy.exposeDamage).toBe(0);
  });

  it('Expose Drone Uplink adds opponent Expose on each Continuous tick', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_expose_drone_uplink_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 5 });
    const tags = result.events.filter((e) => e.type === 'expose_drone_tag' && e.actor === 'Enemy');
    expect(tags.length).toBeGreaterThanOrEqual(1);
    expect(tags[0]?.text).toMatch(/Drone Uplink/);
  });

  it('Capitalising Strike consumes enemy Expose for bonus damage and clears it', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_capitalising_strike_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.exposeDamage = 4;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const finishers = result.events.filter((e) => e.type === 'expose_finisher');
    expect(finishers.length).toBe(1);
    expect(result.events.some((e) => e.type === 'expose_cleared')).toBe(true);
    const cap = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Capitalising Strike'),
    );
    expect(cap?.text).toMatch(/dealt=10/);
    expect(result.finalState.enemy.exposeDamage).toBe(0);
  });

  it('Harassing Strike does not clear Expose; Overclock bonus strike clears stacks', () => {
    const player = makeTestFighter(
      'Player',
      ['neutral_harassing_strike_t1', 'neutral_basic_strike_t1'],
      ['neutral_harassing_strike_t1', 'neutral_basic_strike_t1'],
    );
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    enemy.exposeDamage = 4;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 1 });
    expect(result.finalState.enemy.exposeDamage).toBe(0);
  });

  it('Harassing Strike leaves Expose stacks if the Overclock follow-up does not strike', () => {
    const player = makeTestFighter(
      'Player',
      ['neutral_harassing_strike_t1', 'neutral_expose_wiring_t1'],
      ['neutral_harassing_strike_t1', 'neutral_expose_wiring_t1'],
    );
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    enemy.exposeDamage = 4;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 1 });
    expect(result.finalState.enemy.exposeDamage).toBe(7);
  });

  it('Glint Lucky Numbers slot 7 applies Expose to the bonus strike and clears stacks', () => {
    const q = Array.from({ length: COMBAT_RULES.queueSize }, () => null as string | null);
    q[6] = 'neutral_basic_strike_t1';
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], q);
    player.queueCursor = 6;
    player.charge = 99;
    player.traitIds = ['glint_aw1'];
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    enemy.exposeDamage = 4;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 1 });
    expect(result.finalState.enemy.exposeDamage).toBe(0);
    expect(result.events.some((e) => e.type === 'lucky_numbers' && e.text?.includes('slot 7'))).toBe(true);
  });

  it('Junk thresholds use junk held at start of resolution (before on-card gains)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['junk_spigot_t1']);
    player.junk = 2;
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const r = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Junk Spigot'),
    );
    // Snapshot at resolve start is 2 (<4), so the >4 branch does not run — only +1 Energy / +1 Junk from the base line.
    expect(r?.text).toMatch(/EN=100/);
  });

  it('Junk Crown >15 unlock requires optional +4 Energy after paying play cost', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['junk_crown_t1']);
    player.junk = 16;
    player.charge = 4;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const r = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Junk Crown'),
    );
    // Includes Overclock bonus resolve damage; no pile line without +4 spare Energy after the 2 play cost.
    expect(r?.text).toMatch(/dealt=7/);
    expect(r?.text).toMatch(/Enemy HP=33/);
  });

  it('Junk Crown >15 line deals snapshot junk damage when optional Energy is paid', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['junk_crown_t1']);
    player.junk = 16;
    player.charge = 6;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy });
    const r = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Junk Crown'),
    );
    expect(r?.text).toMatch(/dealt=23/);
    expect(r?.text).toMatch(/Enemy HP=17/);
  });
});

describe('CardContentService (new card ids)', () => {
  const content = CardContentService.loadDefault(0);

  it('loads stub scavenger and neutral ids from JSON', () => {
    expect(content.get('salvage_strike_t1').name).toBe('Salvage Strike');
    expect(content.get('strip_mine_t1').spend_junk).toBe(2);
    expect(content.get('junk_recycle_t1').awakening_min).toBe(1);
    expect(content.get('neutral_urgent_repairs_t1').heal_self).toBe(2);
    expect(content.get('neutral_urgent_repairs_t1').charge_cost).toBe(-1);
    expect(content.get('neutral_multi_strike_t1').name).toBe('Multi-strike');
    expect(content.get('neutral_feint_t1').name).toBe('Feint');
    expect(content.get('neutral_perpetual_motion_t1').name).toBe('Perpetual Motion');
  });
});
