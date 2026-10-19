import { COMBAT_RULES } from '../core/rules';
import type { CardDef, EffectStep, KeywordSpec, KeywordType } from '../core/types';
import { stripSelfHpPlayCostFromDescriptionText } from './hpPlayCost';

export interface BuildCardDescriptionOptions {
  /** Omit tag/keyword summary lines (e.g. when shown in a side glossary). */
  omitTagsAndKeywords?: boolean;
  /** Active player trait IDs used for context-sensitive description notes. */
  activeTraitIds?: readonly string[];
}

export function cyberpunkNeutralTraitBonusLine(
  card: CardDef,
  activeTraitIds: readonly string[] | undefined,
): string | null {
  if (!card.neutral || !activeTraitIds || activeTraitIds.length === 0) return null;
  if (activeTraitIds.includes('seiryu_base')) {
    return '[[trait-bonus:dragon]]Pilot bonus (Azure Opening): neutral card also grants +1 Energy and counts as Dragon stance activation.[[/trait-bonus]]';
  }
  if (activeTraitIds.includes('suzaku_base')) {
    return '[[trait-bonus:bird]]Pilot bonus (Vermilion Opening): neutral card also grants +1 Shuriken and counts as Bird stance activation.[[/trait-bonus]]';
  }
  if (activeTraitIds.includes('byakko_base')) {
    return '[[trait-bonus:tiger]]Pilot bonus (White Opening): neutral card also applies Expose 1 and counts as Tiger stance activation.[[/trait-bonus]]';
  }
  if (activeTraitIds.includes('genbu_base')) {
    return '[[trait-bonus:tortoise]]Pilot bonus (Black Opening): neutral card also grants Shield 2 and counts as Tortoise stance activation.[[/trait-bonus]]';
  }
  return null;
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
    case 'Switch':
      return `Switch ${v}: set your current stance; stance-conditional lines only activate while you are in the required stance.`;
    case 'TurboLink':
      return `TurboLink ${v}: spend between 1 and ${v} bulk stacks for junk, then bonus-resolve the next queued card when allowed.`;
    case 'Continuous':
      return `Continuous ${v}: while this slot keeps resolving, every ${v} rounds you gain +1 Junk and +1 Energy from it.`;
    case 'Pierce':
      return `Pierce${v !== 1 ? ` ${v}` : ''}: damage from this card ignores block.`;
    case 'FactoryReset':
      return 'Factory Reset: destroy this card; the slot rematerializes as an empty/blank (Basic Strike, or relic-upgraded blanks).';
    case 'CoreParts':
      return 'Legacy CoreParts marker (unused on current prints).';
    case 'UniqueDeck':
      return `UniqueDeck: your deck may include at most one copy of any card with this keyword (hand + fatigue deck combined).`;
    case 'Persistent':
      return `Persistent: marks a rest-of-battle effect on this card (see printed rules). Counts toward the Continuous/Persistent deck limit.`;
    case 'Prime':
      return '**Prime**: bonus lines on this card fire when it resolves from a **Prime** program slot (natural slots 3, 5, and 7; pilots/relics can add more).';
    case 'Sequence':
      return `**Sequence** ${v}: this bonus line triggers only when your previous Clockwork resolution completed Sequence ${String(
        Math.max(1, v - 1),
      )} (Sequence 1 / Start is an opener).`;
    case 'Faith':
      return `**Faith** ${v}: each Faith stack adds +1 damage to **Strike** and **Direct** packets resolved from a **Prime** slot.`;
    case 'Virus':
      return `Virus ${v}: apply ${v} virus stack(s).`;
    case 'Evade':
      return `Evade ${v}: gain ${v} evade stack(s). Each stack negates one incoming Strike packet.`;
    case 'Shuriken':
      return `Shuriken ${v}: gain ${v} shuriken stack(s) for unload cards.`;
    case 'Stance':
      return `Stance ${v}: stance-tech marker for Four Symbols cards.`;
  }
}

function compactKeywordHeadline(spec: KeywordSpec): string {
  if (spec.type === 'Prime') return '**Prime**.';
  if (spec.type === 'Faith') return `**Faith** ${spec.value}.`;
  if (spec.type === 'Sequence') {
    return spec.value === 1 ? '**Sequence** Start.' : `**Sequence** ${spec.value}.`;
  }
  if (spec.type === 'Persistent') return '**Persistent**.';
  return `**${spec.type}** ${spec.value}.`;
}

