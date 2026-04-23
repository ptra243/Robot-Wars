import { describe, expect, it } from 'vitest';
import { CombatSimulator } from '../core/combat';
import { CardContentService } from '../core/content';
import { createNewRun, createCombatSetupFromDecklists, syncRunFromCombatResult } from '../core/run';
import { COMBAT_RULES } from '../core/rules';
import { callTraitOnCombatStart } from '../core/traits';
import type { CombatResult, FighterState } from '../core/types';
import { makeTestFighter } from './helpers';

const BLANK = COMBAT_RULES.blankQueueSlotCardId;
const Q = COMBAT_RULES.queueSize;

function nilQueue9(): Array<string | null> {
  return Array.from({ length: Q }, () => null);
}

function blankQueue9(): string[] {
  return Array.from({ length: Q }, () => BLANK);
}

function victoryResult(player: FighterState, enemy: FighterState): CombatResult {
  return {
    playerWon: true,
    rounds: 1,
    playerDeckCycles: 0,
    enemyDeckCycles: 0,
    endedByFatigue: false,
    events: [],
    enemyDeckUsed: [],
    finalState: {
      player,
      enemy,
      roundIndex: 0,
      globalResolutions: 0,
      fatigueArmed: false,
      fatigueRoundsElapsed: 0,
    },
    initialSnapshot: {
      roundIndex: 0,
      player: { hp: 1, block: 0, charge: 0, junk: 0, bulkStacks: 0, coreScrap: 0, potency: 0, exposeDamage: 0 },
      enemy: { hp: 1, block: 0, charge: 0, junk: 0, bulkStacks: 0, coreScrap: 0, potency: 0, exposeDamage: 0 },
      playerQueueCursor: 0,
      enemyQueueCursor: 0,
    },
  };
}

describe('post-combat card reversion (after a won battle)', () => {
  it('reverts Factory Reset: queue + deck return to the pre-combat program, not Neutral Basic', () => {
    const run = createNewRun(1);
    const initialPlanned = nilQueue9();
    initialPlanned[0] = 'core_tap_t1';
    const initialEnemy = nilQueue9();
    const deckBefore = ['core_tap_t1', 'neutral_basic_strike_t1', 'neutral_basic_strike_t1'];

    run.deck = [...deckBefore];
    run.plannedQueue = [...initialPlanned];
    run.enemyPlannedQueue = [...initialEnemy];

    // After combat, slot 0 is Neutral Basic (Factory Reset) and deck got synced to that id.
    const inCombatQueue = blankQueue9();
    inCombatQueue[0] = 'neutral_basic_strike_t1';
    const inCombatDeck = ['neutral_basic_strike_t1', 'neutral_basic_strike_t1', 'neutral_basic_strike_t1'];

    const player = makeTestFighter('Player', inCombatDeck, inCombatQueue);
    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    player.queue = inCombatQueue;
    player.deck = [...inCombatDeck];
    player.hp = 5;

    const result = victoryResult(player, enemy);
    syncRunFromCombatResult(run, result, initialPlanned, initialEnemy, deckBefore);

    expect(run.plannedQueue[0]).toBe('core_tap_t1');
    expect(run.deck.filter((id) => id === 'core_tap_t1').length).toBe(1);
    expect(run.deck.filter((id) => id === 'neutral_basic_strike_t1').length).toBe(2);
  });

  it("reverts Glint Aw0 «Wish upon a star»: temp tier upgrade clears; planned slot is the pre-battle id", () => {
    const run = createNewRun(1);
    const initialPlanned = nilQueue9();
    initialPlanned[0] = 'salvage_strike_t1';
    const initialEnemy = nilQueue9();
    const deckBefore = ['salvage_strike_t1', 'neutral_basic_strike_t1', 'strip_mine_t1'];

    run.deck = [...deckBefore];
    run.plannedQueue = [...initialPlanned];
    run.enemyPlannedQueue = [...initialEnemy];

    // In combat the queue shows t2, but originalId is still recorded for sync.
    const inCombatQueue = blankQueue9();
    inCombatQueue[0] = 'salvage_strike_t2';
    const player = makeTestFighter('Player', ['salvage_strike_t2', 'neutral_basic_strike_t1', 'strip_mine_t1'], inCombatQueue);
    player.queue = inCombatQueue;
    player.tempUpgrade = { slotIndex: 0, originalId: 'salvage_strike_t1' };
    player.hp = 5;

    const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
    const result = victoryResult(player, enemy);
    syncRunFromCombatResult(run, result, initialPlanned, initialEnemy, deckBefore);

    expect(run.plannedQueue[0]).toBe('salvage_strike_t1');
  });

  it('e2e: after a won combat, sync restores Core Tap in planned queue and deck (Factory Reset reverted)', () => {
    const content = CardContentService.loadDefault(1);
    const run = createNewRun(1);
    const initialPlanned = nilQueue9();
    initialPlanned[0] = 'core_tap_t1';
    const initialEnemy = nilQueue9();
    const deckBefore = ['core_tap_t1', 'neutral_basic_strike_t1', 'neutral_basic_strike_t1'];

    run.deck = [...deckBefore];
    run.plannedQueue = [...initialPlanned];
    run.enemyPlannedQueue = [...initialEnemy];

    const setup = createCombatSetupFromDecklists({
      seed: 42,
      playerDeck: deckBefore,
      enemyDeck: ['neutral_basic_strike_t1'],
      playerQueue: initialPlanned,
    });
    setup.player.charge = 99;
    setup.enemy.hp = 1;

    const result = new CombatSimulator(content, 1).run(setup);
    expect(result.playerWon, 'faster kill with 1-HP enemy + charge for strike').toBe(true);
    expect(result.finalState.player.queue[0]).toBe('neutral_basic_strike_t1');

    syncRunFromCombatResult(run, result, initialPlanned, initialEnemy, deckBefore);

    expect(run.plannedQueue[0]).toBe('core_tap_t1');
    expect(run.deck.filter((id) => id === 'core_tap_t1').length).toBe(1);
  });

  it("e2e: after a won combat, sync restores pre-battle id for Glint Aw0 «Wish upon a star» temp upgrade", () => {
    const content = CardContentService.loadDefault(1);
    const run = createNewRun(2);
    const initialPlanned = nilQueue9();
    initialPlanned[0] = 'salvage_strike_t1';
    const initialEnemy = nilQueue9();
    const deckBefore = ['salvage_strike_t1', 'neutral_basic_strike_t1', 'strip_mine_t1'];

    run.deck = [...deckBefore];
    run.plannedQueue = [...initialPlanned];
    run.enemyPlannedQueue = [...initialEnemy];

    const setup = createCombatSetupFromDecklists({
      seed: 7,
      playerDeck: deckBefore,
      enemyDeck: ['neutral_basic_strike_t1'],
      playerQueue: initialPlanned,
    });
    setup.player.charge = 99;
    setup.enemy.hp = 1;
    setup.player.traitIds = ['glint_aw0'];
    callTraitOnCombatStart(setup.player, content);
    expect(setup.player.queue[0]).toBe('salvage_strike_t2');
    expect(setup.player.tempUpgrade).toEqual({ slotIndex: 0, originalId: 'salvage_strike_t1' });

    const result = new CombatSimulator(content, 1).run(setup);
    expect(result.playerWon).toBe(true);
    expect(result.finalState.player.tempUpgrade).toEqual({ slotIndex: 0, originalId: 'salvage_strike_t1' });

    syncRunFromCombatResult(run, result, initialPlanned, initialEnemy, deckBefore);

    expect(run.plannedQueue[0]).toBe('salvage_strike_t1');
  });
});
