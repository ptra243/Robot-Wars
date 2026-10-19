import { describe, expect, it } from 'vitest';
import { CardContentService, normalizeCard } from '../core/content';
import { CombatSimulator } from '../core/combat';
import type { CardDef, EffectStep } from '../core/types';
import { makeTestFighter } from './helpers';

const content = CardContentService.loadDefault(7);

function synthCard(id: string, effects: EffectStep[], extras: Partial<CardDef> = {}): CardDef {
  return normalizeCard({
    id,
    name: id,
    faction: 'scavengers',
    neutral: false,
    awakening_min: 0,
    card_tier: 1,
    charge_cost: 0,
    base_damage: 0,
    base_block: 0,
    gain_charge: 0,
    gain_junk: 0,
    gain_core: 0,
    spend_junk: 0,
    spend_core: 0,
    strike_potency_gain: 0,
    shield_potency_gain: 0,
    heal_self: 0,
    tags: [],
    keywords: [],
    effects,
    ...extras,
  });
}

function runSynth(effects: EffectStep[], setup?: (p: ReturnType<typeof makeTestFighter>) => void) {
  const card = synthCard('synth_behavior_t1', effects);
  const svc = new CardContentService(
    new Map([...content.getAll().map((c) => [c.id, c] as const), [card.id, card]]),
    7,
  );
  const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [card.id]);
  player.charge = 99;
  setup?.(player);
  const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
  const result = new CombatSimulator(svc, 1).run({ seed: 1, player, enemy });
  const resolve = result.events.find((e) => e.type === 'resolve' && e.actor === 'Player');
  return { result, snap: resolve?.snapshot?.player, enemySnap: resolve?.snapshot?.enemy, player };
}