/** Compact printed line for one effect step (used by Prime / Sequence / Faith riders). */
function summarizeEffectStep(step: EffectStep): string | null {
  switch (step.type) {
    case 'DirectHpDamage':
      return `Deal ${String(step.baseDamage)} **direct** damage`;
    case 'StrikeDamage':
      return `**Strike** ${String(step.baseDamage)}`;
    case 'ShieldBlock':
      return `**Shield** ${String(step.baseBlock)}`;
    case 'HealSelf':
      return `Heal ${String(step.amount)}`;
    case 'GainFaith':
      return `**Faith** ${String(step.amount)}`;
    case 'GainCharge':
      return `**Energy** ${String(step.amount)}`;
    case 'AddStrikePotency':
      return `+${String(step.amount)} **Potency**`;
    case 'AddShieldPotency':
      return `+${String(step.amount)} **Shield** potency`;
    case 'AddPrimeSlotStrikePotencyBonus':
      return `cards on **Prime** slots gain +${String(step.amount)} **Potency**`;
    case 'GrantTemporaryPrimeSlots':
      return `Temporary **Prime** ×${String(step.count)}`;
    case 'ApplyWeaken':
      return `Weaken ${String(step.stacks)}`;
    case 'ApplyVirus':
      return `**Virus** ${String(step.stacks)}`;
    case 'GainEvade':
      return `**Evade** ${String(step.amount)}`;
    case 'GainShuriken':
      return `**Shuriken** ${String(step.amount)}`;
    case 'SelfDamageRespectFloor1':
      return `Lose ${String(step.amount)} HP (min 1)`;
    case 'SelfDamage':
      return `Lose ${String(step.amount)} HP`;
    case 'GainJunk':
      return `+${String(step.amount)} **Junk**`;
    case 'GainCore':
      return `+${String(step.amount)} **Refined Scrap**`;
    case 'SpendJunk':
      return `Spend ${String(step.amount)} **Junk**`;
    case 'SpendCore':
      return `Spend ${String(step.amount)} **Refined Scrap**`;
    case 'GainMaxHp':
      return `+${String(step.amount)} max HP`;
    case 'SetBloodToScrapJunkPerSelfDamage':
      return `**Persistent**: when you take card self-damage, gain ${String(step.amount)} **Junk** per HP lost`;
    case 'SetHeapPadding':
      return `**Persistent**: while **Junk** ≥ ${String(step.minJunk)}, reduce card self-damage by ${String(step.reduceBy)}`;
    case 'SetHeapBallast':
      return `**Persistent**: while **Junk** ≥ ${String(step.minJunk)}, reduce incoming damage by ${String(step.reduceBy)}`;
    case 'SetScrapAnesthetic':
      return `**Persistent**: when you take card self-damage, gain up to ${String(step.capPerHit)} Shield (${String(step.blockPerHpLost)} per HP lost)`;
    case 'ConvertScrapEngines': {
      const junk =
        step.spendJunk != null && step.spendJunk > 0
          ? `Spend ${String(step.spendJunk)} **Junk**, `
          : '';
      const label =
        step.into === 'attack'
          ? 'Scrap Hound (attack)'
          : step.into === 'shield'
            ? 'Scrap Hound (shield)'
            : step.into === 'energy'
              ? 'Energy Engine'
              : 'Expose Engine';
      return `${junk}convert up to ${String(step.maxEngines)} **Scrap Engine**(s) into **${label}**`;
    }
    case 'SetStrikeResolveBonusJunk':
      return `**Persistent**: Strikes grant +${String(step.amount)} **Junk**`;
    case 'SetStrikeResolveBonusJunkIfHpFractionAtMost':
      return `**Persistent**: while at ≤${String(Math.round(step.maxHpFraction * 100))}% HP, Strikes grant +${String(step.amount)} **Junk**`;
    case 'SetFirstCardOfCycleBonusCharge':
      return `**Persistent**: first card each program cycle gains +${String(step.amount)} **Energy**`;
    case 'GainScrapEngine':
      return `Gain ${String(step.amount)} **Scrap Engine** (+1 **Junk** at the start of each of your turns per engine)`;
    case 'DirectHpDamagePerScrapEngine':
      return `Deal ${String(step.damagePerEngine)} **direct** damage per **Scrap Engine**`;
    case 'BranchIfMissingHpGte': {
      const thenText = summarizeEffectSteps(step.thenSteps);
      const elseText = summarizeEffectSteps(step.elseSteps);
      if (thenText && elseText) {
        return `If missing ≥${String(step.minMissing)} HP: ${thenText}; otherwise ${elseText}`;
      }
      if (thenText) return `If missing ≥${String(step.minMissing)} HP: ${thenText}`;
      return null;
    }
    case 'BranchIfJunkGte': {
      const thenText = summarizeEffectSteps(step.thenSteps);
      if (!thenText) return null;
      return `**Junk** ≥ ${String(step.minJunk)}: ${thenText}`;
    }
    case 'TransformCurrentQueueSlot':
      return 'Factory Reset';
    case 'ReplaceRandomNeutralBasicWithCorePartsCard':
      return 'Replace the next Neutral Basic Strike(s) in queue with a **Factory Reset** card of this card’s tier';
    case 'GainEmergencyProtocolStacks':
      return `Gain ${String(step.amount)} **Emergency Protocol** (end of your turn: take self-damage equal to stacks; whenever you would hit 0 HP, spend 1 stack, +1 potency, survive at 1 HP)`;
    case 'ScheduleEffectAfterRounds': {
      const inner = summarizeEffectSteps(step.steps);
      return inner ? `Delayed ${String(step.delayRounds)} → ${inner}` : `Delayed ${String(step.delayRounds)}`;
    }
    case 'Keyword':
      if (step.spec.type === 'Overclock') return '**Overclock**';
      if (step.spec.type === 'Pierce') return '**Pierce**';
      if (step.spec.type === 'Continuous') return `**Continuous** ${String(step.spec.value)}`;
      if (step.spec.type === 'Persistent') return null; // printed via Set* install lines
      if (step.spec.type === 'CoreParts') return null; // filter chip; body prints real effects
      return `**${step.spec.type}** ${String(step.spec.value)}`;
    default:
      return null;
  }
}

