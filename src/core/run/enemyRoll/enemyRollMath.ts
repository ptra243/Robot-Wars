import type { OpponentBand } from '../opponentDecks';

const DRAFT_X_CAP = 12;

export function bandFromNode(node: 'battle' | 'elite' | 'boss'): OpponentBand {
  if (node === 'elite') return 'elite';
  if (node === 'boss') return 'boss';
  return 'normal';
}

/** Act 1: 5 slots, act 2: 7, act 3+: 9 (see plan §1). */
export function activeQueueSlotsForAct(act: number): number {
  if (act <= 1) return 5;
  if (act === 2) return 7;
  return 9;
}

/**
 * `X` in `5 + X` draft rounds: scales with act / path / act4.
 */
export function extraDraftRoundsX(
  act: number,
  stepsInAct: number,
  act4BattleIndex: number,
  node: 'battle' | 'elite' | 'boss',
): number {
  let x = Math.max(0, act - 1) + Math.min(4, Math.floor(stepsInAct / 2));
  if (node === 'elite') x += 2;
  else if (node === 'boss') x += 1;
  x += Math.min(6, act4BattleIndex);
  return Math.min(DRAFT_X_CAP, x);
}

