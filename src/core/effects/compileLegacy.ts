import type { CardDef, EffectStep, KeywordSpec } from '../types';

/**
 * Builds the legacy scalar pipeline. **Bulk** keywords run before Strike/Shield; other keywords after.
 */
export function compileLegacyToEffects(card: CardDef): EffectStep[] {
  const steps: EffectStep[] = [];

  const bulkKeywords: KeywordSpec[] = [];
  const otherKeywords: KeywordSpec[] = [];
  for (const k of card.keywords) {
    if (k.type === 'Bulk') {
      bulkKeywords.push(k);
    } else {
      otherKeywords.push(k);
    }
  }

  if (card.spend_junk > 0) {
    steps.push({ type: 'SpendJunk', amount: card.spend_junk });
  }
  if (card.spend_core > 0) {
    steps.push({ type: 'SpendCore', amount: card.spend_core });
  }
  if (card.gain_junk > 0) {
    steps.push({ type: 'GainJunk', amount: card.gain_junk });
  }
  if (card.gain_core > 0) {
    steps.push({ type: 'GainCore', amount: card.gain_core });
  }
  if (card.optional_spend_junk_for_charge) {
    if (card.gain_charge > 0) {
      steps.push({ type: 'GainCharge', amount: card.gain_charge });
    }
    steps.push({
      type: 'OptionalSpendJunkForGainCharge',
      spend: card.optional_spend_junk_for_charge.spend,
      gainCharge: card.optional_spend_junk_for_charge.gainCharge,
    });
  } else if (card.gain_charge > 0) {
    steps.push({ type: 'GainCharge', amount: card.gain_charge });
  }
  if (card.strike_potency_gain > 0) {
    steps.push({ type: 'AddStrikePotency', amount: card.strike_potency_gain });
  }
  if (card.shield_potency_gain > 0) {
    steps.push({ type: 'AddShieldPotency', amount: card.shield_potency_gain });
  }
  const heal = card.heal_self ?? 0;
  if (heal > 0) {
    steps.push({ type: 'HealSelf', amount: heal });
  }
  for (const spec of bulkKeywords) {
    steps.push({ type: 'Keyword', spec });
  }

  const pierce = card.keywords.some((k) => k.type === 'Pierce');
  const capitalising =
    card.tags.includes('Strike') && /^neutral_capitalising_strike_t[123]$/.test(card.id);
  const harassing =
    card.tags.includes('Strike') && /^neutral_harassing_strike_t[123]$/.test(card.id);
  if (card.tags.includes('Strike')) {
    steps.push({
      type: 'StrikeDamage',
      baseDamage: card.base_damage,
      pierce,
      useStrikePotency: true,
      bonusDamageIfJunkPlusCoreSumGte: card.bonus_strike_damage_if_junk_plus_core_gte,
      consumeTargetExposeForBonus: capitalising,
      deferExposeClear: harassing || undefined,
    });
  } else if (card.tags.includes('Direct')) {
    steps.push({
      type: 'StrikeDamage',
      baseDamage: card.base_damage,
      pierce,
      useStrikePotency: false,
      bonusDamageIfJunkPlusCoreSumGte: card.bonus_strike_damage_if_junk_plus_core_gte,
    });
  }
  if (card.tags.includes('Shield')) {
    steps.push({
      type: 'ShieldBlock',
      baseBlock: card.base_block,
      bonusBlockIfJunkPlusCoreSumGte: card.bonus_block_if_junk_plus_core_gte,
      bonusBlockPerJunkHeld: card.bonus_block_per_junk_held,
      bonusBlockPerJunkEveryN: card.bonus_block_per_junk_every_n,
    });
  }

  for (const spec of otherKeywords) {
    steps.push({ type: 'Keyword', spec });
  }

  return steps;
}

/**
 * Raw pipeline: catalog cards must ship with `effects` (see `compileLegacyToEffects` + migration script).
 * `compileLegacyToEffects` remains for tests and programmatic cards built only from legacy scalars.
 */
export function getResolvedEffectPipeline(card: CardDef): EffectStep[] {
  if (card.effects && card.effects.length > 0) {
    return [...card.effects];
  }
  return compileLegacyToEffects(card);
}

/** Identity hook after `expandEffectSteps` (reserved for future global post-steps). */
export function finalizeEffectPipeline(steps: EffectStep[]): EffectStep[] {
  return steps;
}
