import type { CardContentService } from '../../core/content';
import type { CombatFighterSnapshot } from '../../core/types';
import { ATTACK_DAMAGE, battleCardFromId, DECK_SIZE, type BattleCard } from './battlePocCardModel';
import {
  BLANK_QUEUE_ID,
  BARON_POSES,
  GLINT_POSES,
  GLINT_PUNCH_STRIP,
  MECH_SPRITE_SHEETS,
  PLAYER_STRIKE_HOLD_MS,
  type MechPoseSet,
  type Phase,
} from './battlePocConstants';

export function parseResolveDamage(text: string): number {
  return parseResolveMetrics(text).dealt;
}

export function parseResolveMetrics(text: string): {
  dealt: number;
  blocked: number;
  selfDmg: number;
} {
  const dealt = /dealt=(\d+)/.exec(text);
  const blocked = /blocked=(\d+)/.exec(text);
  const selfDmg = /selfDmg=(\d+)/.exec(text);
  return {
    dealt: dealt ? Number(dealt[1] ?? '0') : 0,
    blocked: blocked ? Number(blocked[1] ?? '0') : 0,
    selfDmg: selfDmg ? Number(selfDmg[1] ?? '0') : 0,
  };
}

export function padQueueToDeckSize(q: ReadonlyArray<string | null> | string[] | undefined): (string | null)[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => (q && i < q.length ? (q[i] as string | null) : null));
}

export function lockedProgramBattleCard(index: number): BattleCard {
  return {
    id: `__locked__${String(index)}`,
    name: '—',
    cost: 0,
    atk: 0,
    text: 'This program step is not used in the current act.',
    art: '',
    artFocus: 'default',
    statKind: 'other',
    locked: true,
  };
}

export function buffChipsFromSnapshot(s: CombatFighterSnapshot): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.potency > 0) out.push({ key: 'pot', label: `POT +${String(s.potency)}` });
  if (s.bulkStacks > 0) out.push({ key: 'bulk', label: `BULK ${String(s.bulkStacks)}` });
  if (s.coreScrap > 0) out.push({ key: 'core', label: `CORE ${String(s.coreScrap)}` });
  if (s.junk > 0) out.push({ key: 'junk', label: `JNK ${String(s.junk)}` });
  return out;
}

export function debuffChipsFromSnapshot(s: CombatFighterSnapshot): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.exposeDamage > 0) {
    out.push({ key: 'exp', label: `EXPOSE +${String(s.exposeDamage)}` });
  }
  if ((s.virusStacks ?? 0) > 0) {
    out.push({ key: 'virus', label: `VIRUS ${String(s.virusStacks ?? 0)}` });
  }
  if (s.stunnedTurnsLeft != null && s.stunnedTurnsLeft > 0) {
    out.push({ key: 'stun', label: `STUN ${String(s.stunnedTurnsLeft)}` });
  }
  return out;
}

export const isPlayerPhase = (p: Phase): boolean =>
  p === 'player-reveal' ||
  p === 'player-strike' ||
  p === 'player-strike-hold' ||
  p === 'player-recover';
export const isEnemyPhase = (p: Phase): boolean =>
  p === 'enemy-reveal' || p === 'enemy-strike' || p === 'enemy-recover';

export function poseSetForPilot(pilotId: string, fallbackSrc: string): MechPoseSet {
  if (pilotId === 'baron_von_boar') {
    return BARON_POSES;
  }
  if (pilotId === 'glint') {
    return GLINT_POSES;
  }
  return {
    idle: fallbackSrc,
    attackWindup: fallbackSrc,
    attackContact: fallbackSrc,
    hurt: fallbackSrc,
    defeat: fallbackSrc,
  };
}

/** Strip play-through only (not including impact hold). Time-bounded. */
export function playerStrikePhaseMsForPilot(pilotId: string): number {
  if (pilotId === 'glint') {
    const spec = MECH_SPRITE_SHEETS[GLINT_PUNCH_STRIP];
    if (spec) {
      if (spec.attackDurationMs != null) {
        return Math.max(120, Math.round(spec.attackDurationMs));
      }
      const transitions = Math.max(1, spec.frameCount - 1);
      return Math.max(120, Math.round((transitions / Math.max(spec.fps, 1)) * 1000));
    }
  }
  return 420;
}

/** Full player-resolve visual budget: strip + frozen impact (replay dwell). */
export function playerStrikeTotalMsForPilot(pilotId: string): number {
  return playerStrikePhaseMsForPilot(pilotId) + PLAYER_STRIKE_HOLD_MS;
}

export const makeDeck = (prefix: string): BattleCard[] =>
  Array.from({ length: DECK_SIZE }, (_, i) => ({
    id: `${prefix}-${i + 1}`,
    name: 'Basic Attack',
    cost: 1,
    atk: ATTACK_DAMAGE,
    text: `Deal ${ATTACK_DAMAGE} damage.`,
    art: '/poc/poc-card-attack.png',
    artFocus: 'default' as const,
    statKind: 'strike' as const,
  }));

/**
 * Maps a padded queue + act slot count to UI chips for replay (player vs enemy).
 * `stripIdPrefix` becomes part of React keys (`rp` / `re`).
 */
export function deckCardsFromReplayQueue(
  queueRaw: (string | null)[],
  activeSlots: number,
  content: CardContentService,
  stripIdPrefix: 'rp' | 're',
): BattleCard[] {
  return queueRaw.map((id, i) => {
    if (i >= activeSlots) {
      return { ...lockedProgramBattleCard(i), id: `${stripIdPrefix}-${String(i)}-locked` };
    }
    return {
      ...battleCardFromId(id ?? BLANK_QUEUE_ID, content),
      id: `${stripIdPrefix}-${String(i)}-${id ?? 'blank'}`,
    };
  });
}
