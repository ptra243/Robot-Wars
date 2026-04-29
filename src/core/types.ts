/** Strike/Shield/Direct = combat role; Junk/Bulk/Potency/Energy = deck-builder filters (also match scalars/keywords in `libraryFilters`). */
export type CardTag =
  | 'Strike'
  | 'Shield'
  | 'Direct'
  | 'Virus'
  | 'Evade'
  | 'Shuriken'
  | 'Stance'
  | 'Junk'
  | 'Bulk'
  | 'Potency'
  | 'Energy'
  /** Synergy / filter chip for Expose archetype (not always the Expose keyword on the same card). */
  | 'Expose';

export type KeywordType =
  | 'Bulk'
  | 'Overclock'
  | 'Switch'
  | 'Expose'
  | 'Pierce'
  | 'Continuous'
  | 'TurboLink'
  | 'FactoryReset'
  | 'Virus'
  | 'Evade'
  | 'Shuriken'
  | 'Stance'
  /** Marks “core parts” economy cards (refined scrap, transforms); used for filters and Core Rebirth pool. */
  | 'CoreParts'
  /** Deckbuilding only: at most one copy of any UniqueDeck card across hand+deck (see deck rules). */
  | 'UniqueDeck'
  /** Marker for rest-of-battle hooks; deckbuilding: counts toward Continuous/Persistent cap. */
  | 'Persistent';

export interface KeywordSpec {
  type: KeywordType;
  value: number;
}

export type StanceType = 'dragon' | 'tiger' | 'bird' | 'tortoise';

