import { describe, expect, it } from 'vitest';
import { resolveEmergencyProtocolEndOfPlayerTurn } from '../core/combat/flow';
import type { CombatEvent, CombatState } from '../core/types';
import { makeTestFighter } from './helpers';

function makeState(playerHp: number, stacks: number): CombatState {
  const player = makeTestFighter('Player', ['neutral_basic_strike_t1'], [null]);
  const enemy = makeTestFighter('Enemy', ['neutral_basic_strike_t1'], [null]);
  player.hp = playerHp;
  player.emergencyProtocolStacks = stacks;
  return {
    player,
    enemy,
    roundIndex: 1,
    globalResolutions: 0,
    fatigueArmed: false,
    fatigueRoundsElapsed: 0,
  };
}

describe('Emergency Protocol end-of-turn', () => {
  it('applies self-damage equal to current EP stacks', () => {
    const state = makeState(8, 3);
    const events: CombatEvent[] = [];

    resolveEmergencyProtocolEndOfPlayerTurn(state, events);

    expect(state.player.hp).toBe(5);
    expect(state.player.emergencyProtocolStacks).toBe(3);
    expect(events.some((e) => e.type === 'emergency_protocol_drain')).toBe(true);
  });

  it('when EP self-damage would drop HP to 0, spends one stack and survives at 1 HP', () => {
    const state = makeState(2, 2);
    const events: CombatEvent[] = [];

    resolveEmergencyProtocolEndOfPlayerTurn(state, events);

    expect(state.player.hp).toBe(1);
    expect(state.player.emergencyProtocolStacks).toBe(1);
    expect(state.player.potency).toBe(1);
    expect(events.some((e) => e.type === 'emergency_protocol_drain')).toBe(true);
    expect(events.some((e) => e.type === 'emergency_protocol')).toBe(true);
  });

  it('respects Prime Directive hold: no stack is spent when hold flag is set', () => {
    const state = makeState(1, 1);
    state.player.preventEmergencyProtocolSpendThisTurn = true;
    const events: CombatEvent[] = [];

    resolveEmergencyProtocolEndOfPlayerTurn(state, events);

    expect(state.player.hp).toBe(1);
    expect(state.player.emergencyProtocolStacks).toBe(1);
    expect(state.player.potency).toBe(0);
    expect(state.player.preventEmergencyProtocolSpendThisTurn).toBe(false);
    expect(events.some((e) => e.type === 'emergency_protocol_hold')).toBe(true);
  });
});

