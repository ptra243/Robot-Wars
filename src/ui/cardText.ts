import { COMBAT_RULES } from '../core/rules';
import type { CardDef, KeywordSpec } from '../core/types';

export interface BuildCardDescriptionOptions {
  /** Omit tag/keyword summary lines (e.g. when shown in a side glossary). */
  omitTagsAndKeywords?: boolean;
}

/** Explains how “Continuous N: …” lines split one-time resolve vs tick (Drone Uplink, Perpetual Motion, etc.). */
const CONTINUOUS_TICK_RULES_EXPLAINER =
  'Anything above the Continuous line resolves once on card resolution. Everything after the colon on that line resolves on each continuous tick.';

/**
 * Full rules sentence for one keyword (used when glossary is not shown, or for tooltips).
 */
export function keywordEffectLine(spec: KeywordSpec): string {
  const v = spec.value;
  switch (spec.type) {
    case 'Bulk':
      return `Bulk ${v}: gain up to ${v} bulk stack(s) (cap ${COMBAT_RULES.maxBulkStacks}). Each stack mitigates 1 incoming strike damage to HP.`;
    case 'Expose':
      return `Expose ${v}: apply ${v} Expose to the target. The next Strike that hits that target gains +${v} damage, then Expose clears.`;
    case 'Overclock':
      return v > 0
        ? `Overclock ${v}: bonus-resolves the next card in your queue when bonus resolutions are allowed.`
        : `Overclock: bonus chain requires a positive keyword value.`;
    case 'TurboLink':
      return `TurboLink ${v}: spend between 1 and ${v} bulk stacks for junk, then bonus-resolve the next queued card when allowed.`;
    case 'Continuous':
      return `Continuous ${v}: while this slot keeps resolving, every ${v} rounds you gain +1 Junk and +1 Energy from it.`;
    case 'Pierce':
      return `Pierce${v !== 1 ? ` ${v}` : ''}: damage from this card ignores block.`;
    case 'FactoryReset': {
      const tier = v >= 1 && v <= 3 ? v : 1;
      return `Factory Reset ${tier}: this deck entry becomes Neutral Basic Strike (tier ${tier}).`;
    }
    case 'CoreParts':
      return `CoreParts: marks a core-parts card (filter; Core Rebirth upgrades the next Neutral Basic Strike(s) in queue order into one of these at the same tier).`;
    case 'UniqueDeck':
      return `UniqueDeck: your deck may include at most one copy of any card with this keyword (hand + fatigue deck combined).`;
    case 'Persistent':
      return `Persistent: marks a rest-of-battle effect on this card (see printed rules). Counts toward the Continuous/Persistent deck limit.`;
  }
}

function compactKeywordHeadline(spec: KeywordSpec): string {
  return `${spec.type} ${spec.value}.`;
}

function fallbackWhenEmpty(card: CardDef): string {
  if (card.tags.length > 0) {
    return `${card.tags.join(' & ')} — open Tags in the glossary for rules text.`;
  }
  return 'No printed combat values on this card.';
}

function perpetualChargeFromEffects(card: CardDef):
  | { chargePerRound: number; totalRounds: number }
  | undefined {
  for (const step of card.effects ?? []) {
    if (step.type === 'GrantPerpetualRoundCharge') {
      return { chargePerRound: step.chargePerRound, totalRounds: step.totalRounds };
    }
  }
  return undefined;
}

/**
 * Printed-threshold scavenger cards are mostly `effects` pipelines; `scripts/generateCardDescriptions.ts`
 * reads body text from here — keep these in sync with card JSON behavior.
 */
