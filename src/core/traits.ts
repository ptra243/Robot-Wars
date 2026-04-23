/**
 * Trait registry — single source of truth for every pilot and neutral trait.
 *
 * Adding a new trait:
 *   1. Add an entry to TRAIT_REGISTRY with the desired hooks.
 *   2. Reference its ID from a PilotDef (or grant it via a relic / run event).
 *   3. That's it — the combat engine picks it up automatically.
 *
 * Available hooks:
 *   onCombatStart  — runs once per combat, before the first round (e.g. temp upgrades).
 *   onStall        — runs when the fighter can't pay charge cost (after base +1 charge).
 *   onCardResolved — runs after a card fully resolves (after effects, auras, resolve event).
 *
 * Future hooks to add here as needed:
 *   onRoundStart, onRoundEnd, onTakeDamage, onDealDamage, onCardDrawn, …
 */

import { syncExposeAuraFromField } from './combat/state';
import { COMBAT_RULES } from './rules';
import type { CardContentService } from './content';
import type { CardDef, CombatEvent, CombatState, FighterState } from './types';

/* ── Context objects ──────────────────────────────────────────────────────── */

/**
 * Passed to in-combat hooks (onStall, onCardResolved).
 * Contains everything needed to read state and push events.
 */
export interface TraitHookCtx {
  state: CombatState;
  content: CardContentService;
  /** Convenience wrapper — pushes an event into the current event stream. */
  push: (event: CombatEvent) => void;
}

export interface TraitCardResolutionSummary {
  dealt: number;
  blocked: number;
  selfDamage: number;
  transformedCurrentSlot: boolean;
  chargeGained: number;
  junkGained: number;
  junkSpent: number;
  cardHadDelayScheduling: boolean;
}

/* ── TraitDef ─────────────────────────────────────────────────────────────── */

export interface TraitDef {
  id: string;
  /** Short name shown in UI (e.g. "Silver Lining"). */
  label: string;
  /** Full rule text shown in tooltips / pilot select screen. */
  text: string;
  hooks: {
    /**
     * Called at combat start for each active trait on the fighter, before
     * the first round. Only `content` is available (no event stream yet).
     * Use for one-time setup like temporary queue upgrades.
     */
    onCombatStart?: (fighter: FighterState, content: CardContentService) => void;

    /**
     * Called when the fighter cannot pay the charge cost and stalls.
     * The base +1 charge and stallCountAtCursor increment have already happened.
     * The stall CombatEvent has NOT been pushed yet — push extras here.
     */
    onStall?: (actor: FighterState, card: CardDef, ctx: TraitHookCtx) => void;

    /**
     * Called after a card fully resolves (effects applied, expose synced,
     * resolve event pushed). Use for bonus damage or post-resolution triggers.
     */
    onCardResolved?: (
      actor: FighterState,
      target: FighterState,
      card: CardDef,
      /** 0-indexed position in the queue. */
      queueIndex: number,
      ctx: TraitHookCtx,
      resolution: TraitCardResolutionSummary,
    ) => void;
    /** Called at the start of this fighter's activation, after turn-start auras. */
    onTurnStart?: (actor: FighterState, opponent: FighterState, ctx: TraitHookCtx) => void;
  };
}

/* ── Registry ─────────────────────────────────────────────────────────────── */

/**
 * Every trait in the game lives here.
 * Key = trait ID (e.g. 'glint_base', 'glint_aw0').
 */
