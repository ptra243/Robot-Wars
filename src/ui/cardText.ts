import { COMBAT_RULES } from '../core/rules';
import type { CardDef, KeywordSpec } from '../core/types';
import { stripSelfHpPlayCostFromDescriptionText } from './hpPlayCost';

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
        ? `Overclock ${v}: bonus-resolves the next card in your queue once per your turn (first eligible Overclock on that turn; no energy cost on Overclock carriers).`
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
      return `Core parts: marks a core-parts card (filter; Core Rebirth upgrades the next Neutral Basic Strike(s) in queue order into one of these at the same tier).`;
    case 'UniqueDeck':
      return `UniqueDeck: your deck may include at most one copy of any card with this keyword (hand + fatigue deck combined).`;
    case 'Persistent':
      return `Persistent: marks a rest-of-battle effect on this card (see printed rules). Counts toward the Continuous/Persistent deck limit.`;
  }
}

function compactKeywordHeadline(spec: KeywordSpec): string {
  return `${spec.type} ${spec.value}.`;
}

function tieredNumber(tier: number, t1: number, t2: number, t3: number): number {
  if (tier >= 3) {
    return t3;
  }
  if (tier === 2) {
    return t2;
  }
  return t1;
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
      'Baseline: +1 Energy, +1 Junk\nJunk ≥ 4: +2 Energy, +2 Junk\nJunk ≥ 10: +Energy — floor(junk at snapshot ÷ 4)\nTags: Junk, Energy.',
    compact:
      'Baseline: +1 Energy, +1 Junk\nJunk ≥ 4: +2 Energy, +2 Junk\nJunk ≥ 10: +Energy from pile size',
  },
  junk_bulwark_t1: {
    full:
      'Energy 1\nShield 3\nJunk ≥ 5: Bulk 2\nJunk ≥ 10: Shield — your bulk stacks + potency (stack this Shield for Junk Aegis)\nTags: Shield, Junk.',
    compact:
      'Energy 1 · Shield 3\nJunk ≥ 5: Bulk 2\nJunk ≥ 10: Shield from bulk + potency',
  },
  junk_ladder_t1: {
    full: '5 non-Strike damage\nJunk ≥ 8: Overclock (once)\nTags: Direct, Junk.',
    compact: '5 non-Strike damage\nJunk ≥ 8: Overclock',
  },
  junk_gasket_t1: {
    full:
      'Baseline: +1 Energy, +1 Junk\nJunk ≥ 4: Bulk 1, +1 Energy, +1 Junk\nJunk ≥ 10: Overclock (once)\nTags: Junk, Energy.',
    compact:
      'Baseline: +1 Energy, +1 Junk\nJunk ≥ 4: Bulk + fuel\nJunk ≥ 10: Overclock',
  },
  junk_coil_t1: {
    full:
      'Baseline: +1 Energy\nJunk ≥ 4: Gain Junk equal to your Energy (after the baseline +1)\nJunk ≥ 12: If you can pay 4 Energy — +potency, floor(junk at snapshot ÷ 4)\nTags: Junk, Energy.',
    compact:
      '+1 Energy\nJunk ≥ 4: Junk gained = your Energy\nJunk ≥ 12: Pay 4 Energy → potency from pile',
  },
  junk_aegis_t1: {
    full:
      'Energy 2\nBulk 1\nJunk ≥ 4: Shield — floor(junk at snapshot ÷ 4) + potency\nJunk ≥ 11: Deal non-Strike damage to enemy equal to your Shield (after the lines above)\nTags: Shield, Junk.',
    compact:
      'Energy 2\nBulk 1\nJunk ≥ 4: Shield from junk + potency\nJunk ≥ 11: Damage dealt = your Shield',
  },
  junk_rivet_t1: {
    full:
      'Energy 1\nStrike 4 (potency applies)\nJunk ≥ 5: Expose — max(1, floor(junk at snapshot ÷ 4))\nJunk ≥ 10: +2 Strike damage\nJunk ≥ 12: +5 Strike damage\nTags: Strike, Expose, Junk.',
    compact:
      'Energy 1 · Strike 4\nJunk ≥ 5: Expose from pile\nJunk ≥ 10: +2 Strike damage\nJunk ≥ 12: +5 Strike damage',
  },
  junk_crown_t1: {
    full:
      'Energy 2\n5 non-Strike damage\nJunk ≥ 8: Overclock (once on this card)\nJunk ≥ 15: If you can pay 4 Energy — +2 Energy, then 1 non-Strike damage per junk at snapshot\nTags: Direct, Junk.',
    compact:
      'Energy 2 · 5 non-Strike damage\nJunk ≥ 8: Overclock\nJunk ≥ 15: Pay 4 Energy → pile damage line',
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
    const raw = omit ? junkThresholdPinned.compact : junkThresholdPinned.full;
    return stripSelfHpPlayCostFromDescriptionText(raw, card);
  }

  const coreTapBranchText = /^core_tap_t[123]$/.test(card.id);
  const coreSacrificeText = /^deep_core_tap_t[123]$/.test(card.id);
  const coreRefactoringText = /^core_refactoring_t[123]$/.test(card.id);
  const coreRebirthText = /^core_rebirth_t[123]$/.test(card.id);
  const sacrifCustomText = /^sacrif_(lumen|spike|plate|probe|tether|echo|cinder|forge|rift|suture)_t[123]$/.test(
    card.id,
  );
  const sacrifLumenText = /^sacrif_lumen_t[123]$/.test(card.id);
  const sacrifSpikeText = /^sacrif_spike_t[123]$/.test(card.id);
  const sacrifPlateText = /^sacrif_plate_t[123]$/.test(card.id);
  const sacrifProbeText = /^sacrif_probe_t[123]$/.test(card.id);
  const sacrifTetherText = /^sacrif_tether_t[123]$/.test(card.id);
  const sacrifEchoText = /^sacrif_echo_t[123]$/.test(card.id);
  const sacrifCinderText = /^sacrif_cinder_t[123]$/.test(card.id);
  const sacrifForgeText = /^sacrif_forge_t[123]$/.test(card.id);
  const sacrifRiftText = /^sacrif_rift_t[123]$/.test(card.id);
  const sacrifSutureText = /^sacrif_suture_t[123]$/.test(card.id);

  const junkSurgeText = card.id === 'field_diode_t1';
  const junkLoaderText = /^junk_loader_t[123]$/.test(card.id);
  const junkGeneratorText = /^junk_generator_t[12]$/.test(card.id);
  const inductionPitText = false;

  if (coreTapBranchText) {
    const tier = card.card_tier;
    const directDmg = tier === 3 ? 7 : tier === 2 ? 6 : 5;
    const j = tier === 3 ? 2 : 1;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Deal ${String(directDmg)} direct damage to the enemy.`);
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
  }

  if (coreSacrificeText) {
    const strike = tieredNumber(card.card_tier, 7, 9, 11);
    const j = card.card_tier === 3 ? 2 : 1;
    const b = card.card_tier;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Bulk ${String(b)}`);
    parts.push(`This Strike deals ${String(strike)} base damage (uses strike potency).`);
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
  }

  if (coreRefactoringText) {
    const oc = card.keywords.find((k) => k.type === 'Overclock')?.value ?? 1;
    const j = card.card_tier === 3 ? 3 : 2;
    parts.push('Lose 5 HP.');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Overclock ${String(oc)}`);
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
  }

  if (sacrifLumenText) {
    const t = card.card_tier;
    parts.push('Lose 2 HP (minimum 1).');
    if (t === 1) {
      parts.push('+2 Junk.');
      parts.push('+1 strike potency.');
    } else if (t === 2) {
      parts.push('+2 Junk.');
      parts.push('+2 strike potency.');
    } else {
      parts.push('+3 Junk.');
      parts.push('+2 strike potency.');
    }
  }
  if (sacrifSpikeText) {
    const d = card.card_tier === 3 ? 6 : card.card_tier === 2 ? 5 : 4;
    const j = card.card_tier === 3 ? 2 : 1;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Deal ${String(d)} direct damage to the enemy.`);
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
  }
  if (sacrifPlateText) {
    const b = card.card_tier === 3 ? 6 : card.card_tier === 2 ? 5 : 4;
    const j = card.card_tier === 3 ? 2 : 1;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(b)} shield.`);
    parts.push(`+${String(j)} Junk.`);
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
  }
  if (sacrifProbeText) {
    if (card.card_tier === 1) {
      parts.push('Lose 1 HP (minimum 1).');
      parts.push('+1 Energy.');
      parts.push('Expose 1');
      parts.push('+1 Junk');
    } else {
      const ex = card.card_tier === 3 ? 2 : 1;
      const j = card.card_tier === 3 ? 2 : 1;
      parts.push('Lose 5 HP (minimum 1).');
      parts.push('+1 Energy.');
      parts.push(`Expose ${String(ex)}`);
      parts.push(`+${String(j)} Junk.`);
      parts.push('Factory Reset');
      parts.push('Emergency Protocol 1');
    }
  }
  if (sacrifTetherText) {
    const j = card.card_tier === 3 ? 4 : card.card_tier === 2 ? 4 : 3;
    const e = card.card_tier === 3 ? 2 : 1;
    parts.push('Lose 1 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`+${String(e)} Energy.`);
  }
  if (sacrifEchoText) {
    const j = card.card_tier === 1 ? 2 : 3;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    if (card.card_tier === 3) {
      parts.push('+1 strike potency.');
    }
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
    parts.push(
      'Persistent: for the rest of the fight, Core-parts self-damage you take also deals that much non-Strike damage to the enemy (after this card resolves).',
    );
  }
  if (sacrifCinderText) {
    const b = card.card_tier;
    const d = card.card_tier === 3 ? 8 : card.card_tier === 2 ? 7 : 6;
    const j = card.card_tier === 3 ? 2 : 1;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Bulk ${String(b)}`);
    parts.push(`Deal ${String(d)} direct damage to the enemy.`);
    parts.push('Factory Reset');
    parts.push('Emergency Protocol 1');
  }
  if (sacrifForgeText) {
    const n = card.card_tier === 3 ? 2 : 1;
    const j = card.card_tier === 1 ? 1 : 2;
    const slotPhrase = n === 1 ? 'slot' : 'slots';
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push('Factory Reset');
    parts.push(
      `Replace next ${String(n)} Neutral Basic Strike ${slotPhrase} with random Core-parts cards (same tier).`,
    );
    parts.push('Emergency Protocol 1');
  }
  if (sacrifRiftText) {
    const s = card.card_tier === 3 ? 6 : card.card_tier === 2 ? 5 : 4;
    const d = card.card_tier === 3 ? 11 : card.card_tier === 2 ? 9 : 7;
    const j = card.card_tier === 3 ? 3 : 2;
    parts.push(`Lose ${String(s)} HP (self-damage, not floored to 1).`);
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Deal ${String(d)} direct damage to the enemy.`);
  }
  if (sacrifSutureText) {
    const h = card.card_tier === 1 ? 2 : 3;
    const j = card.card_tier === 3 ? 3 : 2;
    parts.push('Lose 3 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Heal ${String(h)} HP.`);
    if (card.card_tier === 3) {
      parts.push('+1 strike potency.');
    }
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
    const j = card.card_tier === 3 || card.card_tier === 2 ? 2 : 1;
    parts.push('Lose 5 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push('Factory Reset');
    parts.push(
      `Replace next ${String(n)} Neutral Basic Strike ${slotPhrase} with random Core-parts cards (same tier).`,
    );
    parts.push('Emergency Protocol 1');
  }

  if (
    card.base_damage &&
    !sacrifCustomText &&
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
  if (card.base_block && !sacrifCustomText && !shieldReinf) {
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
    if (omit) {
      parts.push(`Persistent: Shield retention x${x.toFixed(2)} for the rest of battle.`);
    } else if (x === 0.75) {
      parts.push(
        'Persistent: for the rest of battle, your Shield retention at round start is x0.75 (you keep 75% instead of the default 50%).',
      );
    } else if (x === 1) {
      parts.push(
        'Persistent: for the rest of battle, your Shield retention at round start is x1.00 (no Shield decay).',
      );
    } else {
      parts.push(
        `Persistent: for the rest of battle, your Shield retention at round start is x${x.toFixed(2)}.`,
      );
    }
  }
  if (
    card.gain_charge &&
    !sacrifCustomText &&
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
  if (card.gain_junk && !sacrifCustomText && !junkLoaderText) {
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
  if (card.heal_self && !sacrifCustomText) {
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

  if (!sacrifCustomText && !coreRefactoringText && !coreRebirthText && !coreTapBranchText && !coreSacrificeText) {
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
      if (shieldConditioningText && kw.type === 'Persistent') {
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

  return stripSelfHpPlayCostFromDescriptionText(parts.join('\n'), card);
}