const JUNK_THRESHOLD_CARD_TEXT: Record<string, { full: string; compact: string }> = {
  junk_spigot_t1: {
    full:
      'Junk Spigot\n\nBaseline: +1 Energy, +1 Junk\nJunk ≥ 4: +2 Energy, +2 Junk\nJunk ≥ 10: +Energy — floor(junk at snapshot ÷ 4)\nTags: Junk, Energy.',
    compact:
      'Junk Spigot\n\nBaseline: +1 Energy, +1 Junk\nJunk ≥ 4: +2 Energy, +2 Junk\nJunk ≥ 10: +Energy from pile size',
  },
  junk_bulwark_t1: {
    full:
      'Junk Bulwark\n\nEnergy 1\nShield 3\nJunk ≥ 5: Bulk 2\nJunk ≥ 10: Shield — your bulk stacks + potency (stack this Shield for Junk Aegis)\nTags: Shield, Junk.',
    compact:
      'Junk Bulwark\n\nEnergy 1 · Shield 3\nJunk ≥ 5: Bulk 2\nJunk ≥ 10: Shield from bulk + potency',
  },
  junk_ladder_t1: {
    full: 'Junk Ladder\n\n5 non-Strike damage\nJunk ≥ 8: Overclock (once)\nTags: Direct, Junk.',
    compact: 'Junk Ladder\n\n5 non-Strike damage\nJunk ≥ 8: Overclock',
  },
  junk_gasket_t1: {
    full:
      'Junk Gasket\n\nBaseline: +1 Energy, +1 Junk\nJunk ≥ 4: Bulk 1, +1 Energy, +1 Junk\nJunk ≥ 10: Overclock (once)\nTags: Junk, Energy.',
    compact:
      'Junk Gasket\n\nBaseline: +1 Energy, +1 Junk\nJunk ≥ 4: Bulk + fuel\nJunk ≥ 10: Overclock',
  },
  junk_coil_t1: {
    full:
      'Junk Coil\n\nBaseline: +1 Energy\nJunk ≥ 4: Gain Junk equal to your Energy (after the baseline +1)\nJunk ≥ 12: If you can pay 4 Energy — +potency, floor(junk at snapshot ÷ 4)\nTags: Junk, Energy.',
    compact:
      'Junk Coil\n\n+1 Energy\nJunk ≥ 4: Junk gained = your Energy\nJunk ≥ 12: Pay 4 Energy → potency from pile',
  },
  junk_aegis_t1: {
    full:
      'Junk Aegis\n\nEnergy 2\nBulk 1\nJunk ≥ 4: Shield — floor(junk at snapshot ÷ 4) + potency\nJunk ≥ 11: Deal non-Strike damage to enemy equal to your Shield (after the lines above)\nTags: Shield, Junk.',
    compact:
      'Junk Aegis\n\nEnergy 2\nBulk 1\nJunk ≥ 4: Shield from junk + potency\nJunk ≥ 11: Damage dealt = your Shield',
  },
  junk_rivet_t1: {
    full:
      'Junk Rivet\n\nEnergy 1\nStrike 4 (potency applies)\nJunk ≥ 5: Expose — max(1, floor(junk at snapshot ÷ 4))\nJunk ≥ 10: +2 Strike damage\nJunk ≥ 12: +5 Strike damage\nTags: Strike, Expose, Junk.',
    compact:
      'Junk Rivet\n\nEnergy 1 · Strike 4\nJunk ≥ 5: Expose from pile\nJunk ≥ 10: +2 Strike damage\nJunk ≥ 12: +5 Strike damage',
  },
  junk_crown_t1: {
    full:
      'Junk Crown\n\nEnergy 2\n5 non-Strike damage\nJunk ≥ 8: Overclock (once on this card)\nJunk ≥ 15: If you can pay 4 Energy — +2 Energy, then 1 non-Strike damage per junk at snapshot\nTags: Direct, Junk.',
    compact:
      'Junk Crown\n\nEnergy 2 · 5 non-Strike damage\nJunk ≥ 8: Overclock\nJunk ≥ 15: Pay 4 Energy → pile damage line',
  },
};

