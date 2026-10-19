import fs from 'fs';

function graftCard(id, name, tier, aw, mergeTo, tags, effects, extras = {}) {
  const suffix = tier === 1 ? '' : tier === 2 ? '+' : '++';
  return {
    id: `${id}_t${tier}`,
    name: `${name}${suffix}`,
    faction: 'scavengers',
    neutral: false,
    awakening_min: aw,
    card_tier: tier,
    charge_cost: 0,
    base_damage: 0,
    base_block: 0,
    tags,
    ...(mergeTo ? { merge_to: `${id}_t${tier + 1}` } : {}),
    ...extras,
    effects,
  };
}

function convertFamily(id, name, into, aw, fr) {
  const out = [];
  for (const tier of [1, 2, 3]) {
    const maxEngines = tier;
    const spendJunk = fr ? undefined : tier === 3 ? 2 : 3;
    const effects = [];
    if (fr) {
      effects.push({ type: 'SelfDamageRespectFloor1', amount: 4 });
      effects.push({ type: 'ShieldBlock', baseBlock: 2 });
    }
    effects.push({
      type: 'ConvertScrapEngines',
      maxEngines,
      into,
      ...(spendJunk != null ? { spendJunk } : {}),
    });
    if (fr) {
      effects.push({
        type: 'TransformCurrentQueueSlot',
        matchNeutralBasicTierToResolvingCard: true,
      });
      effects.push({ type: 'GainEmergencyProtocolStacks', amount: 1 });
    }
    const tags = ['Junk'];
    if (into === 'attack') tags.push('Direct');
    if (into === 'shield') tags.push('Shield');
    if (into === 'energy') tags.push('Energy');
    if (into === 'expose') tags.push('Expose');
    const cardExtras = fr ? { keywords: [{ type: 'FactoryReset', value: 1 }] } : {};
    out.push(graftCard(id, name, tier, aw, tier < 3, tags, effects, cardExtras));
  }
  return out;
}

const aw0Path = 'src/data/cards/scavengers/awakening0.json';
const aw0 = JSON.parse(fs.readFileSync(aw0Path, 'utf8'));

const lancet = [
  graftCard('graft_lancet', 'Rust Lancet', 1, 0, true, ['Direct', 'Shield', 'Junk'], [
    { type: 'SelfDamageRespectFloor1', amount: 3 },
    { type: 'ShieldBlock', baseBlock: 2 },
    { type: 'DirectHpDamage', baseDamage: 4, pierce: false },
    { type: 'GainJunk', amount: 1 },
  ]),
  graftCard('graft_lancet', 'Rust Lancet', 2, 0, true, ['Direct', 'Shield', 'Junk'], [
    { type: 'SelfDamageRespectFloor1', amount: 3 },
    { type: 'ShieldBlock', baseBlock: 2 },
    { type: 'DirectHpDamage', baseDamage: 5, pierce: false },
    { type: 'GainJunk', amount: 1 },
  ]),
  graftCard('graft_lancet', 'Rust Lancet', 3, 0, false, ['Direct', 'Shield', 'Junk'], [
    { type: 'SelfDamageRespectFloor1', amount: 3 },
    { type: 'ShieldBlock', baseBlock: 3 },
    { type: 'DirectHpDamage', baseDamage: 6, pierce: false },
    { type: 'GainJunk', amount: 2 },
  ]),
];