describe('EffectStep behaviors (composable graft verbs)', () => {
  it('SelfDamageRespectFloor1 loses HP but not below 1', () => {
    const { snap } = runSynth([{ type: 'SelfDamageRespectFloor1', amount: 100 }], (p) => {
      p.hp = 5;
    });
    expect(snap?.hp).toBe(1);
  });

  it('SelfDamage can reduce to 0', () => {
    const { snap } = runSynth([{ type: 'SelfDamage', amount: 100 }], (p) => {
      p.hp = 5;
    });
    expect(snap?.hp).toBe(0);
  });

  it('GainJunk increases junk', () => {
    const { snap } = runSynth([{ type: 'GainJunk', amount: 3 }]);
    expect(snap?.junk).toBe(3);
  });

  it('ShieldBlock grants block (graft shield rider)', () => {
    const { snap } = runSynth([
      { type: 'SelfDamageRespectFloor1', amount: 4 },
      { type: 'ShieldBlock', baseBlock: 3 },
    ]);
    expect(snap?.hp).toBe(36);
    expect(snap?.block).toBe(3);
  });

  it('HealSelf restores HP up to maxHp', () => {
    const { snap } = runSynth([{ type: 'HealSelf', amount: 10 }], (p) => {
      p.hp = 20;
      p.maxHp = 40;
    });
    expect(snap?.hp).toBe(30);
  });

  it('GainMaxHp raises ceiling without healing', () => {
    const { snap } = runSynth([{ type: 'GainMaxHp', amount: 2 }], (p) => {
      p.hp = 30;
      p.maxHp = 40;
    });
    expect(snap?.maxHp).toBe(42);
    expect(snap?.hp).toBe(30);
  });

  it('Refinance: Scrap Engine always; spend junk for +max HP and 1:1 heal', () => {
    const paid = runSynth(
      [
        { type: 'GainScrapEngine', amount: 1 },
        {
          type: 'BranchIfJunkGte',
          minJunk: 4,
          thenSteps: [
            { type: 'SpendJunk', amount: 4 },
            { type: 'GainMaxHp', amount: 4 },
            { type: 'HealSelf', amount: 4 },
          ],
          elseSteps: [],
        },
        { type: 'DirectHpDamagePerScrapEngine', damagePerEngine: 1, pierce: false },
      ],
      (p) => {
        p.junk = 5;
        p.maxHp = 40;
        p.hp = 20;
      },
    );
    expect(paid.snap?.junk).toBe(1);
    expect(paid.snap?.maxHp).toBe(44);
    expect(paid.snap?.hp).toBe(24);
    expect(paid.enemySnap?.hp).toBe(39);

    const broke = runSynth(
      [
        { type: 'GainScrapEngine', amount: 1 },
        {
          type: 'BranchIfJunkGte',
          minJunk: 4,
          thenSteps: [
            { type: 'SpendJunk', amount: 4 },
            { type: 'GainMaxHp', amount: 4 },
            { type: 'HealSelf', amount: 4 },
          ],
          elseSteps: [],
        },
        { type: 'DirectHpDamagePerScrapEngine', damagePerEngine: 1, pierce: false },
      ],
      (p) => {
        p.junk = 2;
        p.maxHp = 40;
        p.hp = 20;
      },
    );
    expect(broke.snap?.junk).toBe(2);
    expect(broke.snap?.maxHp).toBe(40);
    expect(broke.snap?.hp).toBe(20);
    expect(broke.enemySnap?.hp).toBe(39);
  });

  it('SpendJunk + HealSelf composes Transfusion', () => {
    const { snap } = runSynth(
      [
        { type: 'SpendJunk', amount: 3 },
        { type: 'HealSelf', amount: 6 },
      ],
      (p) => {
        p.junk = 4;
        p.hp = 20;
        p.maxHp = 40;
      },
    );
    expect(snap?.junk).toBe(1);
    expect(snap?.hp).toBe(26);
  });

  it('SetBloodToScrapJunkPerSelfDamage feeds junk from self-damage', () => {
    const { snap } = runSynth(
      [
        { type: 'SetBloodToScrapJunkPerSelfDamage', amount: 1 },
        { type: 'SelfDamageRespectFloor1', amount: 3 },
      ],
      (p) => {
        p.hp = 40;
        p.junk = 0;
      },
    );
    expect(snap?.hp).toBe(37);
    expect(snap?.junk).toBe(3);
  });

  it('SetHeapPadding reduces self-damage while junk is tall', () => {
    const { snap } = runSynth(
      [
        { type: 'SetHeapPadding', minJunk: 4, reduceBy: 1 },
        { type: 'SelfDamageRespectFloor1', amount: 3 },
      ],
      (p) => {
        p.hp = 40;
        p.junk = 4;
      },
    );
    expect(snap?.hp).toBe(38);
  });

  it('SetHeapBallast reduces incoming damage while junk is tall', () => {
    const { result } = runSynth([{ type: 'SetHeapBallast', minJunk: 4, reduceBy: 1 }], (p) => {
      p.junk = 4;
      p.hp = 40;
      p.block = 0;
    });
    const enemyHit = result.events.find((e) => e.type === 'resolve' && e.actor === 'Enemy');
    // Neutral Basic Strike t1 = 2 damage; Ballast −1 → 1 HP lost.
    expect(enemyHit?.snapshot?.player.hp).toBe(39);
  });

  it('SetScrapAnesthetic grants block from self-damage', () => {
    const { snap } = runSynth(
      [
        { type: 'SetScrapAnesthetic', blockPerHpLost: 1, capPerHit: 3 },
        { type: 'SelfDamageRespectFloor1', amount: 5 },
      ],
      (p) => {
        p.hp = 40;
        p.block = 0;
      },
    );
    expect(snap?.hp).toBe(35);
    expect(snap?.block).toBe(3);
  });

  it('ConvertScrapEngines spends engines into hound attack stacks', () => {
    const { snap, result } = runSynth(
      [
        { type: 'GainScrapEngine', amount: 2 },
        { type: 'ConvertScrapEngines', maxEngines: 2, into: 'attack', spendJunk: 3 },
      ],
      (p) => {
        p.junk = 5;
      },
    );
    expect(snap?.junk).toBe(2);
    expect(snap?.scrapHoundAttackStacks).toBe(2);
    expect(snap?.scrapEngineCount).toBeUndefined();
    expect(result.events.some((e) => e.type === 'scrap_hound_summon')).toBe(true);
  });

  it('SetStrikeResolveBonusJunk grants junk after strikes (Dividend)', () => {
    const { snap } = runSynth(
      [
        { type: 'SetStrikeResolveBonusJunk', amount: 1 },
        { type: 'StrikeDamage', baseDamage: 2, pierce: false },
        { type: 'GainScrapEngine', amount: 1 },
      ],
      (p) => {
        p.junk = 0;
      },
    );
    expect(snap?.junk).toBe(1);
  });

  it('SetStrikeResolveBonusJunkIfHpFractionAtMost only while wounded (Anemic)', () => {
    const full = runSynth(
      [
        { type: 'SetStrikeResolveBonusJunkIfHpFractionAtMost', maxHpFraction: 0.5, amount: 1 },
        { type: 'StrikeDamage', baseDamage: 1, pierce: false },
      ],
      (p) => {
        p.hp = 40;
        p.maxHp = 40;
        p.junk = 0;
      },
    );
    expect(full.snap?.junk).toBe(0);

    const hurt = runSynth(
      [
        { type: 'SetStrikeResolveBonusJunkIfHpFractionAtMost', maxHpFraction: 0.5, amount: 1 },
        { type: 'StrikeDamage', baseDamage: 1, pierce: false },
      ],
      (p) => {
        p.hp = 20;
        p.maxHp = 40;
        p.junk = 0;
      },
    );
    expect(hurt.snap?.junk).toBe(1);
  });

  it('BranchIfMissingHpGte picks wounded package (Hollow Frame)', () => {
    const hurt = runSynth(
      [
        {
          type: 'BranchIfMissingHpGte',
          minMissing: 10,
          thenSteps: [{ type: 'DirectHpDamage', baseDamage: 8, pierce: false }],
          elseSteps: [{ type: 'DirectHpDamage', baseDamage: 2, pierce: false }],
        },
      ],
      (p) => {
        p.hp = 25;
        p.maxHp = 40;
      },
    );
    expect(hurt.enemySnap?.hp).toBe(32);

    const full = runSynth(
      [
        {
          type: 'BranchIfMissingHpGte',
          minMissing: 10,
          thenSteps: [{ type: 'DirectHpDamage', baseDamage: 8, pierce: false }],
          elseSteps: [{ type: 'DirectHpDamage', baseDamage: 2, pierce: false }],
        },
      ],
      (p) => {
        p.hp = 40;
        p.maxHp = 40;
      },
    );
    expect(full.enemySnap?.hp).toBe(38);
  });

  it('DirectHpDamagePerScrapEngine scales with installed engines (Dynamo Peal)', () => {
    const { enemySnap } = runSynth([
      { type: 'GainScrapEngine', amount: 2 },
      { type: 'DirectHpDamagePerScrapEngine', damagePerEngine: 3, pierce: false },
    ]);
    expect(enemySnap?.hp).toBe(34);
  });

  it('Scrap Engines grant +1 junk each at the start of your next activation', () => {
    const install = synthCard(
      'synth_engine_t1',
      [{ type: 'GainScrapEngine', amount: 2 }],
      { keywords: [{ type: 'Persistent', value: 1 }] },
    );
    const filler = synthCard('synth_filler_t1', [{ type: 'GainCharge', amount: 0 }]);
    const svc = new CardContentService(
      new Map([
        ...content.getAll().map((c) => [c.id, c] as const),
        [install.id, install],
        [filler.id, filler],
      ]),
      7,
    );
    const player = makeTestFighter(
      'Player',
      ['neutral_basic_strike_t1'],
      [install.id, filler.id, 'neutral_basic_strike_t1', 'neutral_basic_strike_t1', 'neutral_basic_strike_t1'],
      5,
    );
    player.charge = 99;
    player.junk = 0;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null, null, null, null, null], 5);
    const result = new CombatSimulator(svc, 4).run({ seed: 1, player, enemy });
    const ticks = result.events.filter((e) => e.type === 'scrap_engine_tick');
    expect(ticks.length).toBeGreaterThanOrEqual(1);
    expect(ticks.some((e) => e.text.includes('+2 junk'))).toBe(true);
  });

  it('SetFirstCardOfCycleBonusCharge fuels the next cycle opener (Scrap Dynamo)', () => {
    const dynamo = synthCard(
      'synth_dynamo_t1',
      [
        { type: 'SpendJunk', amount: 2 },
        { type: 'SetFirstCardOfCycleBonusCharge', amount: 1 },
        { type: 'GainScrapEngine', amount: 1 },
      ],
      { keywords: [{ type: 'Persistent', value: 1 }] },
    );
    const paid = synthCard('synth_paid_t1', [{ type: 'GainJunk', amount: 1 }], { charge_cost: 1 });
    const svc = new CardContentService(
      new Map([
        ...content.getAll().map((c) => [c.id, c] as const),
        [dynamo.id, dynamo],
        [paid.id, paid],
      ]),
      7,
    );
    // 5 active slots: dynamo, paid, filler×3 — after wrap, paid is first of cycle 2 with +1c from Dynamo
    const player = makeTestFighter(
      'Player',
      ['neutral_basic_strike_t1'],
      [dynamo.id, paid.id, 'neutral_basic_strike_t1', 'neutral_basic_strike_t1', 'neutral_basic_strike_t1'],
      5,
    );
    player.charge = 0;
    player.junk = 2;
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null, null, null, null, null], 5);
    const result = new CombatSimulator(svc, 7).run({ seed: 1, player, enemy });
    const paidResolves = result.events.filter(
      (e) => e.type === 'resolve' && e.actor === 'Player' && e.text.includes('synth_paid_t1'),
    );
    expect(paidResolves.length).toBeGreaterThanOrEqual(1);
    const dynamoTicks = result.events.filter((e) => e.type === 'scrap_dynamo_tick');
    expect(dynamoTicks.length).toBeGreaterThanOrEqual(1);
  });
});