/** Ordered card effects (JSON `effects` or compiled from legacy scalars). */
export type EffectStep =
  | { type: 'SpendJunk'; amount: number }
  | { type: 'SpendCore'; amount: number }
  | { type: 'GainJunk'; amount: number }
  | { type: 'GainCore'; amount: number }
  /** Spend all refined scrap; gain +1 bulk per scrap spent (respecting global bulk stack cap). */
  | { type: 'SpendAllCoreGainBulk' }
  | { type: 'GainCharge'; amount: number }
  | { type: 'AddStrikePotency'; amount: number }
  | { type: 'AddShieldPotency'; amount: number }
  | { type: 'HealSelf'; amount: number }
  /** Direct HP loss on the resolving fighter (bypasses block; not Strike damage). */
  | { type: 'SelfDamage'; amount: number }
  | {
      type: 'StrikeDamage';
      baseDamage: number;
      pierce: boolean;
      useStrikePotency?: boolean;
      /** When junk + refined scrap ≥ threshold, add bonus to base damage (evaluated at resolve time). */
      bonusDamageIfJunkPlusCoreSumGte?: { threshold: number; bonus: number };
      /** Added to base (after junk+core bonus, before potency) per strike this fighter already resolved this combat (not counting this step). */
      bonusPerPriorStrikeThisCombat?: number;
      /** Unused; expose bonus uses a per-resolution pool and clears at end of the attack (see runner). */
      consumeTargetExposeForBonus?: boolean;
      /**
       * When true, this strike still adds the target's Expose stacks to damage but does not count toward
       * clearing those stacks at the end of this card's resolution (Harassing Strike).
       */
      deferExposeClear?: boolean;
      /** Junk Rivet–style: for each tier where junk snapshot ≥ minJunk, add bonus to this strike. */
      bonusFlatDamageIfJunkSnapshotGte?: { minJunk: number; bonus: number }[];
    }
  | {
      type: 'ShieldBlock';
      baseBlock: number;
      bonusBlockIfJunkPlusCoreSumGte?: { threshold: number; bonus: number };
      /** +1 block per junk held (after spend steps), optional cap. */
      bonusBlockPerJunkHeld?: { cap?: number };
      /** +floor(junk / divisor) block (Salvage Mantle). */
      bonusBlockPerJunkEveryN?: { divisor: number };
    }
  | { type: 'OptionalSpendJunkForGainCharge'; spend: number; gainCharge: number }
  | {
      type: 'TransformCurrentQueueSlot';
      /** Use with static transforms (e.g. Core Tap branch). Omit when using `matchNeutralBasicTierToResolvingCard`. */
      newCardId?: string;
      /** Set this queue slot to `neutral_basic_strike_t{1–3}` matching the resolving card’s `card_tier` (factory reset; clears Continuous on that slot). */
      matchNeutralBasicTierToResolvingCard?: boolean;
    }
  /** Replaces the next N Neutral Basic Strike slots in queue order (N = resolving card `card_tier`, 1–3) with random scavenger **CoreParts** cards (same tier per slot). */
  | { type: 'ReplaceRandomNeutralBasicWithCorePartsCard' }
  | {
      type: 'BranchIfCoreGte';
      minCore: number;
      thenSteps: EffectStep[];
      elseSteps: EffectStep[];
    }
  /** Junk held at start of this card’s resolution (before any steps mutate junk). */
  | {
      type: 'BranchIfJunkGte';
      minJunk: number;
      thenSteps: EffectStep[];
      elseSteps: EffectStep[];
    }
  | { type: 'BranchIfChargeGte'; minCharge: number; thenSteps: EffectStep[]; elseSteps: EffectStep[] }
  /**
   * HP damage to the opponent that does not count as a Strike resolution (no Gathering tally).
   * Uses the same block/bulk mitigation path as strikes unless Pierce is true.
   */
  | {
      type: 'DirectHpDamage';
      baseDamage: number;
      pierce: boolean;
      /** When set, adds potency to damage (most threshold finishers omit this). */
      useStrikePotency?: boolean;
      /** Adds (junk at resolve start) × this to damage (e.g. Junk Crown >15 unlock line). */
      extraDamagePerJunkFromSnapshot?: number;
    }
  /** +floor(junk snapshot / divisor) charge. */
  | { type: 'GainChargeFromJunkSnapshotFloorDiv'; divisor: number }
  /** Junk gained = actor’s current charge after prior steps in this pipeline. */
  | { type: 'GainJunkEqualToCurrentCharge' }
  /** +floor(junk snapshot / divisor) potency. */
  | { type: 'AddPotencyFromJunkSnapshotFloorDiv'; divisor: number }
  /**
   * Spend extra charge only if available; if paid, runs then-steps. Used for Crown >15 / Coil >12 unlock lines.
   */
  | { type: 'ConditionalSpendCharge'; spend: number; thenSteps: EffectStep[] }
  /**
   * Junk Bulwark (high threshold): gain Shield (block) equal to your bulk stacks + potency — fuels a later Junk Aegis
   * shield→damage line via higher `actor.block`, not a separate damage modifier.
   */
  | { type: 'ShieldBlockEqualToActorBulkStacks' }
  /** Shield block = floor(junk snapshot / divisor) + potency (Junk Aegis line). */
  | { type: 'ShieldBlockFromJunkSnapshot'; divisor: number }
  /** Non-Strike damage to enemy = your Shield (block) after prior steps on this card. */
  | { type: 'DirectHpDamageFromActorBlock' }
  /** Expose value = max(1, floor(junk snapshot / divisor)); only meaningful when junk snapshot gate already passed. */
  | { type: 'ExposeFromJunkSnapshot'; divisor: number }
  | { type: 'Keyword'; spec: KeywordSpec }
  /** Next N StrikeDamage resolutions from this fighter use Pierce (Feint). Applied after current card’s strikes. */
  | { type: 'GrantNextStrikePierce'; count: number }
  /** +charge at each OnTurnStart for N rounds (Perpetual Motion). */
  | {
      type: 'GrantPerpetualRoundCharge';
      chargePerRound: number;
      totalRounds: number;
    }
  /** Change opponent’s charge (Induction Pit). Delta may be negative. */
  | { type: 'AdjustEnemyCharge'; delta: number }
  /** Lose HP but not below 1 (Gutter Offering). */
  | { type: 'SelfDamageRespectFloor1'; amount: number }
  /** Scavenger sacrifice line: +Emergency Protocol stacks (core factory cards; see Emergency Protocol EOT). */
  | { type: 'GainEmergencyProtocolStacks'; amount: number }
  /** Core bleed echo (aw1): when true, CoreParts self-damage also deals that loss to the enemy (DirectHpDamage). */
  | { type: 'SetMirrorCoreSelfDamage'; active: boolean }
  /** Apply a stackable outgoing-damage debuff to the opponent. */
  | { type: 'ApplyWeaken'; stacks: number }
  /** Add Stunned turns to the resolving fighter after this card resolves. */
  | { type: 'AddStunnedToSelf'; turns: number }
  /** Schedule a one-shot delayed effect pipeline after N combat rounds. */
  | { type: 'ScheduleEffectAfterRounds'; delayRounds: number; steps: EffectStep[] }
  /** Mitigate damage from the opponent’s next Strike against this fighter (Strip Mine). */
  | { type: 'GrantIncomingStrikeMitigation'; amount: number }
  /** Set current Shield (block) to twice its current value; does not add potency. */
  | { type: 'DoubleActorBlock' }
  /**
   * Rest-of-battle: this fighter's Shield retention at each round start uses this multiplier instead of the
   * global default (e.g. 0.75 = only 25% of shield decays per round).
   */
  | { type: 'SetShieldRoundRetainMultiplier'; retainMultiplier: number }
  | { type: 'SetStance'; stance: StanceType }
  | { type: 'BranchIfActorStance'; stance: StanceType; thenSteps: EffectStep[]; elseSteps: EffectStep[] }
  | { type: 'BranchIfActorActivatedStance'; stance: StanceType; thenSteps: EffectStep[]; elseSteps: EffectStep[] }
  | { type: 'GainShuriken'; amount: number }
  | { type: 'SpendAllShuriken' }
  | { type: 'DirectHpDamagePerShurikenSpent'; damagePerShuriken: number; pierce?: boolean }
  | { type: 'DirectHpDamagePerActivatedStance'; damagePerStance: number; pierce?: boolean }
  | { type: 'GainEvade'; amount: number }
  | { type: 'ApplyVirus'; stacks: number }
  | { type: 'SetNextTigerCardOverclock'; active: boolean }
  | { type: 'SetNextTigerCardPiercePotency'; pierce: boolean; potencyGain: number; potencyAfterCardLoss: number }
  | { type: 'SetNextTigerCardExposePerEnergy'; amountPerEnergy: number; cap: number }
  | { type: 'SetNextTigerCardExtraStrikeFromTargetVirus'; cap: number }
  | { type: 'SetNextShurikenUnloadImbueVirusPerHit'; stacksPerHit: number }
  | { type: 'ConsumeShieldForDirectDamage'; shieldPerDamage: number; maxShieldSpend?: number }
  | { type: 'GainVirulentRetribution'; amount: number }
  | { type: 'ConsumeAllShurikenGainShield'; shieldPerShuriken: number; gainVirulentRetributionIfAny?: number }
  | { type: 'ShieldBlockAfterRounds'; amount: number; delayRounds: number };

