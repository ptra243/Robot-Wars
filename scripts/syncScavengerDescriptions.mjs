import fs from 'fs';

const aw0 = JSON.parse(fs.readFileSync('src/data/cards/scavengers/awakening0.json', 'utf8'));
const aw1 = JSON.parse(fs.readFileSync('src/data/cards/scavengers/awakening1.json', 'utf8'));
const desc = JSON.parse(fs.readFileSync('src/data/cardDescriptions.json', 'utf8'));

const cut = [
  'sacrif_lumen',
  'sacrif_spike',
  'sacrif_probe',
  'sacrif_tether',
  'sacrif_cinder',
  'sacrif_forge',
  'sacrif_suture',
].flatMap((b) => [`${b}_t1`, `${b}_t2`, `${b}_t3`]);

for (const id of cut) {
  delete desc.byCardId[id];
}

function summarize(card) {
  const lines = [];
  for (const e of card.effects || []) {
    switch (e.type) {
      case 'SelfDamageRespectFloor1':
        lines.push(`Lose ${e.amount} HP (minimum 1).`);
        break;
      case 'SelfDamage':
        lines.push(`Lose ${e.amount} HP.`);
        break;
      case 'GainJunk':
        lines.push(`+${e.amount} Junk.`);
        break;
      case 'ShieldBlock':
        lines.push(`Gain ${e.baseBlock} Shield.`);
        break;
      case 'DirectHpDamage':
        lines.push(`Deal ${e.baseDamage} direct damage.`);
        break;
      case 'HealSelf':
        lines.push(`Heal ${e.amount} HP.`);
        break;
      case 'GainMaxHp':
        lines.push(`+${e.amount} max HP (no heal).`);
        break;
      case 'SpendJunk':
        lines.push(`Spend ${e.amount} Junk.`);
        break;
      case 'SetBloodToScrapJunkPerSelfDamage':
        lines.push(
          `Persistent: when you take card self-damage, gain ${e.amount} Junk per HP lost.`,
        );
        break;
      case 'SetHeapPadding':
        lines.push(
          `Persistent: while Junk ≥ ${e.minJunk}, card self-damage is reduced by ${e.reduceBy}.`,
        );
        break;
      case 'SetStrikeResolveBonusJunk':
        lines.push(`Persistent: Strikes grant +${e.amount} Junk.`);
        break;
      case 'SetStrikeResolveBonusJunkIfHpFractionAtMost':
        lines.push(
          `Persistent: while at ≤${Math.round(e.maxHpFraction * 100)}% HP, Strikes grant +${e.amount} Junk.`,
        );
        break;
      case 'SetFirstCardOfCycleBonusCharge':
        lines.push(`Persistent: first card each cycle gains +${e.amount} Energy.`);
        break;
      case 'GainScrapEngine':
        lines.push(`Gain ${e.amount} Scrap Engine.`);
        break;
      case 'DirectHpDamagePerScrapEngine':
        lines.push(`Deal ${e.damagePerEngine} direct damage per Scrap Engine.`);
        break;
      case 'BranchIfMissingHpGte':
        lines.push(`If missing ≥${e.minMissing} HP: stronger hit; otherwise weaker hit.`);
        break;
      case 'TransformCurrentQueueSlot':
        lines.push('Factory Reset.');
        break;
      case 'GainEmergencyProtocolStacks':
        lines.push(`Emergency Protocol ${e.amount}.`);
        break;
      default:
        break;
    }
  }
  for (const k of card.keywords || []) {
    if (k.type === 'Persistent' && !lines.some((l) => l.startsWith('Persistent'))) {
      lines.push('Persistent.');
    }
    if (k.type === 'Continuous') {
      const min = card.continuous_min_junk;
      const c = card.continuous_charge_per_tick ?? 1;
      const j = card.continuous_junk_per_tick ?? 1;
      if (min !== undefined) {
        lines.push(
          `Continuous ${k.value}: while Junk ≥ ${min}, Energy ${c}${j ? `, Junk ${j}` : ''}.`,
        );
      } else {
        lines.push(`Continuous ${k.value}.`);
      }
    }
    if (k.type === 'CoreParts') lines.push('Core Parts.');
  }
  if (lines.length === 0) lines.push(card.name);
  const body = lines.join('\n');
  const tags = (card.tags || []).join(', ');
  return {
    full: tags ? `${body}\nTags: ${tags}.` : body,
    compact: body,
  };
}

const forceUpdate = new Set(
  [
    'sacrif_plate',
    'sacrif_rift',
    'gutter_offering',
    'scrap_dividend',
    'scrap_dynamo',
    'dynamo_peal',
    'chassis_refinance',
    'scrap_transfusion',
    'blood_to_scrap',
    'heap_padding',
    'anemic_dividend',
    'hollow_frame',
    'hot_swap',
    'heap_battery',
  ].flatMap((b) => [`${b}_t1`, `${b}_t2`, `${b}_t3`]),
);

for (const card of [...aw0.cards, ...aw1.cards]) {
  if (!desc.byCardId[card.id] || forceUpdate.has(card.id)) {
    desc.byCardId[card.id] = summarize(card);
  }
}

fs.writeFileSync('src/data/cardDescriptions.json', `${JSON.stringify(desc, null, 2)}\n`);
console.log('updated', forceUpdate.size, 'forced; total entries', Object.keys(desc.byCardId).length);
