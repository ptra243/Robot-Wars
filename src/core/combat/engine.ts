import { CardContentService } from '../content';
import { COMBAT_RULES } from '../rules';
import type { CombatEvent, CombatResult, CombatSetup, CombatState } from '../types';
import {
  applyFatigueIfArmed,
  applyShieldDecayAtRoundStart,
  beginFighterTurn,
  armFatigueIfNeeded,
} from './flow';
import { resolveFighter } from './resolver';
import { buildSnapshot, cloneFighter, ensureAuraDefaults, ensureQueue, pushEv } from './state';

export interface CombatRunOptions {
  /** Optional early-stop condition for deck-cycle sandbox simulation. */
  stopWhenPlayerDeckWrapsAtLeast?: number;
  /** Stop after this many combat rounds complete (each round = player + enemy). Deck-cycle UI uses 3. */
  stopAfterRounds?: number;
}

export class CombatSimulator {
  private readonly content: CardContentService;
  private readonly seed: number;

  constructor(content: CardContentService, seed: number) {
    this.content = content;
    this.seed = seed;
  }

  run(setup: CombatSetup, options: CombatRunOptions = {}): CombatResult {
    const combatSeed = setup.seed;
    void this.seed;

    const events: CombatEvent[] = [];
    const state: CombatState = {
      player: cloneFighter(setup.player),
      enemy: cloneFighter(setup.enemy),
      roundIndex: 0,
      globalResolutions: 0,
      fatigueArmed: false,
      fatigueRoundsElapsed: 0,
    };

    ensureQueue(state.player);
    ensureQueue(state.enemy);
    ensureAuraDefaults(state.player);
    ensureAuraDefaults(state.enemy);

    const initialSnapshot = buildSnapshot(state);

    while (
      state.roundIndex < COMBAT_RULES.maxRounds &&
      state.player.hp > 0 &&
      state.enemy.hp > 0
    ) {
      state.roundIndex += 1;
      applyShieldDecayAtRoundStart(state.player);
      applyShieldDecayAtRoundStart(state.enemy);
      state.player.junk += COMBAT_RULES.roundStartJunkDrip;
      state.enemy.junk += COMBAT_RULES.roundStartJunkDrip;
      pushEv(state, events, {
        type: 'round_start',
        round: state.roundIndex,
        text: `Round ${state.roundIndex} starts.`,
      });

      if (!beginFighterTurn(this.content, state, state.player, state.enemy, events)) {
        resolveFighter(this.content, state, state.player, state.enemy, events, combatSeed);
      }
      if (state.enemy.hp <= 0) {
        break;
      }
      if (
        options.stopWhenPlayerDeckWrapsAtLeast !== undefined &&
        state.player.deckWraps >= options.stopWhenPlayerDeckWrapsAtLeast
      ) {
        break;
      }

      if (!beginFighterTurn(this.content, state, state.enemy, state.player, events)) {
        resolveFighter(this.content, state, state.enemy, state.player, events, combatSeed);
      }
      if (state.player.hp <= 0) {
        break;
      }
      if (
        options.stopWhenPlayerDeckWrapsAtLeast !== undefined &&
        state.player.deckWraps >= options.stopWhenPlayerDeckWrapsAtLeast
      ) {
        break;
      }

      armFatigueIfNeeded(state, events);
      applyFatigueIfArmed(state, events);

      if (options.stopAfterRounds !== undefined && state.roundIndex >= options.stopAfterRounds) {
        break;
      }
    }

    const endedByFatigue = state.fatigueArmed && state.player.hp > 0 && state.enemy.hp > 0;
    const playerWon = state.player.hp >= state.enemy.hp;

    return {
      playerWon,
      rounds: state.roundIndex,
      playerDeckCycles: state.player.deckWraps,
      enemyDeckCycles: state.enemy.deckWraps,
      endedByFatigue,
      events,
      enemyDeckUsed: [...setup.enemy.deck],
      finalState: state,
      initialSnapshot,
    };
  }
}
