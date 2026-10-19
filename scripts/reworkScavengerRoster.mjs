import fs from 'fs';

const aw0Path = 'src/data/cards/scavengers/awakening0.json';
const aw1Path = 'src/data/cards/scavengers/awakening1.json';
const aw0 = JSON.parse(fs.readFileSync(aw0Path, 'utf8'));
const aw1 = JSON.parse(fs.readFileSync(aw1Path, 'utf8'));

const cutAw0 = new Set(['sacrif_lumen', 'sacrif_spike', 'sacrif_probe', 'sacrif_tether']);
const cutAw1 = new Set(['sacrif_cinder', 'sacrif_forge', 'sacrif_suture']);

function baseId(id) {
  return id.replace(/_t[123]$/, '');
}

function retargetPlate(card) {
  const tier = card.card_tier;
  const block = tier === 3 ? 6 : tier === 2 ? 5 : 4;
  const junk = tier === 3 ? 2 : 1;
  return {
    ...card,
    name: tier === 1 ? 'Plated Cut' : tier === 2 ? 'Plated Cut+' : 'Plated Cut++',
    tags: ['Shield', 'Junk'],
    keywords: [],
    effects: [
      { type: 'SelfDamageRespectFloor1', amount: 4 },
      { type: 'GainJunk', amount: junk },
      { type: 'ShieldBlock', baseBlock: block },
      { type: 'DirectHpDamage', baseDamage: tier === 3 ? 3 : 2, pierce: false },
    ],
  };
}

function buffGutter(card) {
  const tier = card.card_tier;
  const shield = tier === 3 ? 3 : 2;
  const junk = tier === 3 ? 5 : tier === 2 ? 4 : 3;
  return {
    ...card,
    awakening_min: 0,
    charge_cost: 0,
    tags: ['Shield', 'Junk'],
    effects: [
      { type: 'SelfDamageRespectFloor1', amount: 3 },
      { type: 'ShieldBlock', baseBlock: shield },
      { type: 'GainJunk', amount: junk },
    ],
  };
}

function buffRift(card) {
  const tier = card.card_tier;
  const dmg = tier === 3 ? 9 : tier === 2 ? 8 : 7;
  const shield = tier === 3 ? 3 : 2;
  const junk = tier === 3 ? 3 : 2;
  return {
    ...card,
    name: tier === 1 ? 'Glass Rift' : tier === 2 ? 'Glass Rift+' : 'Glass Rift++',
    awakening_min: 0,
    charge_cost: 0,
    tags: ['Direct', 'Shield', 'Junk'],
    effects: [
      { type: 'SelfDamage', amount: 4 },
      { type: 'ShieldBlock', baseBlock: shield },
      { type: 'GainJunk', amount: junk },
      { type: 'DirectHpDamage', baseDamage: dmg, pierce: false },
    ],
  };
}

const moveFromAw1 = [];
aw1.cards = aw1.cards.filter((c) => {
  const b = baseId(c.id);
  if (cutAw1.has(b)) return false;
  if (b === 'gutter_offering' || b === 'sacrif_rift') {
    moveFromAw1.push(b === 'gutter_offering' ? buffGutter(c) : buffRift(c));
    return false;
  }
  return true;
});

aw0.cards = aw0.cards
  .filter((c) => !cutAw0.has(baseId(c.id)))
  .map((c) => (baseId(c.id) === 'sacrif_plate' ? retargetPlate(c) : c));

aw0.cards.push(...moveFromAw1);

function mkTier(base, name, aw, build) {
  return [1, 2, 3].map((tier) => {
    const card = build(tier);
    return {
      id: `${base}_t${tier}`,
      name: tier === 1 ? name : tier === 2 ? `${name}+` : `${name}++`,
      faction: 'scavengers',
      neutral: false,
      awakening_min: aw,
      card_tier: tier,
      charge_cost: card.charge_cost ?? 0,
      base_damage: 0,
      base_block: 0,
      tags: card.tags || [],
      keywords: card.keywords || [],
      ...(tier < 3 ? { merge_to: `${base}_t${tier + 1}` } : {}),
      effects: card.effects,
    };
  });
}