export interface CardDef {
  id: string;
  name: string;
  faction: string;
  neutral: boolean;
  awakening_min: number;
  card_tier: number;
  charge_cost: number;
  base_damage: number;
  base_block: number;
  gain_charge: number;
  gain_junk: number;
  gain_core: number;
  spend_junk: number;
  spend_core: number;
  strike_potency_gain: number;
  shield_potency_gain: number;
  /** Heal self on resolve (e.g. Urgent Repairs). Capped to starting HP in combat. */
  heal_self?: number;
  tags: CardTag[];
  keywords: KeywordSpec[];
  /** Required for catalog cards: ordered resolution pipeline. Legacy scalar fields remain for UI/filters. */
  effects?: EffectStep[];
  merge_to?: string;
  /** When refined scrap ≥ minCore at resolve time, use `chargeCost` instead of `charge_cost`. */
  charge_cost_if_core_gte?: { minCore: number; chargeCost: number };
  /** Junk Flare–style: +bonus strike damage when junk + refined scrap ≥ threshold. */
  bonus_strike_damage_if_junk_plus_core_gte?: { threshold: number; bonus: number };
  /** Slag Coat–style: +bonus block when junk + refined scrap ≥ threshold. */
  bonus_block_if_junk_plus_core_gte?: { threshold: number; bonus: number };
  /** After base `gain_charge`, may spend junk for extra charge (Junk Surge). */
  optional_spend_junk_for_charge?: { spend: number; gainCharge: number };
  /** Heap Shield–style: +1 block per junk held before shield body, optional cap. */
  bonus_block_per_junk_held?: { cap?: number };
  /** Salvage Mantle–style: +floor(junk / divisor) block (no spend). */
  bonus_block_per_junk_every_n?: { divisor: number };
}