/** True when this step installs a rest-of-battle Persistent rule (body text already says Persistent). */
function isPersistentInstallStep(step: EffectStep): boolean {
  return (
    step.type === 'SetBloodToScrapJunkPerSelfDamage' ||
    step.type === 'SetHeapPadding' ||
    step.type === 'SetHeapBallast' ||
    step.type === 'SetScrapAnesthetic' ||
    step.type === 'SetStrikeResolveBonusJunk' ||
    step.type === 'SetStrikeResolveBonusJunkIfHpFractionAtMost' ||
    step.type === 'SetFirstCardOfCycleBonusCharge'
  );
}

/**
 * Generic effect-pipeline body lines for cards that are not pinned / clockwork-special-cased.
 * Skips bare Continuous Keyword steps when `continuous_min_junk` is set (Heap Battery) — those use a custom line.
 */
function buildEffectPipelineBodyLines(card: CardDef): string[] {
  const lines: string[] = [];
  const effects = card.effects ?? [];
  const heapBattery =
    card.continuous_min_junk !== undefined &&
    (card.keywords ?? []).some((k) => k.type === 'Continuous');
  if (heapBattery) {
    const interval = card.keywords.find((k) => k.type === 'Continuous')?.value ?? 3;
    const charge = card.continuous_charge_per_tick ?? 1;
    const junk = card.continuous_junk_per_tick ?? 1;
    const junkBit = junk > 0 ? `, **Junk** ${String(junk)}` : '';
    lines.push(
      `**Continuous** ${String(interval)}: while **Junk** ≥ ${String(card.continuous_min_junk)}, **Energy** ${String(charge)}${junkBit}.`,
    );
    return lines;
  }
  for (const step of effects) {
    if (step.type === 'Keyword' && step.spec.type === 'Continuous') {
      // Continuous keyword on keywords[] is enough; avoid double-print from effects Keyword copy.
      continue;
    }
    const text = summarizeEffectStep(step);
    if (text) lines.push(`${text}.`);
  }
  return lines;
}

function summarizeEffectSteps(steps: readonly EffectStep[]): string {
  return steps
    .map((s) => summarizeEffectStep(s))
    .filter((s): s is string => Boolean(s))
    .join(', ');
}

function sequenceLabel(step: number): string {
  return step <= 1 ? '**Sequence** Start' : `**Sequence** ${String(step)}`;
}

/**
 * Prefer printed effect lines (including Prime / Sequence / Faith riders) over generic keyword blurbs.
 * Returns null when the card has no branch riders to describe this way.
 */
function buildEffectDrivenClockworkLines(card: CardDef): string[] | null {
  const effects = card.effects ?? [];
  const hasRider = effects.some(
    (e) =>
      e.type === 'BranchIfOnPrimeSlot' ||
      e.type === 'BranchIfClockworkSequence' ||
      e.type === 'BranchIfFaithGte',
  );
  if (!hasRider) {
    return null;
  }

  const lines: string[] = [];
  for (const step of effects) {
    if (step.type === 'BranchIfOnPrimeSlot') {
      const thenText = summarizeEffectSteps(step.thenSteps);
      const elseText = summarizeEffectSteps(step.elseSteps);
      if (thenText && elseText && thenText === elseText) {
        /* Same on and off Prime (e.g. Consecration) — print once as baseline. */
        lines.push(`${thenText}.`);
      } else if (thenText) {
        lines.push(`**Prime**: ${thenText}.`);
      }
      continue;
    }
    if (step.type === 'BranchIfClockworkSequence') {
      const thenText = summarizeEffectSteps(step.thenSteps);
      if (thenText) {
        lines.push(`${sequenceLabel(step.step)}: ${thenText}.`);
      }
      continue;
    }
    if (step.type === 'BranchIfFaithGte') {
      const thenText = summarizeEffectSteps(step.thenSteps);
      if (thenText) {
        lines.push(`**Faith** ${String(step.minFaith)}: ${thenText}.`);
      }
      continue;
    }
    const baseline = summarizeEffectStep(step);
    if (baseline) {
      lines.push(`${baseline}.`);
    }
  }
  return lines.length > 0 ? lines : null;
}

const KEYWORDS_COVERED_BY_EFFECT_RIDERS = new Set<KeywordType>([
  'Prime',
  'Sequence',
  'Faith',
  'Persistent',
]);

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

