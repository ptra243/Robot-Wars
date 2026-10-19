import { describe, expect, it } from 'vitest';
import type { CombatEvent, CombatEventSnapshot, CombatFighterSnapshot } from '../core/types';
import { ATTACK_DAMAGE } from '../components/poc/battlePocCardModel';
import {
  advanceScripted,
  buildBattleVisualSteps,
  damageBetween,
} from '../ui/phaserBattle/battleVisualStep';

function fighter(hp: number, block = 0): CombatFighterSnapshot {
  return {
    hp,
    block,
    charge: 0,
    junk: 0,
    bulkStacks: 0,
    coreScrap: 0,
    potency: 0,
    exposeDamage: 0,
  };
}

function snap(playerHp: number, enemyHp: number, playerBlock = 0, enemyBlock = 0): CombatEventSnapshot {
  return {
    roundIndex: 1,
    player: fighter(playerHp, playerBlock),
    enemy: fighter(enemyHp, enemyBlock),
    playerQueueCursor: 0,
    enemyQueueCursor: 0,
  };
}

function event(partial: Partial<CombatEvent> & Pick<CombatEvent, 'type' | 'text'>): CombatEvent {
  return { round: 1, ...partial };
}

describe('battle visual steps', () => {
  it('separates shield loss and hp loss on the fighter who took them', () => {
    const pops = damageBetween(snap(40, 40, 6, 2), snap(37, 40, 1, 2));
    expect(pops).toEqual([{ target: 'player', hp: 3, shield: 5 }]);
  });

  it('ignores shield gained during the step', () => {
    expect(damageBetween(snap(40, 40, 0, 0), snap(40, 40, 4, 0))).toEqual([]);
  });

  it('maps resolve, stall, whiff, and fatigue onto one step each', () => {
    const initial = snap(50, 50, 4, 0);
    const afterResolve = snap(50, 44, 4, 0);
    const afterStall = snap(50, 44, 4, 0);
    const afterWhiff = snap(50, 44, 4, 0);
    const afterFatigue = snap(47, 41, 0, 0);
    const steps = buildBattleVisualSteps({
      pilotId: 'glint',
      playerWon: true,
      initial,
      events: [
        event({ type: 'resolve', text: 'Player strikes', actor: 'Player', snapshot: afterResolve }),
        event({ type: 'stall_skip', text: 'Enemy stalls', actor: 'Enemy', snapshot: afterStall }),
        event({ type: 'whiff', text: 'Whiff', actor: 'Player', snapshot: afterWhiff }),
        event({ type: 'fatigue_tick', text: 'Thermal runaway', snapshot: afterFatigue }),
      ],
    });

    expect(steps.map((step) => step.kind)).toEqual([
      'intro',
      'strike',
      'stall',
      'whiff',
      'fatigue',
      'victory',
    ]);
    expect(steps[1]).toMatchObject({
      actor: 'player',
      damage: [{ target: 'enemy', hp: 6, shield: 0 }],
    });
    expect(steps[2]?.damage).toEqual([]);
    expect(steps[3]?.damage).toEqual([]);
    expect(steps[4]?.damage).toEqual([
      { target: 'player', hp: 3, shield: 4 },
      { target: 'enemy', hp: 3, shield: 0 },
    ]);
    expect(steps[5]?.kind).toBe('victory');
  });

  it('advances the scripted demo one card at a time and ends the deck', () => {
    const opened = advanceScripted({ beat: 'intro', turn: 0, playerHp: 50, enemyHp: 50, deckSize: 2 });
    expect(opened.beat).toBe('player');
    const enemyTurn = advanceScripted(opened);
    expect(enemyTurn).toMatchObject({ beat: 'enemy', enemyHp: 50 - ATTACK_DAMAGE });
    const next = advanceScripted(enemyTurn);
    expect(next).toMatchObject({ beat: 'player', turn: 1, playerHp: 50 - ATTACK_DAMAGE });
    const lastEnemy = advanceScripted(advanceScripted(next));
    expect(lastEnemy.beat === 'victory' || lastEnemy.beat === 'defeat').toBe(true);
  });
});