export interface CardCatalog {
  cards: CardDef[];
}

export type AuraTrigger =
  | 'OnTurnStart'
  | 'OnDamageTaken'
  | 'OnChargeGained'
  | 'OnShieldGained'
  | 'OnHealthGained';

export type FighterAura =
  | {
      type: 'Continuous';
      trigger: 'OnTurnStart';
      sourceQueueIndex: number;
      interval: number;
      nextTickRound: number;
      /** Expose Drone Uplink: each tick adds this much Expose to the opponent. */
      enemyExposePerTick?: number;
    }
  | {
      type: 'Expose';
      /** Marker aura; `fighter.exposeDamage` adds to each StrikeDamage in one resolution, then clears at end (unless refreshed by an Expose keyword after a strike). */
      trigger: 'OnDamageTaken';
      damage: number;
    }
  | {
      type: 'PerpetualCharge';
      trigger: 'OnTurnStart';
      sourceQueueIndex: number;
      roundsLeft: number;
      chargePerRound: number;
    }
  | {
      /** Skip your next activation(s): +1 energy, no card play, same queue slot (like a stall). */
      type: 'Stunned';
      turnsLeft: number;
    };

export interface FighterState {
  name: string;
  hp: number;
  block: number;
  charge: number;
  junk: number;
  /** Max junk held; gains beyond cap spill to opponent Expose (Rust Ranger). Default = uncapped. */
  junkCapacity: number;
  /** Battle program cycles completed (full wrap of active queue slots). */
  programCycleCount: number;
  /** Rust Ranger Aw1: +2 max junk deferred to the start of the next activation (after a full wrap). */
  pendingRustRangerCircuit: boolean;
  bulkStacks: number;
  coreScrap: number;
  /** Buffs strike damage and shield block; only changes when effects say so (not consumed on use). */
  potency: number;
  exposeDamage: number;
  /** Outgoing-damage penalty: each stack reduces each damage packet by 1. */
  weakenStacks: number;
  deckCursor: number;
  deckWraps: number;
  queueCursor: number;
  /** Number of queue slots actively cycled in combat (3..queue.length). */
  activeQueueSlots: number;
  stallCountAtCursor: number;
  deck: string[];
  queue: Array<string | null>;
  /** Aura registry (trigger-driven passives plus marker states like Expose). */
  auras: FighterAura[];
  /** Legacy fields kept for compatibility while aura migration lands. */
  continuousTicksByQueueIndex: Record<number, number>;
  continuousNextTickRoundByQueueIndex: Record<number, number>;
  /** Feint: next N own Strike resolutions force Pierce on the strike packet. */
  nextStrikePierceCharges?: number;
  /** Strip Mine: mitigates this much damage from the opponent’s next Strike (player/enemy). */
  mitigateNextIncomingStrike?: number;
  /** StrikeDamage steps resolved this combat (each step increments; used for Gathering Strike and similar). */
  strikeResolutionsThisCombat: number;
  /** When set, the global default shield retention at round start is ignored for this fighter. */
  shieldRoundRetainMultiplier?: number;
  /** Active pilot trait IDs for this fighter (e.g. 'glint_base', 'glint_aw0'). */
  traitIds: string[];
  /**
   * Scrap Ping (Aw0): records the queue slot and original card ID that was temporarily upgraded
   * at combat start. Cleared in syncRunFromCombatResult so it never persists to RunState.
   */
  tempUpgrade: { slotIndex: number; originalId: string } | null;
  /**
   * Emergency Protocol (B): stacks gained only from core-line factory cards in data.
   * End of player turn: take self-damage equal to stacks (minimum 1). If that drops you to 0 HP,
   * one stack is spent to survive at 1 HP (+1 strike potency), unless prevented this turn.
   */
  emergencyProtocolStacks: number;
  /**
   * Core bleed echo: after Corebleed Oath–style card resolves, CoreParts self-damage
   * also deals matching DirectHpDamage to the enemy.
   */
  mirrorCoreSelfDamage: boolean;
  /** Overclock: at most one bonus resolution per your turn (separate from per-card overclockConsumed). */
  overclockBonusUsedThisTurn: boolean;
  /** One-shot delayed pipelines keyed to combat round when they should fire. */
  scheduledEffects: Array<{ fireAtRound: number; steps: EffectStep[] }>;
  /** Relic state: last observed deck wraps for once-per-cycle triggers. */
  lastDeckWrapsSeenForRelics?: number;
  /** Prime Directive temporary mode for this activation. */
  primeDirectiveActiveThisTurn?: boolean;
  /** Prime Directive: do not consume Emergency Protocol stacks this turn. */
  preventEmergencyProtocolSpendThisTurn?: boolean;
  /** Cyberpunk ninja stance system (null = no active stance). */
  stance?: StanceType | null;
  shuriken?: number;
  evadeStacks?: number;
  virusStacks?: number;
  virulentRetributionStacks?: number;
  nextTigerCardOverclock?: boolean;
  nextTigerCardPierce?: boolean;
  nextTigerCardPotencyGain?: number;
  nextTigerCardPotencyAfterCardLoss?: number;
  nextTigerCardExposePerEnergy?: { amountPerEnergy: number; cap: number } | null;
  nextTigerCardExtraStrikeFromTargetVirusCap?: number | null;
  nextShurikenUnloadImbueVirusPerHit?: number;
  activatedDragonThisCombat?: boolean;
  activatedTigerThisCombat?: boolean;
  activatedBirdThisCombat?: boolean;
  activatedTortoiseThisCombat?: boolean;
  lastResolvedCardFaction?: string | null;
}