export const TRAIT_REGISTRY: Record<string, TraitDef> = {
  /* ────────────────────────────────────────────────────────────────────────
   * GLINT
   * ──────────────────────────────────────────────────────────────────────── */

  glint_base: {
    id: 'glint_base',
    label: 'Silver Lining',
    text: 'When you stall, gain an extra +1 charge and +2 junk on top of the stall bonus.',
    hooks: {
      onStall(actor, card, ctx) {
        actor.charge += 1;
        actor.junk += 2;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Silver Lining: ${actor.name} stalls on ${card.name} — +2 charge total, +2 junk.`,
        });
      },
    },
  },

  glint_aw0: {
    id: 'glint_aw0',
    label: 'Wish Upon a Star',
    text: 'At the start of battle, the first non-tier-3 card in your queue is upgraded by 1 tier for the duration. Playing a tier-2 card deals 1 direct damage; tier-3 deals 3.',
    hooks: {
      onCombatStart(fighter, content) {
        // Temporarily upgrade the first eligible queue card.
        // tempUpgrade is read by syncRunFromCombatResult to revert after combat.
        for (let i = 0; i < fighter.queue.length; i += 1) {
          const id = fighter.queue[i];
          if (!id || id === COMBAT_RULES.blankQueueSlotCardId) continue;

          let card: CardDef;
          try {
            card = content.get(id);
          } catch {
            continue;
          }
          if (card.card_tier >= 3) continue;

          const base = id.replace(/_t[123]$/, '');
          const upgradedId = `${base}_t${card.card_tier + 1}`;
          try {
            content.get(upgradedId); // verify the upgraded card exists
            fighter.queue[i] = upgradedId;
            fighter.tempUpgrade = { slotIndex: i, originalId: id };
          } catch {
            continue; // no upgraded variant — try next eligible slot
          }
          return; // only upgrade the first eligible slot
        }
      },

      onCardResolved(actor, target, card, _queueIndex, ctx) {
        if (card.card_tier < 2) return;
        const ping = card.card_tier === 3 ? 3 : 1;
        target.hp = Math.max(0, target.hp - ping);
        ctx.push({
          type: 'scrap_ping',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Wish Upon a Star: ${actor.name} deals ${ping} direct damage (tier ${card.card_tier} card).`,
        });
      },
    },
  },

  glint_aw1: {
    id: 'glint_aw1',
    label: 'My Lucky Numbers',
    text: "Glint's lucky numbers are 2, 4, and 7. Those queue slots gain an extra effect after resolution — slot 2: +2 junk, slot 4: +4 shield, slot 7: strike 5 (respects block; adds and then spends enemy Expose).",
    hooks: {
      onCardResolved(actor, target, _card, queueIndex, ctx) {
        const slot = queueIndex + 1; // convert to 1-indexed
        let text = '';

        if (slot === 2) {
          actor.junk += 2;
          text = `My Lucky Numbers [slot 2]: +2 junk.`;
        } else if (slot === 4) {
          actor.block += 4;
          text = `My Lucky Numbers [slot 4]: +4 shield.`;
        } else if (slot === 7) {
          const exposePool = target.exposeDamage;
          const rawDmg = 5 + exposePool;
          const blockAbs = Math.min(target.block, rawDmg);
          target.block -= blockAbs;
          const hpDmg = rawDmg - blockAbs;
          if (hpDmg > 0) target.hp = Math.max(0, target.hp - hpDmg);
          if (exposePool > 0) {
            ctx.push({
              type: 'expose_finisher',
              round: ctx.state.roundIndex,
              actor: actor.name,
              text: `${actor.name} applies Expose (+${String(exposePool)}) to Lucky Numbers strike.`,
            });
            target.exposeDamage = 0;
            syncExposeAuraFromField(target);
            ctx.push({
              type: 'expose_cleared',
              round: ctx.state.roundIndex,
              actor: actor.name,
              text: `${actor.name} spends the target's Expose stacks after Lucky Numbers.`,
            });
          }
          text =
            exposePool > 0
              ? `My Lucky Numbers [slot 7]: strike 5 + ${String(exposePool)} Expose (${hpDmg} HP dmg, ${blockAbs} blocked).`
              : `My Lucky Numbers [slot 7]: strike 5 (${hpDmg} HP dmg, ${blockAbs} blocked).`;
        } else {
          return; // not a lucky slot
        }

        ctx.push({
          type: 'lucky_numbers',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `${actor.name} ${text}`,
        });
      },
    },
  },

  /* ────────────────────────────────────────────────────────────────────────
   * BARON VON BOAR
   * ──────────────────────────────────────────────────────────────────────── */

  baron_base: {
    id: 'baron_base',
    label: 'Rich Get Richer',
    text: 'When you would draft a card, you see one additional option to choose from. After every won encounter, gain 50 Gold.',
    hooks: {
      // Draft choice expansion is a run-layer effect wired in the draft pipeline.
      // Post-encounter gold is applied in applyPostCombatRewards (runLoop.ts).
    },
  },

  baron_aw0: {
    id: 'baron_aw0',
    label: 'Rich Get Even Richer',
    text: 'Every time you play a card with the CoreParts keyword, gain 1 Refined Scrap. After every won encounter, gain an additional 50 Gold.',
    hooks: {
      onCardResolved(actor, _target, card, _queueIndex, ctx) {
        if (!(card.tags as readonly string[]).includes('CoreParts')) return;
        // Refined scrap is a run-layer resource; grant it when the system lands.
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Rich Get Even Richer: ${actor.name} played a CoreParts card — +1 Refined Scrap (pending resource system).`,
        });
      },
    },
  },

  baron_aw1: {
    id: 'baron_aw1',
    label: 'The Whole Hog',
    text: 'At the start of each combat, gain 1 Potency for every 50 Gold you currently hold.',
    hooks: {
      // Potency grant is applied in createCombatSetup (lifecycle.ts) using run.loop.gold.
    },
  },

  /* ────────────────────────────────────────────────────────────────────────
   * RUST RANGER
   * ──────────────────────────────────────────────────────────────────────── */

  rust_ranger_base: {
    id: 'rust_ranger_base',
    label: 'Me and My Revolver',
    text: 'You can hold at most 5 junk. Gain 1 junk each turn. Junk gained while at maximum gives the enemy 1 Expose stack.',
    hooks: {},
  },

  rust_ranger_aw0: {
    id: 'rust_ranger_aw0',
    label: 'Fastest Gun in the West',
    text: 'When using the basic strike skill, you may spend all junk to add +1 strike per junk spent. You stall next turn.',
    hooks: {},
  },

  rust_ranger_aw1: {
    id: 'rust_ranger_aw1',
    label: 'Riding the Circuit',
    text: 'Each time your deck cycles back to slot 1, your maximum junk capacity increases by 2.',
    hooks: {},
  },

  /* ────────────────────────────────────────────────────────────────────────
   * NEUTRAL TRAITS
   * Add new neutral (non-pilot) traits below. Grant them by pushing the ID
   * into run.loop.playerTraitIds (e.g. from a relic or travel event).
   * ──────────────────────────────────────────────────────────────────────── */

  // Example skeleton — uncomment and fill in when ready:
  //
  // scavenger_instinct: {
  //   id: 'scavenger_instinct',
  //   label: 'Scavenger Instinct',
  //   text: 'Gain +1 junk at the start of each round.',
  //   hooks: {
  //     onRoundStart(actor, ctx) { actor.junk += 1; },
  //   },
  // },

  relic_reactive_plating: {
    id: 'relic_reactive_plating',
    label: 'Reactive Plating',
    text: 'At the start of your turn, if you have no shield, gain 2 shield.',
    hooks: {
      onTurnStart(actor, _opponent, ctx) {
        if (actor.block > 0) return;
        actor.block += 2;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Reactive Plating: ${actor.name} gains 2 shield.`,
        });
      },
    },
  },

  relic_repair_nanites: {
    id: 'relic_repair_nanites',
    label: 'Repair Nanites',
    text: 'At the start of your turn, recover 1 HP.',
    hooks: {
      onTurnStart(actor, _opponent, ctx) {
        const before = actor.hp;
        actor.hp = Math.min(COMBAT_RULES.startingHp, actor.hp + 1);
        if (actor.hp === before) return;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Repair Nanites: ${actor.name} recovers 1 HP.`,
        });
      },
    },
  },

  relic_scrap_condenser: {
    id: 'relic_scrap_condenser',
    label: 'Scrap Condenser',
    text: 'When you play a neutral non-basic strike card, gain 2 junk.',
    hooks: {
      onCardResolved(actor, _target, card, _queueIndex, ctx) {
        if (!card.neutral) return;
        if (/^neutral_basic_strike_t[123]$/.test(card.id)) return;
        actor.junk += 2;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Scrap Condenser: ${actor.name} gains 2 junk.`,
        });
      },
    },
  },

  relic_berserker_instincts: {
    id: 'relic_berserker_instincts',
    label: 'Berserker Instincts',
    text: 'When paying HP for a card, deal that much direct damage to the enemy.',
    hooks: {
      onCardResolved(actor, target, _card, _queueIndex, ctx, resolution) {
        if (resolution.selfDamage <= 0) return;
        const damage = resolution.selfDamage;
        const absorbed = Math.min(target.block, damage);
        target.block -= absorbed;
        const hpLoss = damage - absorbed;
        if (hpLoss > 0) {
          target.hp = Math.max(0, target.hp - hpLoss);
        }
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Berserker Instincts: ${actor.name} reflects ${String(damage)} damage.`,
        });
      },
    },
  },

  relic_hot_swap_injector: {
    id: 'relic_hot_swap_injector',
    label: 'Hot-Swap Injector',
    text: 'Whenever you transform a card, Strike 2.',
    hooks: {
      onCardResolved(actor, target, _card, _queueIndex, ctx, resolution) {
        if (!resolution.transformedCurrentSlot) return;
        const damage = 2;
        const absorbed = Math.min(target.block, damage);
        target.block -= absorbed;
        const hpLoss = damage - absorbed;
        if (hpLoss > 0) {
          target.hp = Math.max(0, target.hp - hpLoss);
        }
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Hot-Swap Injector: ${actor.name} triggers Strike 2.`,
        });
      },
    },
  },

  relic_trash_dynamo: {
    id: 'relic_trash_dynamo',
    label: 'Trash Dynamo',
    text: 'If you gained energy this card, gain 2 junk.',
    hooks: {
      onCardResolved(actor, _target, _card, _queueIndex, ctx, resolution) {
        if (resolution.chargeGained <= 0) return;
        actor.junk += 2;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Trash Dynamo: ${actor.name} gains 2 junk.`,
        });
      },
    },
  },

  relic_scrap_recycling: {
    id: 'relic_scrap_recycling',
    label: 'Scrap Recycling',
    text: 'When you gain junk, recover that much HP (max 5 per card).',
    hooks: {
      onCardResolved(actor, _target, _card, _queueIndex, ctx, resolution) {
        if (resolution.junkGained <= 0) return;
        const heal = Math.min(5, resolution.junkGained);
        const before = actor.hp;
        actor.hp = Math.min(COMBAT_RULES.startingHp, actor.hp + heal);
        const gained = actor.hp - before;
        if (gained <= 0) return;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Scrap Recycling: ${actor.name} recovers ${String(gained)} HP.`,
        });
      },
    },
  },

  relic_junk_shrapnel: {
    id: 'relic_junk_shrapnel',
    label: 'Junk Shrapnel',
    text: 'When you spend junk, deal that much damage.',
    hooks: {
      onCardResolved(actor, target, _card, _queueIndex, ctx, resolution) {
        if (resolution.junkSpent <= 0) return;
        const damage = resolution.junkSpent;
        const absorbed = Math.min(target.block, damage);
        target.block -= absorbed;
        const hpLoss = damage - absorbed;
        if (hpLoss > 0) {
          target.hp = Math.max(0, target.hp - hpLoss);
        }
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Junk Shrapnel: ${actor.name} deals ${String(damage)} damage.`,
        });
      },
    },
  },

  relic_stall_shield_weaken: {
    id: 'relic_stall_shield_weaken',
    label: 'Shock Buffer',
    text: 'When you stall, gain 2 shield and apply 2 Weaken.',
    hooks: {
      onStall(actor, card, ctx) {
        actor.block += 2;
        const target = actor === ctx.state.player ? ctx.state.enemy : ctx.state.player;
        target.weakenStacks += 2;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Shock Buffer: ${actor.name} stalls on ${card.name}, gains 2 shield and applies 2 Weaken.`,
        });
      },
    },
  },

  relic_delay_double_cast: {
    id: 'relic_delay_double_cast',
    label: 'Chrono Fork',
    text: 'When you cast a card with Delay, its delayed effect is also triggered immediately.',
    hooks: {
      onCardResolved(actor, _target, _card, _queueIndex, ctx, resolution) {
        if (!resolution.cardHadDelayScheduling) return;
        actor.charge += 1;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Chrono Fork: ${actor.name} gains +1 energy from immediate delay trigger.`,
        });
      },
    },
  },

  relic_prime_directive: {
    id: 'relic_prime_directive',
    label: 'Prime Directive',
    text: 'When your deck cycles, gain potency from HP+junk and enter Emergency Protocol mode this turn.',
    hooks: {
      onTurnStart(actor, _opponent, ctx) {
        const last = actor.lastDeckWrapsSeenForRelics ?? 0;
        if (actor.deckWraps <= last) return;
        actor.lastDeckWrapsSeenForRelics = actor.deckWraps;
        const gain = Math.floor((actor.hp + actor.junk) / 5);
        if (gain > 0) {
          actor.potency += gain;
        }
        actor.primeDirectiveActiveThisTurn = true;
        actor.preventEmergencyProtocolSpendThisTurn = true;
        ctx.push({
          type: 'trait_effect',
          round: ctx.state.roundIndex,
          actor: actor.name,
          text: `Prime Directive: ${actor.name} gains ${String(gain)} potency and enters Emergency Protocol mode.`,
        });
      },
    },
  },

  relic_overclock_mandate: {
    id: 'relic_overclock_mandate',
    label: 'Overclock Mandate',
    text: 'Cards with junk thresholds also gain >40 junk: Overclock.',
    hooks: {},
  },

  relic_basic_instincts: {
    id: 'relic_basic_instincts',
    label: 'Basic Instincts',
    text: 'If your deck is all neutral, basic strikes gain Overclock.',
    hooks: {},
  },

  relic_emergency_junk_shield: {
    id: 'relic_emergency_junk_shield',
    label: 'Emergency Junk Shield',
    text: 'Incoming damage hits junk first. Non-strike damage is doubled against junk.',
    hooks: {},
  },
};

/* ── Dispatch helpers ─────────────────────────────────────────────────────── */
// Call these from the combat engine. Each function iterates the fighter's
// active trait IDs and invokes the matching hook if it exists.

/** Run onCombatStart for all active traits on `fighter`. */
export function callTraitOnCombatStart(
  fighter: FighterState,
  content: CardContentService,
): void {
  for (const id of fighter.traitIds) {
    TRAIT_REGISTRY[id]?.hooks.onCombatStart?.(fighter, content);
  }
}

/** Run onStall for all active traits on `actor`. */
export function callTraitOnStall(
  actor: FighterState,
  card: CardDef,
  ctx: TraitHookCtx,
): void {
  for (const id of actor.traitIds) {
    TRAIT_REGISTRY[id]?.hooks.onStall?.(actor, card, ctx);
  }
}

/** Run onCardResolved for all active traits on `actor`. */
export function callTraitOnCardResolved(
  actor: FighterState,
  target: FighterState,
  card: CardDef,
  queueIndex: number,
  ctx: TraitHookCtx,
  resolution: TraitCardResolutionSummary,
): void {
  for (const id of actor.traitIds) {
    TRAIT_REGISTRY[id]?.hooks.onCardResolved?.(actor, target, card, queueIndex, ctx, resolution);
  }
}

export function callTraitOnTurnStart(
  actor: FighterState,
  opponent: FighterState,
  ctx: TraitHookCtx,
): void {
  for (const id of actor.traitIds) {
    TRAIT_REGISTRY[id]?.hooks.onTurnStart?.(actor, opponent, ctx);
  }
}