function firstStrikeBaseDamage(card: CardDef): number | undefined {
  for (const step of card.effects ?? []) {
    if (step.type === 'StrikeDamage') {
      return step.baseDamage;
    }
  }
  return undefined;
}

function firstDelayedStep(card: CardDef):
  | { delayRounds: number; kind: 'direct' | 'shield'; amount: number }
  | undefined {
  for (const step of card.effects ?? []) {
    if (step.type !== 'ScheduleEffectAfterRounds') {
      continue;
    }
    for (const delayed of step.steps) {
      if (delayed.type === 'DirectHpDamage') {
        return { delayRounds: step.delayRounds, kind: 'direct', amount: delayed.baseDamage };
      }
      if (delayed.type === 'ShieldBlock') {
        return { delayRounds: step.delayRounds, kind: 'shield', amount: delayed.baseBlock };
      }
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

const CYBERPUNK_CARD_TEXT: Record<string, { full: string; compact: string }> = {
  ninja_tortoise_guard_t1: {
    full: 'Shield 4.\nSwitch stance to Tortoise.\nTags: Shield, Stance.',
    compact: 'Shield 4.\nSwitch to Tortoise.',
  },
  ninja_tortoise_virus_t1: {
    full: 'Shield 3.\nIf in Tortoise: apply Virus 2.\nTags: Shield, Virus, Stance.',
    compact: 'Shield 3.\n**Tortoise Stance**: **Virus** 2.',
  },
  ninja_tiger_mark_t1: {
    full: 'Expose 1.\nSwitch stance to Tiger.\nTags: Expose, Stance.',
    compact: 'Expose 1.\nSwitch to Tiger.',
  },
  ninja_tiger_double_strike_t1: {
    full: 'Strike 3.\nIf in Tiger: Strike 3 again.\nTags: Strike, Stance.',
    compact: 'Strike 3.\n**Tiger Stance**: Strike 3.',
  },
  ninja_dragon_charge_t1: {
    full: 'Gain 1 Energy.\nSwitch stance to Dragon.\nTags: Energy, Stance.',
    compact: 'Energy 1.\nSwitch to Dragon.',
  },
  ninja_dragon_threshold_bolt_t1: {
    full: 'Gain 1 Energy.\nIf in Dragon and Energy >= 6: deal 5 direct damage.\nIf in Dragon and Energy >= 11: deal another 5 direct damage.\nTags: Direct, Energy, Stance.',
    compact: 'Energy 1.\nDragon thresholds: 6/11 EN -> 5+5 direct.',
  },
  ninja_bird_reload_t1: {
    full: 'Gain 1 shuriken.\nSwitch stance to Bird.\nTags: Shuriken, Stance.',
    compact: 'Shuriken +1.\nSwitch to Bird.',
  },
  ninja_bird_unload_t1: {
    full: 'Gain 1 **Shuriken**.\n**Bird Stance**: spend all **Shuriken**, deal 3 **Direct** damage per Shuriken spent.\nTags: Shuriken, Direct, Stance.',
    compact: '**Shuriken** +1.\n**Bird Stance**: unload for 3 **Direct** each.',
  },
  ninja_masterful_form_t1: {
    full: 'Gain 1 Energy.\nAdaptive glue stance card.\nTags: Energy, Stance.',
    compact: 'Energy 1.\nGlue stance enabler.',
  },
  ninja_smoke_step_t1: {
    full: 'Gain 1 Evade.\nTags: Evade, Stance.',
    compact: 'Evade 1.',
  },
  ninja_switch_harmony_kernel_t1: {
    full:
      '**Persistent**\nPersistent marker card for stance-switch decks.\nGain 1 Energy.\nHeal 2.\nTags: Energy, Stance.',
    compact:
      '**Persistent**\nPersistent marker for switch decks.\nEnergy 1.\nHeal 2.',
  },
  ninja_dragon_ambush_t1: {
    full: 'Your next Tiger card applies bonus Expose per Energy (capped).\nTags: Stance, Expose.',
    compact: 'Next Tiger scales Expose from Energy (cap).',
  },
  ninja_tiger_ambush_t1: {
    full: 'Your next Tiger Strike gains Pierce and +3 potency this card, then lose 3 potency after it resolves.\nTags: Stance, Strike, Potency.',
    compact: 'Next Tiger Strike: Pierce, +3 potency, then -3 potency.',
  },
  ninja_bird_overclock_t1: {
    full: 'Gain 2 shuriken.\nYour next Tiger card gains Overclock.\nTags: Stance, Shuriken.',
    compact: 'Shuriken +2.\nNext Tiger gains Overclock.',
  },
  ninja_tortoise_virus_pulse_t1: {
    full: 'Shield 4.\nApply Virus 3.\nTags: Virus, Shield, Stance.',
    compact: 'Shield 4.\nVirus 3.',
  },
  ninja_mono_dragon_focus_t1: {
    full: 'Gain 1 Energy.\nIf in Dragon: deal 8 direct damage.\nMono-stance payoff card.\nTags: Stance, Energy, Direct.',
    compact: 'Energy 1.\n**Dragon Stance**: 8 **Direct**.',
  },
  ninja_mono_tiger_focus_t1: {
    full: 'Strike 4.\nIf in Tiger: Expose 2, then Strike 4 again.\nMono-stance payoff card.\nTags: Stance, Strike, Expose.',
    compact: 'Strike 4.\n**Tiger Stance**: **Expose** 2 + Strike 4.',
  },
  ninja_mono_bird_focus_t1: {
    full: 'Gain 2 shuriken.\nIf in Bird: spend all shuriken for 4 direct damage per shuriken.\nMono-stance payoff card.\nTags: Stance, Shuriken, Direct.',
    compact: 'Shuriken +2.\n**Bird Stance**: unload for 4 **Direct** each.',
  },
  ninja_mono_tortoise_focus_t1: {
    full: 'Shield 5.\nIf in Tortoise: apply Virus 3 and gain Virulent Retribution 1.\nMono-stance payoff card.\nTags: Stance, Shield, Virus.',
    compact: 'Shield 5.\nTortoise: Virus 3 + Retribution 1.',
  },
  ninja_compass_release_t1: {
    full: 'Deal 8 direct damage.\nGain 1 Energy.\nCompass payoff finisher.\nTags: Direct, Stance.',
    compact: 'Direct 8.\nEnergy 1.\nCompass finisher.',
  },
  ninja_celestial_formation_t1: {
    full: 'Deal 5 direct damage per different stance you have activated this battle.\nMulti-stance payoff card.\nTags: Direct, Stance.',
    compact: '5 direct per activated stance.',
  },
  ninja_taiji_formation_t1: {
    full: '**Dragon**: 6 **Direct** damage.\n**Tiger**: **Weaken** 3.\n**Tortoise**: **Shield** 6.\n**Bird**: **Evade** 1.\nEach line activates only if that stance has been activated this battle.\nTags: Stance, Direct, Shield.',
    compact:
      '**Dragon**: 6 **Direct**.\n**Tiger**: **Weaken** 3.\n**Tortoise**: **Shield** 6.\n**Bird**: **Evade** 1.',
  },
  ninja_all_out_attack_t1: {
    full: '**Dragon**: **Potency** 2.\n**Tortoise**: **Virus** 5.\n**Tiger**: **Strike** 8.\n**Bird**: **Overclock**.\nEach line activates only if that stance has been activated this battle.\nTags: Stance, Strike, Virus, Potency.',
    compact:
      '**Dragon**: **Potency** 2.\n**Tortoise**: **Virus** 5.\n**Tiger**: **Strike** 8.\n**Bird**: **Overclock**.',
  },
  ninja_duo_dragon_tiger_t1: {
    full: '**Direct** 3.\n**Dragon**: Next Tiger card gains bonus **Expose** per **Energy** (cap 4).\nSwitch **Tiger**.\nTags: Stance, Direct, Expose.',
    compact:
      '**Direct** 3.\n**Dragon**: Next Tiger gains **Expose** per **Energy**.\nSwitch **Tiger**.',
  },
  ninja_duo_tiger_dragon_t1: {
    full: '**Expose** 1.\n**Tiger**: Gain 1 **Energy** and 1 **Potency**.\nSwitch **Dragon**.\nTags: Stance, Energy, Potency.',
    compact: '**Expose** 1.\n**Tiger**: **Energy** 1, **Potency** 1.\nSwitch **Dragon**.',
  },
  ninja_duo_dragon_bird_t1: {
    full: 'Gain 1 **Energy**.\n**Dragon**: Gain 2 **Shuriken**.\nSwitch **Bird**.\nTags: Stance, Shuriken, Energy.',
    compact: '**Energy** 1.\n**Dragon**: **Shuriken** 2.\nSwitch **Bird**.',
  },
  ninja_duo_bird_dragon_t1: {
    full: 'Unload: deal 2 **Direct** damage per **Shuriken** spent.\n**Bird**: Gain 2 **Energy**.\nSwitch **Dragon**.\nTags: Stance, Direct, Shuriken.',
    compact:
      'Unload 2 **Direct** per **Shuriken**.\n**Bird**: **Energy** 2.\nSwitch **Dragon**.',
  },
  ninja_duo_dragon_tortoise_t1: {
    full: '**Shield** 3.\n**Dragon**: You may spend 2 **Energy** to gain **Shield** 6 and delayed **Shield** 4.\nSwitch **Tortoise**.\nTags: Stance, Shield, Energy.',
    compact:
      '**Shield** 3.\n**Dragon**: Pay 2 **Energy** -> **Shield** 6 + delayed **Shield** 4.\nSwitch **Tortoise**.',
  },
  ninja_duo_tortoise_dragon_t1: {
    full: '**Shield** 4.\n**Tortoise**: Consume up to 8 **Shield** to deal **Direct** damage (2 Shield -> 1 damage).\nSwitch **Dragon**.\nTags: Stance, Direct, Shield.',
    compact:
      '**Shield** 4.\n**Tortoise**: Convert **Shield** into **Direct** damage.\nSwitch **Dragon**.',
  },
  ninja_duo_tiger_bird_t1: {
    full: 'Gain 1 **Shuriken**.\n**Tiger**: Apply **Expose** 2 and your next Tiger card gains **Overclock**.\nSwitch **Bird**.\nTags: Stance, Shuriken, Expose.',
    compact:
      '**Shuriken** 1.\n**Tiger**: **Expose** 2, next Tiger gains **Overclock**.\nSwitch **Bird**.',
  },
  ninja_duo_bird_tiger_t1: {
    full: 'Gain 1 **Evade**.\n**Bird**: Your next Tiger card gains **Overclock**.\nSwitch **Tiger**.\nTags: Stance, Evade.',
    compact:
      '**Evade** 1.\n**Bird**: Next Tiger gains **Overclock**.\nSwitch **Tiger**.',
  },
  ninja_duo_tiger_tortoise_t1: {
    full: '**Shield** 4.\n**Tiger**: Gain 2 **Potency** and 1 **Virulent Retribution**.\nSwitch **Tortoise**.\nTags: Stance, Shield, Potency.',
    compact:
      '**Shield** 4.\n**Tiger**: **Potency** 2 + **Virulent Retribution** 1.\nSwitch **Tortoise**.',
  },
  ninja_duo_tortoise_tiger_t1: {
    full: 'Apply **Virus** 2.\n**Tortoise**: Next Tiger card gains extra **Strike**s from target **Virus** (cap 3).\nSwitch **Tiger**.\nTags: Stance, Strike, Virus.',
    compact:
      '**Virus** 2.\n**Tortoise**: Next Tiger gains extra **Strike**s from **Virus**.\nSwitch **Tiger**.',
  },
  ninja_duo_bird_tortoise_t1: {
    full: 'Gain 1 **Shuriken**.\n**Bird**: Consume all **Shuriken**, gain 3 **Shield** per Shuriken and 1 **Virulent Retribution**.\nSwitch **Tortoise**.\nTags: Stance, Shield, Shuriken.',
    compact:
      '**Shuriken** 1.\n**Bird**: Consume **Shuriken** -> **Shield** + **Virulent Retribution**.\nSwitch **Tortoise**.',
  },
  ninja_duo_tortoise_bird_t1: {
    full: 'Gain 1 **Shuriken**.\n**Tortoise**: Your next Shuriken unload applies **Virus** per hit.\nSwitch **Bird**.\nTags: Stance, Shuriken, Virus.',
    compact:
      '**Shuriken** 1.\n**Tortoise**: Next unload imbues **Virus**.\nSwitch **Bird**.',
  },
};

const CLOCKWORK_CARD_TEXT: Record<string, { full: string; compact: string }> = {
  clockwork_song_iron_intro_t1: {
    full:
      '**Strike** 1.\n**Sequence** Start: **Strike** 2, +1 **Potency**.\nTags: Strike, Potency.',
    compact: '**Strike** 1.\n**Sequence** Start: **Strike** 2, +1 **Potency**.',
  },
  clockwork_song_iron_verse_t1: {
    full:
      '**Strike** 1.\n**Sequence** 2: **Strike** 4, +1 **Potency**.\nTags: Strike, Potency.',
    compact: '**Strike** 1.\n**Sequence** 2: **Strike** 4, +1 **Potency**.',
  },
  clockwork_song_sanctuary_intro_t1: {
    full: '**Shield** 3.\n**Sequence** Start: **Shield** 6.\nTags: Shield.',
    compact: '**Shield** 3.\n**Sequence** Start: **Shield** 6.',
  },
  clockwork_song_iron_bridge_t1: {
    full:
      '+1 **Potency**.\n**Sequence** 3: **Strike** 3, **Shield** 3.\n**Prime**: Delayed 1 → **Strike** 5, **Shield** 5.\nTags: Strike, Shield, Potency.',
    compact:
      '+1 **Potency**.\n**Sequence** 3: **Strike** 3, **Shield** 3.\n**Prime**: Delayed **Strike** 5 + **Shield** 5.',
  },
  clockwork_canticle_interleave_verse_t1: {
    full:
      '**Strike** 1.\n**Sequence** 2: **Strike** 3.\n**Prime**: Deal 3 **direct** damage.\nTags: Strike, Direct.',
    compact: '**Strike** 1.\n**Sequence** 2: **Strike** 3.\n**Prime**: Deal 3 **direct** damage.',
  },
  clockwork_song_iron_chorus_t1: {
    full:
      '**Strike** 1.\n**Sequence** 4: **Strike** 7, +2 **Potency**.\nTags: Strike, Potency.',
    compact: '**Strike** 1.\n**Sequence** 4: **Strike** 7, +2 **Potency**.',
  },
  clockwork_song_sanctuary_verse_t1: {
    full:
      '**Shield** 2.\n**Sequence** 2: cards on **Prime** slots gain +2 **Potency**.\nTags: Shield, Potency.',
    compact: '**Shield** 2.\n**Sequence** 2: **Prime**-slot cards gain +2 **Potency**.',
  },
  clockwork_canticle_interleave_chorus_t1: {
    full:
      '**Strike** 1.\n**Sequence** Start: **Strike** 2, +1 **Potency**.\n**Sequence** 2: **Strike** 3, +1 **Potency**.\n**Sequence** 3: **Strike** 4, +2 **Potency**.\nTags: Strike, Potency.',
    compact:
      '**Strike** 1.\n**Sequence** Start: **Strike** 2, +1 **Potency**.\n**Sequence** 2: **Strike** 3, +1 **Potency**.\n**Sequence** 3: **Strike** 4, +2 **Potency**.',
  },
  clockwork_song_iron_coda_t1: {
    full:
      '**Strike** 1.\n**Sequence** 5: **Strike** 8, +2 **Potency**.\nTags: Strike, Potency.',
    compact: '**Strike** 1.\n**Sequence** 5: **Strike** 8, +2 **Potency**.',
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
    const base = stripSelfHpPlayCostFromDescriptionText(raw, card);
    const bonus = cyberpunkNeutralTraitBonusLine(card, options?.activeTraitIds);
    return bonus ? `${base}\n${bonus}` : base;
  }
  const cyberpunkPinned = CYBERPUNK_CARD_TEXT[card.id];
  if (cyberpunkPinned) {
    const raw = omit ? cyberpunkPinned.compact : cyberpunkPinned.full;
    const base = stripSelfHpPlayCostFromDescriptionText(raw, card);
    const bonus = cyberpunkNeutralTraitBonusLine(card, options?.activeTraitIds);
    return bonus ? `${base}\n${bonus}` : base;
  }
  const clockworkPinned = CLOCKWORK_CARD_TEXT[card.id];
  if (clockworkPinned) {
    const raw = omit ? clockworkPinned.compact : clockworkPinned.full;
    const base = stripSelfHpPlayCostFromDescriptionText(raw, card);
    const bonus = cyberpunkNeutralTraitBonusLine(card, options?.activeTraitIds);
    return bonus ? `${base}\n${bonus}` : base;
  }

  /* Prime / Sequence / Faith riders: print actual bonuses, not generic keyword blurbs. */
  const effectDrivenClockwork = buildEffectDrivenClockworkLines(card);
  if (effectDrivenClockwork) {
    const body = effectDrivenClockwork.join('\n');
    const withTags =
      !omit && card.tags.length > 0 ? `${body}\nTags: ${card.tags.join(', ')}.` : body;
    const base = stripSelfHpPlayCostFromDescriptionText(withTags, card);
    const bonus = cyberpunkNeutralTraitBonusLine(card, options?.activeTraitIds);
    return bonus ? `${base}\n${bonus}` : base;
  }

  /* Data-driven effect pipelines (Scavenger glue, Graft packages, etc.). */
  const pipelineBody = buildEffectPipelineBodyLines(card);
  const usePipelineBody =
    pipelineBody.length > 0 &&
    (pipelineBody.some((l) => l.includes('**Persistent**')) ||
      pipelineBody.some(
        (l) =>
          l.includes('Scrap Engine') ||
          l.includes('Factory Reset') ||
          l.includes('Emergency Protocol'),
      ) ||
      pipelineBody.some((l) => l.includes('max HP') || l.includes('**Continuous**')) ||
      /^core_|^deep_core_|^sacrif_|^gutter_|^graft_|^hot_swap_|^hollow_|^chassis_|^scrap_|^dynamo_|^anemic_|^blood_|^heap_|^fr_hound_|^neutral_scrap_/.test(
        card.id,
      ));
  if (usePipelineBody) {
    const body = pipelineBody.join('\n');
    const withTags =
      !omit && card.tags.length > 0 ? `${body}\nTags: ${card.tags.join(', ')}.` : body;
    const base = stripSelfHpPlayCostFromDescriptionText(withTags, card);
    const bonus = cyberpunkNeutralTraitBonusLine(card, options?.activeTraitIds);
    return bonus ? `${base}\n${bonus}` : base;
  }

  const coreTapBranchText = /^core_tap_t[123]$/.test(card.id);
  const coreSacrificeText = /^deep_core_tap_t[123]$/.test(card.id);
  const coreRefactoringText = /^core_refactoring_t[123]$/.test(card.id);
  const coreRebirthText = /^core_rebirth_t[123]$/.test(card.id);
  const sacrifCustomText = /^sacrif_(plate|echo|rift)_t[123]$/.test(card.id);
  const sacrifPlateText = /^sacrif_plate_t[123]$/.test(card.id);
  const sacrifEchoText = /^sacrif_echo_t[123]$/.test(card.id);
  const sacrifRiftText = /^sacrif_rift_t[123]$/.test(card.id);

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

  if (sacrifPlateText) {
    const b = card.card_tier === 3 ? 6 : card.card_tier === 2 ? 5 : 4;
    const j = card.card_tier === 3 ? 2 : 1;
    const d = card.card_tier === 3 ? 3 : 2;
    parts.push('Lose 4 HP (minimum 1).');
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Gain ${String(b)} Shield.`);
    parts.push(`Deal ${String(d)} direct damage.`);
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
  if (sacrifRiftText) {
    const shield = card.card_tier === 3 ? 3 : 2;
    const d = card.card_tier === 3 ? 9 : card.card_tier === 2 ? 8 : 7;
    const j = card.card_tier === 3 ? 3 : 2;
    parts.push('Lose 4 HP.');
    parts.push(`Gain ${String(shield)} Shield.`);
    parts.push(`+${String(j)} Junk.`);
    parts.push(`Deal ${String(d)} direct damage.`);
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

  const gutterOfferingText = /^gutter_offering_t[123]$/.test(card.id);
  if (gutterOfferingText) {
    const shield = card.card_tier === 3 ? 3 : 2;
    const junk = card.card_tier === 3 ? 5 : card.card_tier === 2 ? 4 : 3;
    parts.push('Lose 3 HP (minimum 1).');
    parts.push(`Gain ${String(shield)} Shield.`);
    parts.push(`+${String(junk)} Junk.`);
  }

  const neutralFeintText = card.id === 'neutral_feint_t1';
  if (neutralFeintText) {
    parts.push('Strike 3 (potency applies)\nNext Strike: Pierce');
  }

  const overdriveSlamText = /^neutral_overdrive_slam_t[123]$/.test(card.id);
  if (overdriveSlamText) {
    const strike = firstStrikeBaseDamage(card) ?? card.base_damage ?? 0;
    parts.push(`Strike: ${String(strike)}`);
    parts.push('Self: Stunned 1');
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

  const needleDriverText = /^needle_driver_t[123]$/.test(card.id);
  if (needleDriverText) {
    const tier = card.card_tier;
    const base = tier === 3 ? 7 : tier === 2 ? 5 : 3;
    const bonus = tier === 3 ? 11 : tier === 2 ? 9 : 7;
    parts.push(`Strike ${String(base)} (potency applies).`);
    parts.push(`If you have at least 3 junk: spend 3 junk, then Strike ${String(bonus)} (no potency).`);
  }

  const delayedShellText = /^neutral_delayed_shell_t[123]$/.test(card.id);
  const delayedBurstText = /^neutral_delayed_burst_t[123]$/.test(card.id);
  const delayedSpec = delayedShellText || delayedBurstText ? firstDelayedStep(card) : undefined;
  if (delayedSpec) {
    if (delayedSpec.kind === 'shield') {
      parts.push(
        `Delayed ${String(delayedSpec.delayRounds)}: after ${String(delayedSpec.delayRounds)} combat round(s), gain Shield ${String(delayedSpec.amount)}.`,
      );
    } else {
      parts.push(
        `Delayed ${String(delayedSpec.delayRounds)}: after ${String(delayedSpec.delayRounds)} combat round(s), deal ${String(delayedSpec.amount)} non-Strike damage.`,
      );
    }
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
    !multiStrikeText &&
    !overdriveSlamText &&
    !needleDriverText &&
    !delayedShellText &&
    !delayedBurstText
  ) {
    if (card.tags.includes('Direct')) {
      parts.push(`Deal ${card.base_damage} **direct** damage.`);
    } else if (card.tags.includes('Strike')) {
      parts.push(`Deal ${card.base_damage} **Strike** damage.`);
    } else {
      parts.push(`Deal ${card.base_damage} damage.`);
    }
  }
  const shieldReinf = /^neutral_shield_reinforcement_t[123]$/.test(card.id);
  if (card.base_block && !sacrifCustomText && !shieldReinf) {
    parts.push(`Gain ${card.base_block} **Shield**.`);
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
      if (kw.type === 'Persistent' && (card.effects ?? []).some(isPersistentInstallStep)) {
        continue;
      }
      if (kw.type === 'Continuous' && card.continuous_min_junk !== undefined) {
        continue;
      }
      if (KEYWORDS_COVERED_BY_EFFECT_RIDERS.has(kw.type)) {
        /* Rider effects already printed above when present; otherwise keep a short marker. */
        if ((card.effects ?? []).some((e) => e.type === 'BranchIfOnPrimeSlot' || e.type === 'BranchIfClockworkSequence' || e.type === 'BranchIfFaithGte')) {
          continue;
        }
        parts.push(compactKeywordHeadline(kw));
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

  const base = stripSelfHpPlayCostFromDescriptionText(parts.join('\n'), card);
  const bonus = cyberpunkNeutralTraitBonusLine(card, options?.activeTraitIds);
  return bonus ? `${base}\n${bonus}` : base;
}