export interface CombatState {
  player: FighterState;
  enemy: FighterState;
  roundIndex: number;
  globalResolutions: number;
  fatigueArmed: boolean;
  fatigueRoundsElapsed: number;
}

export interface CombatFighterSnapshot {
  hp: number;
  block: number;
  charge: number;
  shuriken?: number;
  junk: number;
  bulkStacks: number;
  coreScrap: number;
  potency: number;
  exposeDamage: number;
  virusStacks?: number;
  weakenStacks?: number;
  /** Times the fatigue deck has wrapped (player only; used for deck-cycle stats). */
  deckWraps?: number;
  /** Stunned aura: skips activations until cleared. */
  stunnedTurnsLeft?: number;
}

export interface CombatEventSnapshot {
  roundIndex: number;
  player: CombatFighterSnapshot;
  enemy: CombatFighterSnapshot;
  /** Queue slot index (0–8) for active card; needed for replay UI highlight. */
  playerQueueCursor: number;
  enemyQueueCursor: number;
  /** Planned queue card ids per slot (length = queue size); required for correct replay scrub after in-combat queue transforms (e.g. Factory Reset). */
  playerQueue?: Array<string | null>;
  enemyQueue?: Array<string | null>;
  /** Inert slots `index >= active*Slots` are null — not Neutral Basic. Same as {@link FighterState.activeQueueSlots}. */
  playerActiveQueueSlots?: number;
  enemyActiveQueueSlots?: number;
  /** Thermal fatigue (global); rounds elapsed increments each fatigue tick while armed. */
  fatigueArmed?: boolean;
  fatigueRoundsElapsed?: number;
}

export interface CombatEvent {
  type: string;
  text: string;
  round: number;
  actor?: string;
  snapshot?: CombatEventSnapshot;
}

export interface CombatResult {
  playerWon: boolean;
  rounds: number;
  playerDeckCycles: number;
  enemyDeckCycles: number;
  endedByFatigue: boolean;
  events: CombatEvent[];
  enemyDeckUsed: string[];
  finalState: CombatState;
  initialSnapshot: CombatEventSnapshot;
}

export interface CombatSetup {
  seed: number;
  player: FighterState;
  enemy: FighterState;
}

export interface SpiritState {
  id: string;
  awakening: number;
  spiritXp: number;
}

/** Snapshot of deck-builder state for save/load and shareable deck codes. */
export interface SavedDeckPayload {
  deck: string[];
  hand: string[];
  plannedQueue: Array<string | null>;
  enemyPlannedQueue: Array<string | null>;
  sandboxActiveQueueSlots: number;
  sandboxPlayerCoreScrap: number;
  sandboxEnemyCoreScrap: number;
}

export type TravelNodeType = 'battle' | 'elite' | 'boss' | 'shop' | 'event';

export interface TravelOffer {
  id: string;
  type: TravelNodeType;
}