const ballast = [
  graftCard(
    'heap_ballast',
    'Heap Ballast',
    1,
    0,
    true,
    ['Junk'],
    [
      { type: 'SetHeapBallast', minJunk: 4, reduceBy: 1 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
    { keywords: [{ type: 'Persistent', value: 1 }] },
  ),
  graftCard(
    'heap_ballast',
    'Heap Ballast',
    2,
    0,
    true,
    ['Junk'],
    [
      { type: 'SetHeapBallast', minJunk: 4, reduceBy: 1 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
    { keywords: [{ type: 'Persistent', value: 1 }] },
  ),
  graftCard(
    'heap_ballast',
    'Heap Ballast',
    3,
    0,
    false,
    ['Junk'],
    [
      { type: 'SetHeapBallast', minJunk: 3, reduceBy: 2 },
      { type: 'GainScrapEngine', amount: 1 },
    ],
    { keywords: [{ type: 'Persistent', value: 1 }] },
  ),
];

const anesthetic = [
  graftCard(
    'scrap_anesthetic',
    'Scrap Anesthetic',
    1,
    0,
    true,
    ['Junk', 'Shield'],
    [
      { type: 'SpendJunk', amount: 2 },
      { type: 'SetScrapAnesthetic', blockPerHpLost: 1, capPerHit: 3 },
    ],
    { keywords: [{ type: 'Persistent', value: 1 }] },
  ),
  graftCard(
    'scrap_anesthetic',
    'Scrap Anesthetic',
    2,
    0,
    true,
    ['Junk', 'Shield'],
    [
      { type: 'SpendJunk', amount: 2 },
      { type: 'SetScrapAnesthetic', blockPerHpLost: 1, capPerHit: 4 },
    ],
    { keywords: [{ type: 'Persistent', value: 1 }] },
  ),
  graftCard(
    'scrap_anesthetic',
    'Scrap Anesthetic',
    3,
    0,
    false,
    ['Junk', 'Shield'],
    [
      { type: 'SpendJunk', amount: 1 },
      { type: 'SetScrapAnesthetic', blockPerHpLost: 1, capPerHit: 5 },
    ],
    { keywords: [{ type: 'Persistent', value: 1 }] },
  ),
];

aw0.cards = aw0.cards.filter(
  (c) => !/^(graft_lancet|heap_ballast|scrap_anesthetic)_t[123]$/.test(c.id),
);
aw0.cards.push(...lancet, ...ballast, ...anesthetic);
fs.writeFileSync(aw0Path, JSON.stringify(aw0, null, '\t') + '\n');
console.log('aw0', lancet.length + ballast.length + anesthetic.length);

const aw1Path = 'src/data/cards/scavengers/awakening1.json';
const aw1 = JSON.parse(fs.readFileSync(aw1Path, 'utf8'));

const bonesaw = [
  graftCard('graft_bonesaw', 'Bone Saw', 1, 1, true, ['Strike', 'Shield'], [
    { type: 'SelfDamageRespectFloor1', amount: 5 },
    { type: 'ShieldBlock', baseBlock: 3 },
    { type: 'StrikeDamage', baseDamage: 6, pierce: false, useStrikePotency: true },
  ]),
  graftCard('graft_bonesaw', 'Bone Saw', 2, 1, true, ['Strike', 'Shield'], [
    { type: 'SelfDamageRespectFloor1', amount: 5 },
    { type: 'ShieldBlock', baseBlock: 3 },
    { type: 'StrikeDamage', baseDamage: 8, pierce: false, useStrikePotency: true },
  ]),
  graftCard('graft_bonesaw', 'Bone Saw', 3, 1, false, ['Strike', 'Shield'], [
    { type: 'SelfDamageRespectFloor1', amount: 5 },
    { type: 'ShieldBlock', baseBlock: 4 },
    { type: 'StrikeDamage', baseDamage: 10, pierce: false, useStrikePotency: true },
  ]),
];

const spark = [
  graftCard('graft_spark_vein', 'Spark Vein', 1, 1, true, ['Shield', 'Energy'], [
    { type: 'SelfDamageRespectFloor1', amount: 4 },
    { type: 'ShieldBlock', baseBlock: 2 },
    { type: 'GainCharge', amount: 2 },
  ]),
  graftCard('graft_spark_vein', 'Spark Vein', 2, 1, true, ['Shield', 'Energy'], [
    { type: 'SelfDamageRespectFloor1', amount: 4 },
    { type: 'ShieldBlock', baseBlock: 2 },
    { type: 'GainCharge', amount: 3 },
  ]),
  graftCard(
    'graft_spark_vein',
    'Spark Vein',
    3,
    1,
    false,
    ['Shield', 'Energy'],
    [
      { type: 'SelfDamageRespectFloor1', amount: 4 },
      { type: 'ShieldBlock', baseBlock: 3 },
      { type: 'GainCharge', amount: 3 },
      { type: 'Keyword', spec: { type: 'Overclock', value: 1 } },
    ],
    { keywords: [{ type: 'Overclock', value: 1 }] },
  ),
];

const redline = [
  graftCard('graft_redline', 'Redline Fuse', 1, 1, true, ['Direct', 'Shield'], [
    { type: 'SelfDamageRespectFloor1', amount: 6 },
    { type: 'ShieldBlock', baseBlock: 3 },
    { type: 'DirectHpDamage', baseDamage: 9, pierce: false },
  ]),
  graftCard('graft_redline', 'Redline Fuse', 2, 1, true, ['Direct', 'Shield'], [
    { type: 'SelfDamageRespectFloor1', amount: 6 },
    { type: 'ShieldBlock', baseBlock: 3 },
    { type: 'DirectHpDamage', baseDamage: 11, pierce: false },
  ]),
  graftCard(
    'graft_redline',
    'Redline Fuse',
    3,
    1,
    false,
    ['Direct', 'Shield'],
    [
      { type: 'SelfDamageRespectFloor1', amount: 6 },
      { type: 'ShieldBlock', baseBlock: 4 },
      { type: 'DirectHpDamage', baseDamage: 13, pierce: true },
    ],
    { keywords: [{ type: 'Pierce', value: 1 }] },
  ),
];

const converts = [
  ...convertFamily('scrap_hound_rifle', 'Scrap Hound Rifle', 'attack', 1, false),
  ...convertFamily('scrap_hound_bulwark', 'Scrap Hound Bulwark', 'shield', 1, false),
  ...convertFamily('scrap_dynamo_feed', 'Scrap Dynamo Feed', 'energy', 1, false),
  ...convertFamily('scrap_paint_marker', 'Scrap Paint Marker', 'expose', 1, false),
  ...convertFamily('fr_hound_rifle', 'Factory Hound Rifle', 'attack', 1, true),
  ...convertFamily('fr_hound_bulwark', 'Factory Hound Bulwark', 'shield', 1, true),
];

aw1.cards = aw1.cards.filter(
  (c) =>
    !/^(graft_bonesaw|graft_spark_vein|graft_redline|scrap_hound_rifle|scrap_hound_bulwark|scrap_dynamo_feed|scrap_paint_marker|fr_hound_rifle|fr_hound_bulwark)_t[123]$/.test(
      c.id,
    ),
);
aw1.cards.push(...bonesaw, ...spark, ...redline, ...converts);
fs.writeFileSync(aw1Path, JSON.stringify(aw1, null, '\t') + '\n');
console.log(
  'aw1',
  bonesaw.length + spark.length + redline.length + converts.length,
);

const n0Path = 'src/data/cards/neutral/awakening0.json';
const n0 = JSON.parse(fs.readFileSync(n0Path, 'utf8'));

function neutralCard(id, name, tier, mergeTo, tags, effects, extras = {}) {
  const suffix = tier === 1 ? '' : tier === 2 ? '+' : '++';
  return {
    id: `${id}_t${tier}`,
    name: `${name}${suffix}`,
    faction: 'neutral',
    neutral: true,
    awakening_min: 0,
    card_tier: tier,
    charge_cost: extras.charge_cost ?? 0,
    base_damage: 0,
    base_block: 0,
    tags,
    ...(mergeTo ? { merge_to: `${id}_t${tier + 1}` } : {}),
    effects,
  };
}

const pickup = [
  neutralCard('neutral_scrap_pickup', 'Scrap Pickup', 1, true, ['Junk'], [
    { type: 'GainJunk', amount: 1 },
  ]),
  neutralCard('neutral_scrap_pickup', 'Scrap Pickup', 2, true, ['Junk'], [
    { type: 'GainJunk', amount: 2 },
  ]),
  neutralCard('neutral_scrap_pickup', 'Scrap Pickup', 3, false, ['Junk'], [
    { type: 'GainJunk', amount: 2 },
  ]),
];

const dump = [
  neutralCard('neutral_scrap_dump', 'Scrap Dump', 1, true, ['Junk', 'Energy'], [
    { type: 'SpendJunk', amount: 2 },
    { type: 'GainCharge', amount: 1 },
  ]),
  neutralCard('neutral_scrap_dump', 'Scrap Dump', 2, true, ['Junk', 'Energy'], [
    { type: 'SpendJunk', amount: 2 },
    { type: 'GainCharge', amount: 2 },
  ]),
  neutralCard('neutral_scrap_dump', 'Scrap Dump', 3, false, ['Junk', 'Energy', 'Potency'], [
    { type: 'SpendJunk', amount: 2 },
    { type: 'GainCharge', amount: 2 },
    { type: 'AddStrikePotency', amount: 1 },
  ]),
];

n0.cards = n0.cards.filter(
  (c) => !/^(neutral_scrap_pickup|neutral_scrap_dump)_t[123]$/.test(c.id),
);
n0.cards.push(...pickup, ...dump);
fs.writeFileSync(n0Path, JSON.stringify(n0, null, '\t') + '\n');
console.log('neutral', pickup.length + dump.length);
