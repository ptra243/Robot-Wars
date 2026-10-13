import { describe, expect, it } from 'vitest';
import { CardContentService, normalizeCard } from '../core/content';
import { CombatSimulator } from '../core/combat';
import { compileLegacyToEffects } from '../core/effects/compileLegacy';
import { COMBAT_RULES } from '../core/rules';
import { simulateForgeDeckMetrics } from '../core/run/forgeDeckSimulation';
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

  it('Persistent cards skip on later program visits after the first resolve', () => {
    const q = Array.from({ length: COMBAT_RULES.queueSize }, () => 'neutral_basic_strike_t1' as string | null);
    q[0] = 'neutral_shield_conditioning_t1';
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], q);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 12 });
    const conditioningResolves = result.events.filter(
      (e) => e.type === 'resolve' && e.text.includes('Shield Conditioning'),
    );
    expect(conditioningResolves.length).toBe(1);
    expect(
      result.events.some((e) => e.type === 'persistent_skip' && e.text.includes('Shield Conditioning')),
    ).toBe(true);
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

  it('ninja base neutral bonuses count as stance activations for activated-stance payoffs', () => {
    const base = content.get('neutral_basic_strike_t1');
    const makePayoff = (
      id: string,
      stance: 'dragon' | 'tiger' | 'bird' | 'tortoise',
    ): CardDef =>
      normalizeCard({
        ...base,
        id,
        name: `Test ${stance} payoff`,
        faction: 'cyberpunk',
        neutral: false,
        charge_cost: 0,
        base_damage: 0,
        effects: [
          {
            type: 'BranchIfActorActivatedStance',
            stance,
            thenSteps: [{ type: 'GainCharge', amount: 5 }],
            elseSteps: [],
          },
        ],
      });
    const cases = [
      { traitId: 'seiryu_base', stance: 'dragon' as const, expectedChargeAfterPayoff: 6 },
      { traitId: 'suzaku_base', stance: 'bird' as const, expectedChargeAfterPayoff: 5 },
      { traitId: 'byakko_base', stance: 'tiger' as const, expectedChargeAfterPayoff: 5 },
      { traitId: 'genbu_base', stance: 'tortoise' as const, expectedChargeAfterPayoff: 5 },
    ];

    for (const c of cases) {
      const payoff = makePayoff(`test_${c.stance}_activated_payoff`, c.stance);
      const map = new Map(content.getAll().map((card) => [card.id, card]));
      map.set(payoff.id, payoff);
      const testContent = new CardContentService(map, 1);
      const player = makeTestFighter(
        'Player',
        ['neutral_basic_strike_t1', payoff.id],
        ['neutral_basic_strike_t1', payoff.id],
      );
      player.charge = 0;
      player.traitIds = [c.traitId];
      const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
      const sim = new CombatSimulator(testContent, 1);
      const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
      const playerResolves = result.events.filter((e) => e.type === 'resolve' && e.actor === 'Player');
      expect(playerResolves).toHaveLength(2);
      expect(playerResolves[1]?.snapshot?.player.charge).toBe(c.expectedChargeAfterPayoff);
    }
  });

  it('Needle Driver deals base hit without junk, then bonus hit when junk is spent', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['needle_driver_t1']);
    player.charge = 99;
    player.potency = 10;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(content, 1);
    const withoutJunk = sim.run({ seed: 1, player: structuredClone(player), enemy: structuredClone(enemy) });
    const withoutJunkResolve = withoutJunk.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player',
    );
    expect(withoutJunkResolve?.text).toMatch(/dealt=13/);

    const withJunkPlayer = structuredClone(player);
    withJunkPlayer.junk = 3;
    const withJunk = sim.run({ seed: 1, player: withJunkPlayer, enemy: structuredClone(enemy) });
    const withJunkResolve = withJunk.events.find((e) => e.type === 'resolve' && e.actor === 'Player');
    expect(withJunkResolve?.text).toMatch(/dealt=20/);
    expect(withJunkResolve?.snapshot?.player.junk).toBe(0);
  });

  it('bulk stacks reduce incoming strike damage to HP by 1 per stack and persist', () => {
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
    expect(firstEnemyResolve?.snapshot?.player.bulkStacks).toBe(2);
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

  it('FactoryReset clears the slot as a blank (empty rematerialize) and replay snapshots restore queue', () => {
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
    expect(afterResolve.snapshot?.playerQueue?.[0]).toBe('neutral_basic_strike_t1');

    const before = buildArenaFromReplaySlice(result, result.initialSnapshot, []);
    expect(before.player.queue[0]).toBe(testCard.id);

    const after = buildArenaFromReplaySlice(
      result,
      afterResolve.snapshot!,
      result.events.slice(0, firstPlayerResolveIdx + 1),
    );
    expect(after.player.queue[0]).toBe('neutral_basic_strike_t1');
  });

  it('FactoryReset rematerializes Tempered Blanks / Multistrike Protocol blank upgrades', () => {
    const base = content.get('neutral_basic_strike_t1');
    const { effects: _omitEffects, ...baseWithoutEffects } = base;
    const spec: Omit<CardDef, 'effects'> = {
      ...baseWithoutEffects,
      id: 'test_factory_reset_blank_relic',
      name: 'Factory Reset Blank Relic',
      merge_to: undefined,
      keywords: [{ type: 'FactoryReset', value: 1 }],
    };
    const testCard: CardDef = normalizeCard({
      ...spec,
      effects: compileLegacyToEffects(normalizeCard({ ...spec, effects: undefined } as CardDef)),
    });
    const map = new Map(content.getAll().map((c) => [c.id, c]));
    map.set(testCard.id, testCard);
    const testContent = new CardContentService(map, 1);

    const tempered = makeTestFighter('Player', ['neutral_basic_strike_t1'], [testCard.id]);
    tempered.traitIds = ['relic_tempered_blanks'];
    tempered.charge = 99;
    const multi = makeTestFighter('Player', ['neutral_basic_strike_t1'], [testCard.id]);
    multi.traitIds = ['relic_multistrike_protocol'];
    multi.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const sim = new CombatSimulator(testContent, 1);

    const temperedResult = sim.run({ seed: 1, player: tempered, enemy: { ...enemy } });
    const temperedIdx = temperedResult.events.findIndex(
      (e) => e.type === 'resolve' && e.actor === 'Player',
    );
    expect(temperedResult.events[temperedIdx]?.snapshot?.playerQueue?.[0]).toBe(
      'neutral_basic_strike_t2',
    );

    const multiResult = sim.run({ seed: 1, player: multi, enemy: { ...enemy } });
    const multiIdx = multiResult.events.findIndex(
      (e) => e.type === 'resolve' && e.actor === 'Player',
    );
    expect(multiResult.events[multiIdx]?.snapshot?.playerQueue?.[0]).toBe('neutral_multi_strike_t1');
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

  it('Overclock bonus resolve keeps damage and self-damage on the follow-up card', () => {
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
    const playerResolves = result.events.filter((e) => e.type === 'resolve' && e.actor === 'Player');
    expect(playerResolves.length).toBeGreaterThanOrEqual(2);
    const overclock = playerResolves.find((e) => e.cardId === 'neutral_overclock_t1');
    const core = playerResolves.find((e) => e.cardId === 'core_refactoring_t1');
    expect(overclock).toBeTruthy();
    expect(core).toBeTruthy();
    expect(overclock!.text).toMatch(/selfDmg=0/);
    expect(core!.text).toMatch(/selfDmg=5/);
    const overclockDealt = Number(/dealt=(\d+)/.exec(overclock!.text)?.[1] ?? '0');
    const coreDealt = Number(/dealt=(\d+)/.exec(core!.text)?.[1] ?? '0');
    expect(overclockDealt).toBe(0);
    expect(coreDealt).toBeGreaterThanOrEqual(0);
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
    // Crown metrics only — Overclock follow-up is a separate resolve (Basic Strike +2).
    expect(r?.text).toMatch(/dealt=5/);
    expect(r?.text).toMatch(/Enemy HP=35/);
    const bonus = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.cardId === 'neutral_basic_strike_t1',
    );
    expect(bonus?.text).toMatch(/dealt=2/);
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
    expect(r?.text).toMatch(/dealt=21/);
    expect(r?.text).toMatch(/Enemy HP=19/);
    const bonus = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.cardId === 'neutral_basic_strike_t1',
    );
    expect(bonus?.text).toMatch(/dealt=2/);
  });

  it('Rust Ranger Aw0 converts Basic Strike with junk and forces a stall next activation', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_basic_strike_t1']);
    player.charge = 99;
    player.junk = 4;
    player.traitIds = ['rust_ranger_aw0'];
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
    const firstPlayerResolve = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Basic Strike'),
    );
    expect(firstPlayerResolve?.text).toMatch(/dealt=6/);
    expect(firstPlayerResolve?.snapshot?.player.junk).toBe(0);
    const stunnedStall = result.events.find((e) => e.type === 'stunned_stall' && e.actor === 'Player');
    expect(stunnedStall).toBeDefined();
  });

  it('Weaken reduces outgoing enemy damage and decays after enemy turns', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_static_clamp_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], ['neutral_basic_strike_t1']);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
    const enemyRound1Resolve = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Enemy' && e.round === 1,
    );
    expect(enemyRound1Resolve?.text).toMatch(/dealt=0/);
    const enemyRound2Resolve = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Enemy' && e.round === 2,
    );
    expect(enemyRound2Resolve?.text).toMatch(/dealt=1/);
    expect(result.finalState.enemy.weakenStacks).toBe(0);
  });

  it('Delayed Burst resolves at the configured round delay', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_delayed_burst_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 3 });
    const delayedResolve = result.events.find(
      (e) => e.type === 'delayed_resolve' && e.actor === 'Player' && e.round === 3,
    );
    expect(delayedResolve).toBeDefined();
    const enemyHpAtRoundStart3 = result.events.find(
      (e) => e.type === 'round_start' && e.round === 3,
    )?.snapshot?.enemy.hp;
    expect(enemyHpAtRoundStart3).toBe(38);
    expect(delayedResolve?.snapshot?.enemy.hp).toBe(32);
  });

  it('Overdrive Slam applies self-stun and stalls next player activation', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['neutral_overdrive_slam_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
    const stunnedStall = result.events.find((e) => e.type === 'stunned_stall' && e.actor === 'Player');
    expect(stunnedStall).toBeDefined();
  });

  it('Virus ticks at start of infected fighter turn and appears in snapshots', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['ninja_tortoise_virus_pulse_t1']);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 1 });
    const virusTick = result.events.find((e) => e.type === 'virus_tick' && e.actor === 'Enemy');
    expect(virusTick).toBeDefined();
    expect(virusTick?.snapshot?.enemy.virusStacks).toBeGreaterThanOrEqual(1);
    expect(virusTick?.snapshot?.enemy.hp).toBe(COMBAT_RULES.startingHp - 3);
  });

  it('forge sim applies Rust Ranger base junk cap', () => {
    const queue = Array.from({ length: COMBAT_RULES.queueSize }, () => 'junk_loader_t3');
    const report = simulateForgeDeckMetrics(
      content,
      1,
      queue,
      ['junk_loader_t3'],
      ['rust_ranger_base'],
    );
    const maxJunkAtRoundStart = Math.max(...report.rounds.map((r) => r.junk));
    expect(maxJunkAtRoundStart).toBeLessThanOrEqual(5);
  });

  it('Celestial Formation deals 5 damage per activated stance this battle', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'ninja_dragon_charge_t1',
      'ninja_tiger_mark_t1',
      'ninja_celestial_formation_t1',
    ]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 0;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 3 });
    const ev = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Celestial Formation'),
    );
    expect(ev?.text).toMatch(/dealt=10/);
  });

  it('Taiji Formation only fires lines for stances activated this battle', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], ['ninja_taiji_formation_t1']);
    player.charge = 99;
    player.activatedDragonThisCombat = true;
    player.activatedTortoiseThisCombat = true;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 0;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 1 });
    const ev = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Taiji Formation'),
    );
    expect(ev?.text).toMatch(/dealt=6/);
    expect(ev?.snapshot?.player.block).toBe(6);
  });

  it('Masterful Form switches to the next queued card stance (Plague Shell applies Virus)', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'ninja_masterful_form_t1',
      'ninja_tortoise_virus_t1',
    ]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 0;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 2 });
    const plague = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Plague Shell'),
    );
    expect(plague).toBeDefined();
    expect(plague?.snapshot?.enemy.virusStacks).toBeGreaterThanOrEqual(2);
  });

  it('Clockwork Sequence 2 only triggers after Sequence 1 and breaks on non-clockwork cards', () => {
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [
      'clockwork_song_iron_intro_t1',
      'clockwork_song_iron_verse_t1',
      'neutral_basic_strike_t1',
      'clockwork_song_iron_verse_t1',
    ]);
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 4 });
    const resolves = result.events.filter((e) => e.type === 'resolve' && e.actor === 'Player');
    expect(resolves[1]?.text).toMatch(/dealt=7/);
    expect(resolves[3]?.text).toMatch(/dealt=3/);
  });

  it('Clockwork Prime Faith buffs direct damage on prime slots only', () => {
    const q = Array.from({ length: COMBAT_RULES.queueSize }, () => null as string | null);
    q[2] = 'clockwork_prime_faith_t1';
    q[4] = 'clockwork_prime_interdict_t1';
    const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], q);
    player.queueCursor = 2;
    player.charge = 99;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    enemy.charge = 99;
    const sim = new CombatSimulator(content, 1);
    const result = sim.run({ seed: 1, player, enemy }, { stopAfterRounds: 3 });
    const primeFaithResolve = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Prime Faith'),
    );
    const interdictResolve = result.events.find(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('Prime Interdict'),
    );
    expect(result.finalState.player.faithStacks).toBe(1);
    expect(interdictResolve?.text).toMatch(/dealt=8/);
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
    expect(content.get('neutral_static_clamp_t1').name).toBe('Static Clamp');
    expect(content.get('neutral_delayed_burst_t1').name).toBe('Delayed Burst');
    expect(content.get('neutral_overdrive_slam_t1').name).toBe('Overdrive Slam');
    expect(content.get('clockwork_song_iron_intro_t1').faction).toBe('clockwork');
    expect(content.get('clockwork_prime_consecration_t1').awakening_min).toBe(1);
  });
});