/**
 * Structured result of a travel "event" node — used to drive confirmation modals
 * (upgrade arrows, gold deltas, draft picks, etc.).
 */
export type TravelEventOutcome =
  | { kind: 'upgrade'; beforeId: string; afterId: string }
  | { kind: 'gold_gain'; amount: number; totalGold: number }
  | { kind: 'gold_loss'; amount: number; totalGold: number }
  | { kind: 'paid_card'; goldSpent: number; cardId: string }
  | { kind: 'heart_restore'; amount: number; hearts: number }
  | { kind: 'hearts_full_gold'; goldGained: number; totalGold: number }
  | /** Player picks one card in UI; deck updates when they confirm. */
    { kind: 'draft_pick'; offers: string[] }
  | { kind: 'lost_hand_card'; cardId: string }
  | { kind: 'relic_gain'; relicId: string }
  | { kind: 'heart_loss'; heartsRemaining: number }
  | { kind: 'noop'; reason: string };

/** Travel map modal (shop / event summary / event draft). */
export type TravelModalState =
  | { kind: 'shop'; offers: string[]; nonCardPurchases: number }
  | { kind: 'event'; message: string; outcome: TravelEventOutcome }
  | { kind: 'draft'; offers: string[] };

export interface RunLoopState {
  act: number;
  stepsInAct: number;
  totalStepsResolved: number;
  awakening: number;
  /** Persisted combat HP between encounters (not hearts). */
  playerHp: number;
  /** Maximum HP cap for the run (combat baseline; can rise with future meta upgrades). */
  playerHpMax: number;
  /**
   * Max HP from non-relic progression only (enemy starting HP mirrors this before relic-only bumps).
   */
  playerHpBaseMax: number;
  hearts: number;
  gold: number;
  rerolls: number;
  reshufflesRemaining: number;
  travelDrawPile: TravelNodeType[];
  travelDiscard: TravelNodeType[];
  travelOffers: Array<TravelOffer | null>;
  pendingEncounterType: Extract<TravelNodeType, 'battle' | 'elite' | 'boss'> | null;
  enemyHpMultiplier: number;
  freeCardRerollsThisFight: number;
  relicIds: string[];
  playerTraitIds: string[];
  retryAvailable: boolean;
  /** Battle / replay UI speed (1× / 2× / 4×); persisted for this run. */
  battleReplaySpeed: 1 | 2 | 4;
  /**
   * First N **battle** (non-elite) encounters use all-basic enemy programs; decremented in {@link rollEnemyLoadout}.
   */
  earlyBattleBasicsRemaining: number;
  /**
   * Endless act 4 ramp index (0 in acts 1–3). Increment when entering act 4+ combats.
   */
  act4BattleIndex: number;
  /**
   * After the act 3 boss, travel is replaced with endless battles (no shop/event/elite pulls).
   */
  infiniteMode: boolean;
}

export interface RunState {
  seed: number;
  remainingLosses: number;
  encounterIndex: number;
  faction: string;
  spirit: SpiritState;
  deck: string[];
  hand: string[];
  plannedQueue: Array<string | null>;
  enemyPlannedQueue: Array<string | null>;
  /** Deck sandbox: active queue slots used in battle simulation (min 5, max 9). */
  sandboxActiveQueueSlots: number;
  /** Deck sandbox: starting refined scrap (`coreScrap`) for the player when combat begins (preview + encounters). */
  sandboxPlayerCoreScrap: number;
  /** Deck sandbox: starting refined scrap (`coreScrap`) for the enemy when combat begins. */
  sandboxEnemyCoreScrap: number;
  loop: RunLoopState;
  /**
   * Fatigue deck for the **next** `playEncounter` when generated by `rollEnemyLoadout`.
   * Cleared after `createCombatSetup` reads it.
   */
  combatEnemyFatigueDeck?: string[] | null;
  /**
   * Opponent in-combat relic for this encounter only; mapped to enemy traits in `createCombatSetup`.
   */
  combatOpponentRelicId?: string | null;
}

export interface ArenaSnapshot {
  roundIndex: number;
  player: FighterState;
  enemy: FighterState;
  recentEvents: CombatEvent[];
  result?: CombatResult;
  fatigueArmed?: boolean;
  fatigueRoundsElapsed?: number;
}
