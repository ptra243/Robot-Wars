import type { CardDef, CardTag, EffectStep } from './types';

function effectsIncludeChargeGain(effects: EffectStep[] | undefined): boolean {
  if (!effects?.length) {
    return false;
  }
  for (const step of effects) {
    if (step.type === 'GainCharge' && step.amount > 0) {
      return true;
    }
    if (step.type === 'OptionalSpendJunkForGainCharge' && step.gainCharge > 0) {
      return true;
    }
    if (step.type === 'GrantPerpetualRoundCharge' && step.chargePerRound > 0) {
      return true;
    }
    if (
      step.type === 'BranchIfCoreGte' ||
      step.type === 'BranchIfJunkGte' ||
      step.type === 'BranchIfChargeGte' ||
      step.type === 'BranchIfActorStance'
    ) {
      if (
        effectsIncludeChargeGain(step.thenSteps) ||
        effectsIncludeChargeGain(step.elseSteps)
      ) {
        return true;
      }
    }
    // Optional paywall branches (e.g. Junk Crown >15 refund) are not "+Energy" archetype for filters.
    if (step.type === 'ConditionalSpendCharge') {
      continue;
    }
  }
  return false;
}

function deriveNormalizedTags(card: CardDef): CardTag[] {
  const tags = [...(card.tags ?? [])];
  if (tags.includes('Energy')) {
    return tags;
  }
  const gain = card.gain_charge ?? 0;
  const opt = card.optional_spend_junk_for_charge;
  const hasContinuous = (card.keywords ?? []).some((k) => k.type === 'Continuous');
  if (
    gain > 0 ||
    (opt != null && opt.gainCharge > 0) ||
    hasContinuous ||
    effectsIncludeChargeGain(card.effects)
  ) {
    tags.push('Energy');
  }
  return tags;
}

/** Normalize defaults for loaded JSON; exported for tests that build custom cards. */
export function normalizeCard(card: CardDef): CardDef {
  return {
    ...card,
    charge_cost: card.charge_cost ?? 0,
    base_damage: card.base_damage ?? 0,
    base_block: card.base_block ?? 0,
    gain_charge: card.gain_charge ?? 0,
    gain_junk: card.gain_junk ?? 0,
    gain_core: card.gain_core ?? 0,
    spend_junk: card.spend_junk ?? 0,
    spend_core: card.spend_core ?? 0,
    strike_potency_gain: card.strike_potency_gain ?? 0,
    shield_potency_gain: card.shield_potency_gain ?? 0,
    heal_self: card.heal_self ?? 0,
    tags: deriveNormalizedTags(card),
    keywords: card.keywords ?? [],
  };
}