const newAw1 = [
  ...mkTier('scrap_dividend', 'Scrap Dividend', 1, (tier) => ({
    tags: ['Junk'],
    keywords: [{ type: 'Persistent', value: 1 }],
    effects: [
      { type: 'SpendJunk', amount: tier === 3 ? 2 : 3 },
      { type: 'SetStrikeResolveBonusJunk', amount: tier === 3 ? 2 : 1 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
  })),
  ...mkTier('scrap_dynamo', 'Scrap Dynamo', 1, (tier) => ({
    tags: ['Energy', 'Junk'],
    keywords: [{ type: 'Persistent', value: 1 }],
    effects: [
      { type: 'SpendJunk', amount: 2 },
      { type: 'SetFirstCardOfCycleBonusCharge', amount: tier === 3 ? 2 : 1 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
  })),
  ...mkTier('dynamo_peal', 'Dynamo Peal', 1, (tier) => ({
    charge_cost: 1,
    tags: ['Direct'],
    effects: [
      {
        type: 'DirectHpDamagePerScrapEngine',
        damagePerEngine: tier === 3 ? 4 : tier === 2 ? 3 : 2,
        pierce: false,
      },
    ],
  })),
  ...mkTier('chassis_refinance', 'Chassis Refinance', 1, (tier) => ({
    tags: ['Junk'],
    effects: [
      { type: 'SpendJunk', amount: tier === 3 ? 3 : 4 },
      { type: 'GainMaxHp', amount: tier === 3 ? 3 : 2 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
  })),
  ...mkTier('scrap_transfusion', 'Scrap Transfusion', 1, (tier) => ({
    tags: ['Junk'],
    effects: [
      { type: 'SpendJunk', amount: 3 },
      { type: 'HealSelf', amount: tier === 3 ? 8 : tier === 2 ? 7 : 6 },
    ],
  })),
  ...mkTier('blood_to_scrap', 'Blood to Scrap', 1, () => ({
    tags: ['Junk'],
    keywords: [{ type: 'Persistent', value: 1 }],
    effects: [
      { type: 'SetBloodToScrapJunkPerSelfDamage', amount: 1 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
  })),
  ...mkTier('heap_padding', 'Heap Padding', 1, (tier) => ({
    tags: ['Junk'],
    keywords: [{ type: 'Persistent', value: 1 }],
    effects: [
      { type: 'SetHeapPadding', minJunk: tier === 3 ? 3 : 4, reduceBy: tier === 3 ? 2 : 1 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
  })),
  ...mkTier('anemic_dividend', 'Anemic Dividend', 1, (tier) => ({
    tags: ['Junk'],
    keywords: [{ type: 'Persistent', value: 1 }],
    effects: [
      {
        type: 'SetStrikeResolveBonusJunkIfHpFractionAtMost',
        maxHpFraction: 0.5,
        amount: tier === 3 ? 2 : 1,
      },
      { type: 'GainScrapEngine', amount: 1 },
    ],
  })),
  ...mkTier('hollow_frame', 'Hollow Frame', 1, (tier) => ({
    tags: ['Direct'],
    effects: [
      {
        type: 'BranchIfMissingHpGte',
        minMissing: tier === 3 ? 8 : 10,
        thenSteps: [
          { type: 'DirectHpDamage', baseDamage: tier === 3 ? 10 : tier === 2 ? 8 : 6, pierce: false },
        ],
        elseSteps: [{ type: 'DirectHpDamage', baseDamage: tier === 3 ? 4 : 3, pierce: false }],
      },
    ],
  })),
  ...mkTier('hot_swap', 'Hot Swap', 1, (tier) => ({
    tags: ['Direct', 'Junk', 'Shield'],
    keywords: [{ type: 'CoreParts', value: 1 }],
    effects: [
      { type: 'SelfDamageRespectFloor1', amount: tier === 3 ? 2 : 3 },
      { type: 'ShieldBlock', baseBlock: tier === 3 ? 2 : 1 },
      { type: 'DirectHpDamage', baseDamage: tier === 3 ? 6 : 4, pierce: false },
      { type: 'TransformCurrentQueueSlot', matchNeutralBasicTierToResolvingCard: true },
      { type: 'GainEmergencyProtocolStacks', amount: 1 },
    ],
  })),
  ...mkTier('heap_battery', 'Heap Battery', 1, (tier) => ({
    tags: ['Energy', 'Junk'],
    keywords: [{ type: 'Continuous', value: tier === 3 ? 2 : 3 }],
    effects: [
      {
        type: 'BranchIfJunkGte',
        minJunk: 6,
        thenSteps: [{ type: 'GainCharge', amount: 1 }],
        elseSteps: [],
      },
    ],
  })),
];

aw1.cards.push(...newAw1);

fs.writeFileSync(aw0Path, `${JSON.stringify(aw0, null, '\t')}\n`);
fs.writeFileSync(aw1Path, `${JSON.stringify(aw1, null, '\t')}\n`);

console.log('aw0', aw0.cards.length, 'aw1', aw1.cards.length);
console.log(
  'aw0 bases',
  [...new Set(aw0.cards.map((c) => baseId(c.id)))].sort().join(', '),
);
console.log('new', [...new Set(newAw1.map((c) => baseId(c.id)))].join(', '));
