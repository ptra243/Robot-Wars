import { publicUrl } from '../../assetUrl';
import type { CardContentService } from '../../core/content';
import type { CombatFighterSnapshot } from '../../core/types';
import {
  SCRAP_ENGINE_ICON,
  SCRAP_HOUND_ATTACK_ICON,
  SCRAP_HOUND_SHIELD_ICON,
} from '../../ui/scrapHoundIcons';
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

export type AuraChip = {
  key: string;
  label: string;
  iconSrc?: string;
  title?: string;
};

export function buffChipsFromSnapshot(s: CombatFighterSnapshot): AuraChip[] {
  const out: AuraChip[] = [];
  if (s.potency > 0) out.push({ key: 'pot', label: `POT +${String(s.potency)}` });
  if (s.bulkStacks > 0) out.push({ key: 'bulk', label: `BULK ${String(s.bulkStacks)}` });
  if (s.coreScrap > 0) out.push({ key: 'core', label: `CORE ${String(s.coreScrap)}` });
  if (s.junk > 0) out.push({ key: 'junk', label: `JNK ${String(s.junk)}` });
  if ((s.scrapEngineCount ?? 0) > 0) {
    out.push({
      key: 'scrap-engine',
      label: String(s.scrapEngineCount),
      iconSrc: SCRAP_ENGINE_ICON,
      title: `Scrap Engine ×${String(s.scrapEngineCount)} (+1 Junk each of your turns per engine)`,
    });
  }
  if ((s.scrapHoundAttackStacks ?? 0) > 0) {
    out.push({
      key: 'scrap-hound-atk',
      label: String(s.scrapHoundAttackStacks),
      iconSrc: SCRAP_HOUND_ATTACK_ICON,
      title: `Scrap Hound (attack) ×${String(s.scrapHoundAttackStacks)} (tick: stacks + potency)`,
    });
  }
  if ((s.scrapHoundShieldStacks ?? 0) > 0) {
    out.push({
      key: 'scrap-hound-shd',
      label: String(s.scrapHoundShieldStacks),
      iconSrc: SCRAP_HOUND_SHIELD_ICON,
      title: `Scrap Hound (shield) ×${String(s.scrapHoundShieldStacks)} (tick: stacks + potency)`,
    });
  }
  if ((s.scrapEnergyEngineStacks ?? 0) > 0) {
    out.push({
      key: 'scrap-energy',
      label: `EN×${String(s.scrapEnergyEngineStacks)}`,
      title: `Energy Engine ×${String(s.scrapEnergyEngineStacks)} (+charge each of your turns)`,
    });
  }
  if ((s.scrapExposeEngineStacks ?? 0) > 0) {
    out.push({
      key: 'scrap-expose',
      label: `EX×${String(s.scrapExposeEngineStacks)}`,
      title: `Expose Engine ×${String(s.scrapExposeEngineStacks)} (Expose each of your turns)`,
    });
  }
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
    art: publicUrl('/poc/poc-card-attack.png'),
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
