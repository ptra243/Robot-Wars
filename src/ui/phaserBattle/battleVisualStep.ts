import type { CombatEvent, CombatEventSnapshot, CombatFighterSnapshot } from '../../core/types';
import { ATTACK_DAMAGE, DECK_SIZE } from '../../components/poc/battlePocCardModel';
import { PLAYER_STRIKE_HOLD_MS, type Phase } from '../../components/poc/battlePocConstants';
import { playerStrikePhaseMsForPilot } from '../../components/poc/battlePocHelpers';

export type BattleActor = 'player' | 'enemy' | 'none';

export type BattleStepKind =
  | 'intro'
  | 'strike'
  | 'stall'
  | 'whiff'
  | 'fatigue'
  | 'buff'
  | 'hurt'
  | 'factory_reset'
  | 'victory'
  | 'defeat';

export interface DamagePop {
  target: 'player' | 'enemy';
  hp: number;
  shield: number;
}

export interface BattleVisualStep {
  id: string;
  kind: BattleStepKind;
  actor: BattleActor;
  /** Index into the combat event log, or -1 for a synthetic beat. */
  eventIndex: number;
  durationMs: number;
  damage: DamagePop[];
  label?: string;
}

export type ScriptBeat = 'intro' | 'player' | 'enemy' | 'victory' | 'defeat';

const WHIFF_TYPES = new Set(['whiff', 'continuous_skip', 'persistent_skip', 'bonus_fizzle']);

function actorFor(event: CombatEvent): BattleActor {
  if (event.actor === 'Player') return 'player';
  if (event.actor === 'Enemy') return 'enemy';
  return 'none';
}

function loss(prev: CombatFighterSnapshot, next: CombatFighterSnapshot): { hp: number; shield: number } {
  return {
    hp: Math.max(0, prev.hp - next.hp),
    shield: Math.max(0, prev.block - next.block),
  };
}

export function damageBetween(prev: CombatEventSnapshot, next: CombatEventSnapshot): DamagePop[] {
  const pops: DamagePop[] = [];
  const player = loss(prev.player, next.player);
  const enemy = loss(prev.enemy, next.enemy);
  if (player.hp > 0 || player.shield > 0) pops.push({ target: 'player', ...player });
  if (enemy.hp > 0 || enemy.shield > 0) pops.push({ target: 'enemy', ...enemy });
  return pops;
}

function kindFor(event: CombatEvent, damage: DamagePop[]): BattleStepKind {
  if (event.type === 'resolve') return 'strike';
  if (event.type === 'stall_skip') return 'stall';
  if (WHIFF_TYPES.has(event.type)) return 'whiff';
  if (event.type === 'fatigue_tick' || event.type === 'fatigue_armed') return 'fatigue';
  if (event.type === 'factory_reset') return 'factory_reset';
  if (damage.length > 0) return 'hurt';
  return 'buff';
}

function durationFor(kind: BattleStepKind, actor: BattleActor, pilotId: string): number {
  if (kind === 'strike') {
    return actor === 'player' ? playerStrikePhaseMsForPilot(pilotId) + PLAYER_STRIKE_HOLD_MS : 900;
  }
  if (kind === 'factory_reset') return 900;
  if (kind === 'fatigue' || kind === 'hurt') return 720;
  if (kind === 'stall' || kind === 'whiff') return 640;
  if (kind === 'intro' || kind === 'victory' || kind === 'defeat') return 700;
  return 520;
}

export function buildBattleVisualSteps(input: {
  events: readonly CombatEvent[];
  initial: CombatEventSnapshot;
  playerWon: boolean;
  pilotId: string;
}): BattleVisualStep[] {
  const steps: BattleVisualStep[] = [
    {
      id: 'intro',
      kind: 'intro',
      actor: 'none',
      eventIndex: -1,
      durationMs: durationFor('intro', 'none', input.pilotId),
      damage: [],
      label: 'BATTLE COMMENCE',
    },
  ];

  let prev = input.initial;
  input.events.forEach((event, index) => {
    const snap = event.snapshot ?? prev;
    const damage = damageBetween(prev, snap);
    const actor = actorFor(event);
    const kind = kindFor(event, damage);
    steps.push({
      id: `ev-${String(index)}-${event.type}`,
      kind,
      actor,
      eventIndex: index,
      durationMs: durationFor(kind, actor, input.pilotId),
      damage,
      label: event.text,
    });
    prev = snap;
  });

  const resultKind: BattleStepKind = input.playerWon ? 'victory' : 'defeat';
  steps.push({
    id: 'result',
    kind: resultKind,
    actor: 'none',
    eventIndex: Math.max(0, input.events.length - 1),
    durationMs: durationFor(resultKind, 'none', input.pilotId),
    damage: [],
    label: input.playerWon ? 'VICTORY — Enemy core offline' : 'DEFEAT — Reactor critical',
  });
  return steps;
}

/** Which belt pitches a cartridge into the slot for this beat. */
export function beltActorForStep(step: BattleVisualStep): 'player' | 'enemy' | null {
  if (step.actor === 'none') return null;
  if (step.kind === 'intro' || step.kind === 'victory' || step.kind === 'defeat') return null;
  return step.actor;
}

export function phaseForScript(beat: ScriptBeat): Phase {
  switch (beat) {
    case 'intro':
      return 'intro';
    case 'player':
      return 'player-strike';
    case 'enemy':
      return 'enemy-strike';
    case 'victory':
      return 'victory';
    case 'defeat':
      return 'defeat';
  }
}

export function scriptedVisualStep(beat: ScriptBeat, turn: number, pilotId: string): BattleVisualStep {
  if (beat === 'player' || beat === 'enemy') {
    const target = beat === 'player' ? 'enemy' : 'player';
    return {
      id: `script-${beat}-${String(turn)}`,
      kind: 'strike',
      actor: beat,
      eventIndex: -1,
      durationMs: durationFor('strike', beat, pilotId),
      damage: [{ target, hp: ATTACK_DAMAGE, shield: 0 }],
      label: beat === 'player' ? 'Player strikes' : 'Enemy strikes',
    };
  }
  const kind: BattleStepKind = beat === 'intro' ? 'intro' : beat;
  return {
    id: `script-${beat}`,
    kind,
    actor: 'none',
    eventIndex: -1,
    durationMs: durationFor(kind, 'none', pilotId),
    damage: [],
  };
}

export function advanceScripted(input: {
  beat: ScriptBeat;
  turn: number;
  playerHp: number;
  enemyHp: number;
  deckSize?: number;
}): { beat: ScriptBeat; turn: number; playerHp: number; enemyHp: number } {
  const deckSize = input.deckSize ?? DECK_SIZE;
  if (input.beat === 'intro') {
    return { ...input, beat: 'player' };
  }
  if (input.beat === 'player') {
    const enemyHp = Math.max(0, input.enemyHp - ATTACK_DAMAGE);
    if (enemyHp <= 0) return { ...input, enemyHp, beat: 'victory' };
    return { ...input, enemyHp, beat: 'enemy' };
  }
  if (input.beat === 'enemy') {
    const playerHp = Math.max(0, input.playerHp - ATTACK_DAMAGE);
    if (playerHp <= 0) return { ...input, playerHp, beat: 'defeat' };
    const turn = input.turn + 1;
    if (turn >= deckSize) {
      return { ...input, playerHp, turn, beat: playerHp >= input.enemyHp ? 'victory' : 'defeat' };
    }
    return { ...input, playerHp, turn, beat: 'player' };
  }
  return {
    beat: input.beat,
    turn: input.turn,
    playerHp: input.playerHp,
    enemyHp: input.enemyHp,
  };
}