/** Shared card body text for previews (deck builder dock, combat hover, etc.). */
export function buildCardDescription(
  card: CardDef,
  options?: BuildCardDescriptionOptions,
): string {
  const parts: string[] = [];
  const omit = options?.omitTagsAndKeywords;

  const junkThresholdPinned = JUNK_THRESHOLD_CARD_TEXT[card.id];
  if (junkThresholdPinned) {
    return omit ? junkThresholdPinned.compact : junkThresholdPinned.full;
  }

  const coreTapBranchText =
    card.id === 'core_tap_t1' && card.effects && card.effects.length > 0;

  const coreSacrificeText =
    card.id === 'deep_core_tap_t1' && card.effects && card.effects.length > 0;

  const coreRefactoringText = card.id === 'core_refactoring_t1';
  const coreRebirthText = /^core_rebirth_t[123]$/.test(card.id);

  const junkSurgeText = card.id === 'field_diode_t1';
  const junkLoaderText = /^junk_loader_t[123]$/.test(card.id);
  const junkGeneratorText = /^junk_generator_t[12]$/.test(card.id);
  const inductionPitText = false;

  if (coreTapBranchText) {
    parts.push('Spend 1 Refined Scrap: 8 damage\nOtherwise: no damage\nFactory Reset');
  }

  if (coreSacrificeText) {
    parts.push(
      'Refined Scrap ≥ 1: Bulk 1 per Refined Scrap, Refined Scrap to 0, 12 damage\nRefined Scrap 0: no damage\nFactory Reset',
    );
  }

  if (coreRefactoringText) {
    parts.push('Self 5 damage, Refined Scrap 2, Overclock, Factory Reset');
  }

  const gatheringStrikeText = /^neutral_gathering_strike_t[123]$/.test(card.id);
  if (gatheringStrikeText && card.effects && card.effects.length > 0) {
    parts.push(
      'Strike: +bonus damage per strike you have already resolved this combat before this hit (each StrikeDamage step on Multi-strike counts). UniqueDeck: at most one UniqueDeck card in your deck.',
    );
  }

  const capitalisingStrikeText = /^neutral_capitalising_strike_t[123]$/.test(card.id);
  if (capitalisingStrikeText) {
    parts.push(
      `Pierce Strike for ${card.base_damage} base damage (potency applies). Strike hits consume the target’s Expose for bonus damage, then clear it.`,
    );
  }

  const siphoningStrikeText = /^neutral_siphoning_strike_t[123]$/.test(card.id);
  if (siphoningStrikeText) {
    const n = card.card_tier === 3 ? 6 : card.card_tier === 2 ? 5 : 4;
    parts.push(`Strike: ${String(n)} damage, Shield: ${String(n)} block\nEnemy Energy -1: Energy 1`);
  }

  const gutterOfferingText = card.id === 'gutter_offering_t1';
  if (gutterOfferingText) {
    parts.push('Self damage 3 (floor 1 HP)\nGain 3 Junk');
  }

  const neutralFeintText = card.id === 'neutral_feint_t1';
  if (neutralFeintText) {
    parts.push('Strike 3 (potency applies)\nNext Strike: Pierce');
  }

  const multiStrikeText = /^neutral_multi_strike_t[123]$/.test(card.id);
  if (multiStrikeText) {
    const d = card.card_tier;
    parts.push(`Strike ${String(d)}`);
    parts.push(`Strike ${String(d)}`);
  }

  const stripMineText = card.id === 'strip_mine_t1';
  if (stripMineText) {
    parts.push('Spend 2 Junk: mitigate 3 from next enemy Strike to you');
  }

  const exposeDroneUplinkText = /^neutral_expose_drone_uplink_t[12]$/.test(card.id);
  if (exposeDroneUplinkText) {
    const interval = card.keywords.find((k) => k.type === 'Continuous')?.value ?? 3;
    const exposeAmt = card.card_tier;
    const tickLine = `Continuous ${String(interval)}: Expose ${String(exposeAmt)}, Energy 1.`;
    if (!omit) {
      parts.push(CONTINUOUS_TICK_RULES_EXPLAINER);
    }
    parts.push(tickLine);
  }

  const perpetualMotionText = /^neutral_perpetual_motion_t[123]$/.test(card.id);
  const perpetualSpec = perpetualMotionText ? perpetualChargeFromEffects(card) : undefined;
  if (perpetualSpec && perpetualSpec.chargePerRound > 0 && perpetualSpec.totalRounds > 0) {
    const tickLine = `Continuous ${String(perpetualSpec.totalRounds)}: Energy ${String(perpetualSpec.chargePerRound)}.`;
    if (!omit) {
      parts.push(CONTINUOUS_TICK_RULES_EXPLAINER);
    }
    parts.push(tickLine);
  }

  if (junkGeneratorText) {
    const interval = card.keywords.find((k) => k.type === 'Continuous')?.value ?? 3;
    if (!omit) {
      parts.push(CONTINUOUS_TICK_RULES_EXPLAINER);
    }
    parts.push(`Continuous ${String(interval)}: Junk 1, Energy 1.`);
  }

  if (junkSurgeText) {
    parts.push('Energy 1\nSpend 1 Junk: Energy 1');
  }

  if (junkLoaderText) {
    const gc = card.gain_charge ?? 0;
    const gj = card.gain_junk ?? 0;
    parts.push(`Energy ${String(gc)}\nGain ${String(gj)} Junk`);
  }

  if (coreRebirthText) {
    const n = Math.min(3, Math.max(1, card.card_tier));
    const slotPhrase = n === 1 ? 'slot' : 'slots';
    parts.push(
      `Refined Scrap 1\nReplace next ${String(n)} Neutral Basic Strike ${slotPhrase} with random CoreParts (same tier)`,
    );
  }

  if (
    card.base_damage &&
    !coreTapBranchText &&
    !coreSacrificeText &&
    !gatheringStrikeText &&
    !capitalisingStrikeText &&
    !siphoningStrikeText &&
    !neutralFeintText &&
    !multiStrikeText
  ) {
    if (card.tags.includes('Direct')) {
      parts.push(
        `Deals ${card.base_damage} direct damage (not a Strike; potency is not added to this hit’s damage).`,
      );
    } else if (card.tags.includes('Strike')) {
      parts.push(`Deals ${card.base_damage} base damage.`);
    } else {
      parts.push(`Deals ${card.base_damage} damage.`);
    }
  }
  const shieldReinf = /^neutral_shield_reinforcement_t[123]$/.test(card.id);
  if (card.base_block && !shieldReinf) {
    parts.push(
      `Grants ${card.base_block} block (shield absorbs incoming damage before HP).`,
    );
  }

  if (shieldReinf && card.effects?.some((e) => e.type === 'DoubleActorBlock')) {
    const tier = card.card_tier;
    if (tier === 1) {
      parts.push(
        'Doubles your current Shield block when this resolves (shield absorbs damage before HP; no extra printed block beyond that).',
      );
    } else if (tier === 2) {
      parts.push(
        'Doubles your current Shield block, then grants 4 block (potency applies to Shield skills).',
      );
    } else {
      parts.push(
        'Doubles your current Shield block, then grants 8 block (potency applies to Shield skills).',
      );
    }
  }
  const shieldConditioningText = /^neutral_shield_conditioning_t[123]$/.test(card.id);
  if (shieldConditioningText) {
    const retain = card.effects?.find((e) => e.type === 'SetShieldRoundRetainMultiplier');
    const x =
      retain && retain.type === 'SetShieldRoundRetainMultiplier'
        ? retain.retainMultiplier
        : COMBAT_RULES.shieldBlockRetainAtRoundStartDefault;
    parts.push('Persistent');
    parts.push(`Shield x${String(x)}`);
  }
  if (
    card.gain_charge &&
    !junkSurgeText &&
    !junkLoaderText &&
    !inductionPitText &&
    !gutterOfferingText &&
    !neutralFeintText &&
    !multiStrikeText &&
    !stripMineText
  ) {
    parts.push(`Gains ${card.gain_charge} Energy.`);
  }
  if (card.optional_spend_junk_for_charge && !junkSurgeText) {
    const o = card.optional_spend_junk_for_charge;
    parts.push(`May spend ${o.spend} Junk to gain +${o.gainCharge} Energy.`);
  }
  if (card.gain_junk && !junkLoaderText) {
    parts.push(`Gains ${card.gain_junk} junk.`);
  }
  if (card.gain_core && !coreRefactoringText && !coreRebirthText) {
    parts.push(`Gains ${card.gain_core} refined scrap.`);
  }
  if (card.spend_junk && !stripMineText) {
    parts.push(`Spends ${card.spend_junk} junk.`);
  }
  if (card.spend_core && !coreTapBranchText) {
    parts.push(`Spends ${card.spend_core} refined scrap.`);
  }
  const strikePot = card.strike_potency_gain ?? 0;
  const shieldPot = card.shield_potency_gain ?? 0;
  if (strikePot > 0 || shieldPot > 0) {
    const bits: string[] = [];
    if (strikePot > 0) {
      bits.push(`+${String(strikePot)} damage on Strike skills`);
    }
    if (shieldPot > 0) {
      bits.push(`+${String(shieldPot)} block on Shield skills`);
    }
    parts.push(`${bits.join('; ')} (potency).`);
  }
  if (card.heal_self) {
    parts.push(`Heals ${card.heal_self} HP (self, capped at max).`);
  }
  if (card.charge_cost_if_core_gte) {
    const o = card.charge_cost_if_core_gte;
    parts.push(
      `Energy cost is ${o.chargeCost} if you have at least ${o.minCore} refined scrap (otherwise ${card.charge_cost}).`,
    );
  }
  if (card.bonus_strike_damage_if_junk_plus_core_gte) {
    const b = card.bonus_strike_damage_if_junk_plus_core_gte;
    parts.push(`+${b.bonus} damage if junk + refined scrap ≥ ${b.threshold}.`);
  }
  if (card.bonus_block_if_junk_plus_core_gte) {
    const b = card.bonus_block_if_junk_plus_core_gte;
    parts.push(`+${b.bonus} block if junk + refined scrap ≥ ${b.threshold}.`);
  }
  if (card.bonus_block_per_junk_held) {
    const cap = card.bonus_block_per_junk_held.cap;
    parts.push(
      cap !== undefined
        ? `+1 block per junk held (max +${cap}).`
        : '+1 block per junk held.',
    );
  }

  if (
    !coreRefactoringText &&
    !coreRebirthText &&
    !coreTapBranchText &&
    !coreSacrificeText
  ) {
    for (const kw of card.keywords) {
      if (capitalisingStrikeText && kw.type === 'Pierce') {
        continue;
      }
      if (exposeDroneUplinkText && kw.type === 'Continuous') {
        continue;
      }
      if (junkGeneratorText && kw.type === 'Continuous') {
        continue;
      }
      if (omit) {
        parts.push(compactKeywordHeadline(kw));
      } else {
        parts.push(keywordEffectLine(kw));
      }
    }
  }

  if (!omit && card.tags.length > 0) {
    parts.push(`Tags: ${card.tags.join(', ')}.`);
  }

  if (!parts.length) {
    parts.push(fallbackWhenEmpty(card));
  }

  return parts.join('\n');
}
