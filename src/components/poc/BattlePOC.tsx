import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { CardContentService } from '../../core/content';
import { getPilotById, getPilotMechSpriteUrl, getPilotPortraitUrl } from '../../core/pilots';
import { COMBAT_RULES } from '../../core/rules';
import type { CombatFighterSnapshot, CombatResult } from '../../core/types';
import {
  BattleAnalysisModal,
  type BattleAnalysisRoundMetrics,
} from './forge/BattleAnalysisModal';
import { PocKnockoutCardFilter } from './PocKnockoutCardFilter';
import {
  type BattlePocSpeed as Speed,
  type BattlePocStage as Stage,
  SpeedControl,
  StageControl,
} from './BattlePocControls';
import { BattlePocDeckStrip } from './BattlePocDeckStrip';
import { BattlePocPilotHUD, BATTLE_POC_ENERGY_BAR_CAP, BATTLE_POC_SHIELD_BAR_CAP } from './BattlePocPilotHUD';
import { battleCardFromId, type BattleCard, DECK_SIZE, ATTACK_DAMAGE } from './battlePocCardModel';
import './battle-poc.css';

interface BattlePOCProps {
  onExit: () => void;
  combatResult?: CombatResult | null;
  seed?: number;
  /** Run pilot id (`run.spirit.id`); selects player mech art. Defaults to glint. */
  pilotId?: string;
  /** When provided, a "RUN NEW" button appears in the topbar to re-simulate. */
  onRunEncounter?: () => void;
  /** Victory: takes player to the reward screen to pick a card + collect gold. */
  onContinue?: () => void;
  /** Defeat: apply -10% enemy HP assist and return to forge. */
  onRetryHpDown?: () => void;
  /** Defeat: apply +3 free rerolls assist and return to forge. */
  onRetryRerolls?: () => void;
  /** When set with `onReplaySpeedChange`, speed is persisted (e.g. per run). */
  replaySpeed?: Speed;
  onReplaySpeedChange?: (s: Speed) => void;
}

function parseResolveDamage(text: string): number {
  const m = /dealt=(\d+)/.exec(text);
  return m ? Number(m[1] ?? '0') : 0;
}

/**
 * Battle phase machine. The scripted POC cycles through these in order,
 * alternating between player and enemy. Durations are tuned in
 * PHASE_DURATIONS below; `speedScale` state divides them.
 */
type Phase =
  | 'intro'
  | 'player-reveal'
  | 'player-strike'
  /** Final punch frame held before sliding back (see PLAYER_STRIKE_HOLD_MS). */
  | 'player-strike-hold'
  | 'player-recover'
  | 'enemy-reveal'
  | 'enemy-strike'
  | 'enemy-recover'
  | 'victory'
  | 'defeat';

type MechPose = 'idle' | 'attackWindup' | 'attackContact' | 'hurt' | 'defeat';

interface MechPoseSet {
  idle: string;
  attackWindup: string;
  attackContact: string;
  hurt: string;
  defeat: string;
}

interface SpriteSheetSpec {
  frameCount: number;
  fps: number;
  /**
   * Per-frame aspect ratio (W/H), used to letterbox the strip inside the
   * landscape mech container so a portrait-leaning source doesn't get squished
   * vertically. Compute as `(sourceWidth / frameCount) / sourceHeight`.
   */
  frameAspect?: number;
}

const BLANK_QUEUE_ID = COMBAT_RULES.blankQueueSlotCardId;

function padQueueToDeckSize(q: ReadonlyArray<string | null> | string[] | undefined): (string | null)[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => (q && i < q.length ? (q[i] as string | null) : null));
}

function lockedProgramBattleCard(index: number): BattleCard {
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

const PLAYER_MAX_HP = 50;
const ENEMY_MAX_HP = 50;

/** Frozen impact pose after the strip finishes, before returning to idle. */
const PLAYER_STRIKE_HOLD_MS = 500;

const PHASE_DURATIONS: Record<Phase, number> = {
  intro: 900,
  /* Slightly longer windup so the rush reads before the strip runs. */
  'player-reveal': 820,
  /* Overridden at runtime for Glint strip length — keep non-zero for typing. */
  'player-strike': 1000,
  'player-strike-hold': PLAYER_STRIKE_HOLD_MS,
  /* Return slide + settle before enemy turn / next program card advance. */
  'player-recover': 580,
  'enemy-reveal': 700,
  'enemy-strike': 520,
  'enemy-recover': 380,
  victory: 0,
  defeat: 0,
};

const ENEMY_MECH_POSES: MechPoseSet = {
  idle: '/poc/poc-mech-enemy-sprite.png',
  attackWindup: '/poc/poc-mech-enemy-sprite.png',
  attackContact: '/poc/poc-mech-enemy-sprite.png',
  hurt: '/poc/poc-mech-enemy-sprite.png',
  defeat: '/poc/poc-mech-enemy-sprite.png',
};

const GLINT_PUNCH_STRIP = '/poc/poc-mech-glint-punch-strip.png';

const GLINT_POSES: MechPoseSet = {
  idle: GLINT_PUNCH_STRIP,
  attackWindup: GLINT_PUNCH_STRIP,
  attackContact: GLINT_PUNCH_STRIP,
  hurt: GLINT_PUNCH_STRIP,
  defeat: GLINT_PUNCH_STRIP,
};

const BARON_POSES: MechPoseSet = {
  idle: '/poc/poc-mech-baron-von-boar-sprite.png',
  attackWindup: '/poc/poc-mech-baron-von-boar-sprite.png',
  attackContact: '/poc/poc-mech-baron-von-boar-sprite.png',
  hurt: '/poc/poc-mech-baron-von-boar-sprite.png',
  defeat: '/poc/poc-mech-baron-von-boar-sprite.png',
};

/**
 * Optional strip animation metadata by image URL.
 *
 * `fps` is the rate at which frame transitions occur during the attack play-once
 * cycle (`steps(N, jump-none)`). For an N-frame strip there are N-1 transitions,
 * so total play time is `(N - 1) / fps` seconds. `player-strike` lasts that long;
 * then `player-strike-hold` (500ms) freezes the last frame before recover.
 */
const MECH_SPRITE_SHEETS: Record<string, SpriteSheetSpec | undefined> = {
  // Source: 1746×376 sliced into 6 equal columns of 291×376 each (frame
  // aspect ≈ 0.77 — closer to square than the original 0.54 portrait).
  // Each frame is independently bbox-cropped from the AI source then
  // pasted centered into a uniform column wide enough to contain the
  // widest pose (the fully-extended punch + impact burst). See
  // `scripts/sliceGlintStrip.ps1` for the slicing pipeline.
  [GLINT_PUNCH_STRIP]: { frameCount: 6, fps: 5, frameAspect: 291 / 376 },
};

/**
 * Strip attack length = (N−1)/fps for N frames. Static pilots use a fixed beat.
 * `player-strike` phase duration uses this so the strip can finish, then
 * `player-strike-hold` keeps the last frame for PLAYER_STRIKE_HOLD_MS.
 */
function playerStrikePhaseMsForPilot(pilotId: string): number {
  if (pilotId === 'glint') {
    const spec = MECH_SPRITE_SHEETS[GLINT_PUNCH_STRIP];
    if (spec) {
      const transitions = Math.max(1, spec.frameCount - 1);
      return Math.max(120, Math.round((transitions / Math.max(spec.fps, 1)) * 1000));
    }
  }
  return 780;
}

const makeDeck = (prefix: string): BattleCard[] =>
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

function buffChipsFromSnapshot(s: CombatFighterSnapshot): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  if (s.potency > 0) out.push({ key: 'pot', label: `POT +${String(s.potency)}` });
  if (s.bulkStacks > 0) out.push({ key: 'bulk', label: `BULK ${String(s.bulkStacks)}` });
  if (s.coreScrap > 0) out.push({ key: 'core', label: `CORE ${String(s.coreScrap)}` });
  if (s.junk > 0) out.push({ key: 'junk', label: `JNK ${String(s.junk)}` });
  return out;
}

function debuffChipsFromSnapshot(s: CombatFighterSnapshot): { key: string; label: string }[] {
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

const isPlayerPhase = (p: Phase): boolean =>
  p === 'player-reveal' ||
  p === 'player-strike' ||
  p === 'player-strike-hold' ||
  p === 'player-recover';
const isEnemyPhase = (p: Phase): boolean =>
  p === 'enemy-reveal' || p === 'enemy-strike' || p === 'enemy-recover';

function poseSetForPilot(pilotId: string, fallbackSrc: string): MechPoseSet {
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

export function BattlePOC({
  onExit,
  combatResult,
  seed = 1,
  onRunEncounter,
  onContinue,
  onRetryHpDown,
  onRetryRerolls,
  pilotId = 'glint',
  replaySpeed,
  onReplaySpeedChange,
}: BattlePOCProps) {
  const pilot = getPilotById(pilotId);
  const playerMechSrc = getPilotMechSpriteUrl(pilotId);
  const playerPortrait = getPilotPortraitUrl(pilotId);
  const playerHudName = (pilot?.name ?? 'Glint').toUpperCase();
  const replayContent = useMemo(() => CardContentService.loadDefault(seed), [seed]);
  const replayEvents = combatResult?.events ?? [];
  const hasReplay = replayEvents.length > 0;
  const playerDeck = useMemo(() => makeDeck('p'), []);
  const enemyDeck = useMemo(() => makeDeck('e'), []);

  const [phase, setPhase] = useState<Phase>('intro');
  const [turnIndex, setTurnIndex] = useState(0);
  const [playerHP, setPlayerHP] = useState(PLAYER_MAX_HP);
  const [enemyHP, setEnemyHP] = useState(ENEMY_MAX_HP);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(replaySpeed ?? 1);
  const [stage, setStage] = useState<Stage>('market');
  const [replayStep, setReplayStep] = useState(-1);
  const [replayResultVisible, setReplayResultVisible] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [analysisSide, setAnalysisSide] = useState<'player' | 'enemy'>('player');

  const playerStrikeMs = useMemo(() => playerStrikePhaseMsForPilot(pilotId), [pilotId]);

  useEffect(() => {
    if (replaySpeed !== undefined) {
      setSpeed(replaySpeed);
    }
  }, [replaySpeed]);

  const handleSpeedChange = (s: Speed) => {
    setSpeed(s);
    onReplaySpeedChange?.(s);
  };

  const resetBattle = () => {
    if (hasReplay) {
      setReplayStep(-1);
      setPaused(false);
      return;
    }
    setPhase('intro');
    setTurnIndex(0);
    setPlayerHP(PLAYER_MAX_HP);
    setEnemyHP(ENEMY_MAX_HP);
    setPaused(false);
  };

  useEffect(() => {
    if (hasReplay) {
      return undefined;
    }
    if (paused) return undefined;
    if (phase === 'victory' || phase === 'defeat') return undefined;

    const duration =
      (phase === 'player-strike' ? playerStrikeMs : PHASE_DURATIONS[phase]) / speed;
    const timer = window.setTimeout(() => {
      if (phase === 'player-strike') {
        const next = Math.max(0, enemyHP - ATTACK_DAMAGE);
        setEnemyHP(next);
        setPhase(next <= 0 ? 'victory' : 'player-strike-hold');
        return;
      }
      if (phase === 'player-strike-hold') {
        setPhase('player-recover');
        return;
      }
      if (phase === 'enemy-strike') {
        const next = Math.max(0, playerHP - ATTACK_DAMAGE);
        setPlayerHP(next);
        setPhase(next <= 0 ? 'defeat' : 'enemy-recover');
        return;
      }
      if (phase === 'enemy-recover') {
        const nextTurn = turnIndex + 1;
        if (nextTurn >= DECK_SIZE) {
          // Deck exhausted without KO — in a real run we'd loop the deck;
          // for this scripted POC we end the engagement as a tie winner.
          setPhase(playerHP >= enemyHP ? 'victory' : 'defeat');
          return;
        }
        setTurnIndex(nextTurn);
        setPhase('player-reveal');
        return;
      }
      switch (phase) {
        case 'intro':
          setPhase('player-reveal');
          break;
        case 'player-reveal':
          setPhase('player-strike');
          break;
        case 'player-recover':
          setPhase('enemy-reveal');
          break;
        case 'enemy-reveal':
          setPhase('enemy-strike');
          break;
        default:
          break;
      }
    }, duration);

    return () => window.clearTimeout(timer);
  }, [phase, paused, playerHP, enemyHP, turnIndex, speed, playerStrikeMs]);

  useEffect(() => {
    if (!hasReplay || paused) {
      return undefined;
    }
    if (replayStep >= replayEvents.length - 1) {
      return undefined;
    }
    const duration = 450 / speed;
    const timer = window.setTimeout(() => {
      setReplayStep((step) => Math.min(step + 1, replayEvents.length - 1));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [hasReplay, paused, replayStep, replayEvents.length, speed]);

  useEffect(() => {
    if (!hasReplay) {
      setReplayResultVisible(false);
      return undefined;
    }
    const atEnd = replayStep >= replayEvents.length - 1;
    if (!atEnd) {
      setReplayResultVisible(false);
      return undefined;
    }
    // Hold one beat on the final replay event so lethal strike FX can play
    // before the victory/defeat overlay takes over.
    const timer = window.setTimeout(() => {
      setReplayResultVisible(true);
    }, 320 / speed);
    return () => window.clearTimeout(timer);
  }, [hasReplay, replayEvents.length, replayStep, speed]);

  const replaySnapshot =
    replayStep >= 0
      ? replayEvents[Math.min(replayStep, replayEvents.length - 1)]?.snapshot
      : combatResult?.initialSnapshot;
  const rp = replaySnapshot?.player;
  const re = replaySnapshot?.enemy;
  const activeEvent = replayStep >= 0 ? replayEvents[replayStep] : undefined;
  const prevReplaySnapshot =
    hasReplay && replayStep > 0
      ? replayEvents[Math.max(0, replayStep - 1)]?.snapshot
      : combatResult?.initialSnapshot;
  const replayDone = hasReplay && replayStep >= replayEvents.length - 1;
  const replayPlayerActive = useMemo(() => {
    if (!combatResult) {
      return DECK_SIZE;
    }
    return Math.max(
      5,
      Math.min(
        COMBAT_RULES.queueSize,
        Math.floor(
          replaySnapshot?.playerActiveQueueSlots ??
            combatResult.initialSnapshot.playerActiveQueueSlots ??
            combatResult.finalState.player.activeQueueSlots,
        ),
      ),
    );
  }, [combatResult, replaySnapshot]);
  const replayEnemyActive = useMemo(() => {
    if (!combatResult) {
      return DECK_SIZE;
    }
    return Math.max(
      5,
      Math.min(
        COMBAT_RULES.queueSize,
        Math.floor(
          replaySnapshot?.enemyActiveQueueSlots ??
            combatResult.initialSnapshot.enemyActiveQueueSlots ??
            combatResult.finalState.enemy.activeQueueSlots,
        ),
      ),
    );
  }, [combatResult, replaySnapshot]);
  /** Per replay frame: queue is updated by Factory Reset / transforms; must not freeze on initial snapshot. */
  const replayPlayerQueueRaw = useMemo((): (string | null)[] => {
    const fromSnap = replaySnapshot?.playerQueue;
    if (fromSnap && fromSnap.length > 0) {
      return padQueueToDeckSize(fromSnap);
    }
    if (combatResult?.initialSnapshot.playerQueue) {
      return padQueueToDeckSize(combatResult.initialSnapshot.playerQueue);
    }
    return Array.from({ length: DECK_SIZE }, () => null);
  }, [replaySnapshot?.playerQueue, combatResult?.initialSnapshot.playerQueue]);
  const replayPlayerDeck = useMemo(
    () =>
      replayPlayerQueueRaw.map((id, i) => {
        if (i >= replayPlayerActive) {
          return { ...lockedProgramBattleCard(i), id: `rp-${String(i)}-locked` };
        }
        return {
          ...battleCardFromId(id ?? BLANK_QUEUE_ID, replayContent),
          id: `rp-${String(i)}-${id ?? 'blank'}`,
        };
      }),
    [replayPlayerQueueRaw, replayPlayerActive, replayContent],
  );
  const replayEnemyQueueRaw = useMemo((): (string | null)[] => {
    const fromSnap = replaySnapshot?.enemyQueue;
    if (fromSnap && fromSnap.length > 0) {
      return padQueueToDeckSize(fromSnap);
    }
    if (combatResult?.initialSnapshot.enemyQueue) {
      return padQueueToDeckSize(combatResult.initialSnapshot.enemyQueue);
    }
    if (combatResult?.enemyDeckUsed) {
      return padQueueToDeckSize(combatResult.enemyDeckUsed);
    }
    return Array.from({ length: DECK_SIZE }, () => null);
  }, [replaySnapshot?.enemyQueue, combatResult?.initialSnapshot.enemyQueue, combatResult?.enemyDeckUsed]);
  const replayEnemyDeck = useMemo(
    () =>
      replayEnemyQueueRaw.map((id, i) => {
        if (i >= replayEnemyActive) {
          return {
            ...lockedProgramBattleCard(i),
            id: `re-${String(i)}-locked`,
          };
        }
        return {
          ...battleCardFromId(id ?? BLANK_QUEUE_ID, replayContent),
          id: `re-${String(i)}-${id ?? 'blank'}`,
        };
      }),
    [replayEnemyQueueRaw, replayEnemyActive, replayContent],
  );
  const uiPlayerDeck = hasReplay ? replayPlayerDeck : playerDeck;
  const uiEnemyDeck = hasReplay ? replayEnemyDeck : enemyDeck;
  // Program width for cursor clamp / ROUND readout (live steps are only within this width).
  const uiProgramWidth = hasReplay ? replayPlayerActive : DECK_SIZE;
  const uiEnemyProgramWidth = hasReplay ? replayEnemyActive : DECK_SIZE;
  // Use queue cursors (0-based slot) so highlight matches the fighter that is resolving.
  const uiPlayerTurnIndex = hasReplay
    ? Math.max(0, Math.min(uiProgramWidth - 1, replaySnapshot?.playerQueueCursor ?? 0))
    : turnIndex;
  const uiEnemyTurnIndex = hasReplay
    ? Math.max(0, Math.min(uiEnemyProgramWidth - 1, replaySnapshot?.enemyQueueCursor ?? 0))
    : turnIndex;
  // Real starting HP from the initial combat snapshot (game uses 40, not 50).
  const uiPlayerMaxHp = hasReplay
    ? (combatResult?.initialSnapshot.player.hp ?? PLAYER_MAX_HP)
    : PLAYER_MAX_HP;
  const uiEnemyMaxHp = hasReplay
    ? (combatResult?.initialSnapshot.enemy.hp ?? ENEMY_MAX_HP)
    : ENEMY_MAX_HP;
  const uiPlayerHp = hasReplay ? (replaySnapshot?.player.hp ?? uiPlayerMaxHp) : playerHP;
  const uiEnemyHp = hasReplay ? (replaySnapshot?.enemy.hp ?? uiEnemyMaxHp) : enemyHP;
  const pTurnCard = uiPlayerDeck[uiPlayerTurnIndex];
  const activePlayerCard =
    pTurnCard && !pTurnCard.locked ? pTurnCard : battleCardFromId(BLANK_QUEUE_ID, replayContent);
  const replayPhase: Phase =
    replayDone && combatResult && replayResultVisible
      ? combatResult.playerWon
        ? 'victory'
        : 'defeat'
      : activeEvent?.actor === 'Player'
        ? activeEvent.type === 'resolve'
          ? 'player-strike'
          : 'player-reveal'
        : activeEvent?.actor === 'Enemy'
          ? activeEvent.type === 'resolve'
            ? 'enemy-strike'
            : 'enemy-reveal'
          : 'intro';
  const uiPhase = hasReplay ? replayPhase : phase;

  const eTurnCard = uiEnemyDeck[uiEnemyTurnIndex];
  const activeEnemyCard =
    eTurnCard && !eTurnCard.locked
      ? eTurnCard
      : battleCardFromId(BLANK_QUEUE_ID, replayContent);
  const eventType = activeEvent?.type ?? '';
  const playerStrikeStyle: 'rush' | 'overhead' = pilotId === 'baron_von_boar' ? 'overhead' : 'rush';
  const playerDamageTaken = Math.max(
    0,
    (prevReplaySnapshot?.player.hp ?? uiPlayerHp) - (replaySnapshot?.player.hp ?? uiPlayerHp),
  );
  const enemyDamageTaken = Math.max(
    0,
    (prevReplaySnapshot?.enemy.hp ?? uiEnemyHp) - (replaySnapshot?.enemy.hp ?? uiEnemyHp),
  );
  const eventFlags = {
    stall: eventType === 'stall_skip',
    whiff: eventType === 'whiff' || eventType === 'continuous_skip' || eventType === 'bonus_fizzle',
    fatigueTick: eventType === 'fatigue_tick',
    playerResolve: uiPhase === 'player-strike',
    enemyResolve: uiPhase === 'enemy-strike',
  };
  const playerPoseSet = poseSetForPilot(pilotId, playerMechSrc);
  const enemyPoseSet = ENEMY_MECH_POSES;
  const playerPose: MechPose =
    uiPhase === 'defeat'
      ? 'defeat'
      : uiPhase === 'enemy-strike'
        ? 'hurt'
        : uiPhase === 'player-strike' || uiPhase === 'player-strike-hold'
          ? 'attackContact'
          : uiPhase === 'player-reveal'
            ? 'attackWindup'
            : 'idle';
  const enemyPose: MechPose =
    uiPhase === 'victory'
      ? 'defeat'
      : uiPhase === 'player-strike' || uiPhase === 'player-strike-hold'
        ? 'hurt'
        : uiPhase === 'enemy-strike'
          ? 'attackContact'
          : uiPhase === 'enemy-reveal'
            ? 'attackWindup'
            : 'idle';
  const playerMechSrcResolved = playerPoseSet[playerPose];
  const enemyMechSrcResolved = enemyPoseSet[enemyPose];
  const playerAnimState: MechAnimState =
    playerPose === 'defeat'
      ? 'defeat'
      : playerPose === 'hurt'
        ? 'hurt'
        : uiPhase === 'player-strike-hold'
          ? 'attackHold'
          : playerPose === 'attackWindup' || playerPose === 'attackContact'
            ? 'attack'
            : 'idle';
  const enemyAnimState: MechAnimState =
    enemyPose === 'defeat'
      ? 'defeat'
      : enemyPose === 'hurt'
        ? 'hurt'
        : enemyPose === 'attackWindup' || enemyPose === 'attackContact'
          ? 'attack'
          : 'idle';

  const statusText = useMemo(() => {
    if (hasReplay) {
      if (replayDone && combatResult && replayResultVisible) {
        return combatResult.playerWon ? 'VICTORY — Enemy core offline' : 'DEFEAT — Reactor critical';
      }
      return activeEvent?.text ?? 'BATTLE COMMENCE — replaying simulation';
    }
    switch (phase) {
      case 'intro':
        return `BATTLE COMMENCE — ${playerHudName} has priority`;
      case 'player-reveal':
        return `${playerHudName} reveals ${playerDeck[turnIndex].name}`;
      case 'player-strike':
        return `${playerHudName} strikes — ${ATTACK_DAMAGE} damage`;
      case 'player-strike-hold':
        return `${playerHudName} holds — impact`;
      case 'player-recover':
        return `${playerHudName} resolves`;
      case 'enemy-reveal': {
        const card = enemyDeck[turnIndex];
        return `ARES-01 reveals ${card.name}`;
      }
      case 'enemy-strike':
        return `ARES-01 strikes — ${ATTACK_DAMAGE} damage`;
      case 'enemy-recover':
        return `ARES-01 resolves`;
      case 'victory':
        return 'VICTORY — Enemy core offline';
      case 'defeat':
        return 'DEFEAT — Reactor critical';
      default:
        return '';
    }
  }, [
    hasReplay,
    replayDone,
    replayResultVisible,
    combatResult,
    activeEvent,
    phase,
    turnIndex,
    playerDeck,
    enemyDeck,
    playerHudName,
  ]);

  const analysisSeries = useMemo(() => {
    const empty = { player: [] as BattleAnalysisRoundMetrics[], enemy: [] as BattleAnalysisRoundMetrics[] };
    if (!combatResult) {
      return empty;
    }
    const totalRounds = Math.max(1, combatResult.rounds);
    const initPlayer = combatResult.initialSnapshot.player;
    const initEnemy = combatResult.initialSnapshot.enemy;

    const mkRows = (initial: CombatFighterSnapshot): BattleAnalysisRoundMetrics[] =>
      Array.from({ length: totalRounds }, (_, i) => ({
        round: i + 1,
        energy: initial.charge,
        damage: 0,
        shields: initial.block,
        stalls: 0,
        junk: initial.junk,
      }));

    const playerRows = mkRows(initPlayer);
    const enemyRows = mkRows(initEnemy);

    for (const ev of replayEvents) {
      const r = Math.max(1, Math.min(totalRounds, ev.round));
      const idx = r - 1;
      const pRow = playerRows[idx]!;
      const eRow = enemyRows[idx]!;

      if (ev.snapshot) {
        pRow.energy = ev.snapshot.player.charge;
        pRow.shields = ev.snapshot.player.block;
        pRow.junk = ev.snapshot.player.junk;
        eRow.energy = ev.snapshot.enemy.charge;
        eRow.shields = ev.snapshot.enemy.block;
        eRow.junk = ev.snapshot.enemy.junk;
      }

      if (ev.type === 'resolve') {
        const dealt = parseResolveDamage(ev.text);
        if (ev.actor === 'Player') {
          pRow.damage += dealt;
        } else if (ev.actor === 'Enemy') {
          eRow.damage += dealt;
        }
      }

      if ((ev.type === 'stall' || ev.type === 'stunned_stall') && ev.actor === 'Player') {
        pRow.stalls += 1;
      }
      if ((ev.type === 'stall' || ev.type === 'stunned_stall') && ev.actor === 'Enemy') {
        eRow.stalls += 1;
      }
    }

    return { player: playerRows, enemy: enemyRows };
  }, [combatResult, replayEvents]);

  return (
    <div
      className={`battle-poc battle-poc--scavengers battle-poc--stage-${stage}`}
      role="dialog"
      aria-label="Battle UI preview"
    >
      <PocKnockoutCardFilter />
      {/* SVG chroma-key filters for the mech sprites. Both follow the same
          pipeline:
           1. feColorMatrix knocks out pure-white sprite background while
              keeping black armor intact (mix-blend-mode: multiply can't do
              this without eating dark pixels).
           2. feMorphology dilates the keyed silhouette outward by a few px.
           3. feFlood + feComposite(in) stamps that dilated silhouette in a
              stage-appropriate ink tone.
           4. feMerge lays the keyed mech on top of the outline.
          Variants tuned per stage:
           - bp-knockout-alley: soft dusk outline vs the alley plate.
           - bp-knockout-neon: thick near-black outline vs the neon plaza.
           - bp-knockout-market: warm dust-brown outline vs high-noon dirt.
          Filter box is enlarged so the outline renders past source bounds. */}
      <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
        <defs>
          <filter
            id="bp-knockout-alley"
            colorInterpolationFilters="sRGB"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
              result="keyed"
            />
            <feMorphology in="keyed" operator="dilate" radius="2.2" result="dilated" />
            <feFlood floodColor="#2a2228" result="ink" />
            <feComposite in="ink" in2="dilated" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="keyed" />
            </feMerge>
          </filter>
          <filter
            id="bp-knockout-neon"
            colorInterpolationFilters="sRGB"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
              result="keyed"
            />
            <feMorphology in="keyed" operator="dilate" radius="2.5" result="dilated" />
            <feFlood floodColor="#070709" result="ink" />
            <feComposite in="ink" in2="dilated" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="keyed" />
            </feMerge>
          </filter>
          <filter
            id="bp-knockout-market"
            colorInterpolationFilters="sRGB"
            x="-10%"
            y="-10%"
            width="120%"
            height="120%"
          >
            <feColorMatrix
              type="matrix"
              values="1 0 0 0 0
                      0 1 0 0 0
                      0 0 1 0 0
                      -1 -1 -1 2.2 0"
              result="keyed"
            />
            <feMorphology in="keyed" operator="dilate" radius="1.6" result="dilated" />
            <feFlood floodColor="#3d2e26" result="ink" />
            <feComposite in="ink" in2="dilated" operator="in" result="outline" />
            <feMerge>
              <feMergeNode in="outline" />
              <feMergeNode in="keyed" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div className="battle-poc__bg" />
      <div className="battle-poc__scrim" />

      {/* Enemy deck: top strip — topbar chrome is baked in as topChrome */}
      <BattlePocDeckStrip
        cards={uiEnemyDeck}
        activeIndex={uiEnemyTurnIndex}
        expandChips={isEnemyPhase(uiPhase) && (uiPhase === 'enemy-reveal' || uiPhase === 'enemy-strike')}
        side="enemy"
        programWidth={uiEnemyProgramWidth}
        topChrome={
          <header className="battle-poc__topbar">
            <div className="battle-poc__topbar-brand">
              <span className="battle-poc__topbar-mark">◆</span>
              <span className="battle-poc__topbar-title">COMBAT · ACT I · RUN 001</span>
            </div>
            <div className="battle-poc__topbar-turn">
              ROUND <strong>{uiPlayerTurnIndex + 1}</strong> / {uiProgramWidth}
            </div>
            <div className="battle-poc__topbar-controls">
              <StageControl value={stage} onChange={setStage} />
              <SpeedControl value={speed} onChange={handleSpeedChange} />
              <button
                type="button"
                className="battle-poc__ctrl"
                onClick={() => {
                  setPaused((p) => !p);
                }}
              >
                {paused ? '▶ PLAY' : '❚❚ PAUSE'}
              </button>
              <button type="button" className="battle-poc__ctrl" onClick={resetBattle}>
                ↻ RESTART
              </button>
              {onRunEncounter ? (
                <button type="button" className="battle-poc__ctrl" onClick={onRunEncounter}>
                  ⟳ RUN NEW
                </button>
              ) : null}
              <button type="button" className="battle-poc__ctrl battle-poc__ctrl--exit" onClick={onExit}>
                ✕ EXIT
              </button>
            </div>
          </header>
        }
      />

      <main className="battle-poc__stage">
        {hasReplay && replaySnapshot?.fatigueArmed ? (
          <div
            className="battle-poc__fatigue-panel"
            role="status"
            aria-live="polite"
            title="Thermal runaway: each stack tick deals escalating damage to both fighters."
          >
            <span className="battle-poc__fatigue-panel-label">FATIGUE</span>
            <span className="battle-poc__fatigue-panel-stack" aria-label="Fatigue stacks">
              {String(replaySnapshot.fatigueRoundsElapsed ?? 0)}
            </span>
          </div>
        ) : null}
        {stage === 'market' ? <div className="battle-poc__ground" aria-hidden /> : null}
        {/* Pilot HUDs overlay the stage corners */}
        <BattlePocPilotHUD
          side="left"
          name={playerHudName}
          subtitle="SCAVENGER · AWAKENING 1"
          portrait={playerPortrait}
          hp={uiPlayerHp}
          maxHp={uiPlayerMaxHp}
          active={isPlayerPhase(uiPhase)}
          taking={uiPhase === 'enemy-strike'}
          theme="ally"
          energy={hasReplay && rp ? rp.charge : undefined}
          energyCap={BATTLE_POC_ENERGY_BAR_CAP}
          shield={hasReplay && rp ? rp.block : undefined}
          shieldCap={BATTLE_POC_SHIELD_BAR_CAP}
          shurikenStacks={hasReplay && rp ? (rp.shuriken ?? 0) : undefined}
        />
        <div className="battle-poc__vs">
          <span>VS</span>
        </div>
        <BattlePocPilotHUD
          side="right"
          name="ARES-01"
          subtitle="CORPORATE · AEGIS STRIKE"
          portrait="/poc/poc-pilot-enemy.png"
          hp={uiEnemyHp}
          maxHp={uiEnemyMaxHp}
          active={isEnemyPhase(uiPhase)}
          taking={uiPhase === 'player-strike' || uiPhase === 'player-strike-hold'}
          theme="enemy"
          energy={hasReplay && re ? re.charge : undefined}
          energyCap={BATTLE_POC_ENERGY_BAR_CAP}
          shield={hasReplay && re ? re.block : undefined}
          shieldCap={BATTLE_POC_SHIELD_BAR_CAP}
        />

        {/* Mechs — independently positioned sprites on top of shared bg */}
        <div
          className={[
            'battle-poc__mech',
            'battle-poc__mech--player',
            `battle-poc__mech--${uiPhase}`,
            `battle-poc__mech--pose-${playerPose}`,
            `battle-poc__mech--attack-${playerStrikeStyle}`,
            uiPhase === 'enemy-strike' ? 'battle-poc__mech--hurt' : '',
          ].join(' ')}
        >
          {hasReplay && rp ? (
            <AuraChipRow variant="buff" chips={buffChipsFromSnapshot(rp)} a11y="Player buffs" />
          ) : null}
          <MechSprite
            src={playerMechSrcResolved}
            alt={pilot ? `${pilot.name}'s mech` : 'Player mech'}
            animState={playerAnimState}
          />
          {hasReplay && rp ? (
            <AuraChipRow variant="debuff" chips={debuffChipsFromSnapshot(rp)} a11y="Player debuffs" />
          ) : null}
        </div>
        <div
          className={[
            'battle-poc__mech',
            'battle-poc__mech--enemy',
            `battle-poc__mech--${uiPhase}`,
            `battle-poc__mech--pose-${enemyPose}`,
            uiPhase === 'player-strike' || uiPhase === 'player-strike-hold'
              ? 'battle-poc__mech--hurt'
              : '',
          ].join(' ')}
        >
          {hasReplay && re ? (
            <AuraChipRow variant="buff" chips={buffChipsFromSnapshot(re)} a11y="Enemy buffs" />
          ) : null}
          <MechSprite src={enemyMechSrcResolved} alt="Enemy mech" animState={enemyAnimState} />
          {hasReplay && re ? (
            <AuraChipRow variant="debuff" chips={debuffChipsFromSnapshot(re)} a11y="Enemy debuffs" />
          ) : null}
        </div>

        {/* Active card is no longer a floating panel — the relevant chip in
            each DeckStrip expands in-place into a full card during its own
            reveal/strike phases. See DeckStrip + .battle-poc__chip--expanded. */}

        {/* FX overlays */}
        {uiPhase === 'player-strike' ? (
          <DamagePop side="right" amount={hasReplay ? Math.max(enemyDamageTaken, 0) || (activePlayerCard.atk ?? ATTACK_DAMAGE) : ATTACK_DAMAGE} />
        ) : null}
        {uiPhase === 'enemy-strike' ? (
          <DamagePop side="left" amount={hasReplay ? Math.max(playerDamageTaken, 0) || (activeEnemyCard.atk ?? ATTACK_DAMAGE) : ATTACK_DAMAGE} />
        ) : null}

        {eventFlags.playerResolve && playerStrikeStyle === 'rush' ? <SpeedLines direction="rightward" /> : null}
        {eventFlags.playerResolve && playerStrikeStyle === 'overhead' ? <GroundSlam side="right" /> : null}
        {eventFlags.enemyResolve ? <MuzzleFlash side="right" /> : null}
        {eventFlags.enemyResolve ? <TracerBolt direction="leftward" /> : null}
        {eventFlags.playerResolve ? <ImpactSpark side="right" /> : null}
        {eventFlags.enemyResolve ? <ImpactSpark side="left" /> : null}
        {eventFlags.stall ? <SystemLock actor={activeEvent?.actor} /> : null}
        {eventFlags.whiff ? <WhiffBanner /> : null}
        {eventFlags.fatigueTick ? <FatiguePulse /> : null}
        {(rp?.block ?? 0) > 0 ? <ShieldAura side="left" /> : null}
        {(re?.block ?? 0) > 0 ? <ShieldAura side="right" /> : null}
      </main>

      {/* Player deck: bottom strip — statusbar chrome is baked in as bottomChrome */}
      <BattlePocDeckStrip
        cards={uiPlayerDeck}
        activeIndex={uiPlayerTurnIndex}
        expandChips={
          isPlayerPhase(uiPhase) &&
          (uiPhase === 'player-reveal' ||
            uiPhase === 'player-strike' ||
            uiPhase === 'player-strike-hold')
        }
        side="player"
        programWidth={uiProgramWidth}
        bottomChrome={
          <footer className="battle-poc__statusbar">
            <div className="battle-poc__status-marker" />
            <div className="battle-poc__status-text">{statusText}</div>
            <div className="battle-poc__status-hint">
              {hasReplay
                ? `REPLAY · event ${String(replayStep + 1)} / ${String(replayEvents.length)}`
                : 'POC · auto-plays · both decks: 9× Basic Attack'}
            </div>
          </footer>
        }
      />

      {uiPhase === 'victory' ? (
        <ResultBanner
          kind="victory"
          onAgain={resetBattle}
          onContinue={onContinue}
          onOpenAnalysis={hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {uiPhase === 'defeat' ? (
        <ResultBanner
          kind="defeat"
          pilotFirstName={pilot?.name ?? 'Pilot'}
          onAgain={resetBattle}
          onRetryHpDown={onRetryHpDown}
          onRetryRerolls={onRetryRerolls}
          onOpenAnalysis={hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {analysisOpen ? (
        <BattleAnalysisModal
          selected={analysisSide}
          onSelect={setAnalysisSide}
          onClose={() => setAnalysisOpen(false)}
          playerSeries={analysisSeries.player}
          enemySeries={analysisSeries.enemy}
        />
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mech aura chips (replay)                                                    */
/* -------------------------------------------------------------------------- */

function AuraChipRow({
  variant,
  chips,
  a11y,
}: {
  variant: 'buff' | 'debuff';
  chips: { key: string; label: string }[];
  a11y: string;
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <div
      className={`battle-poc__aura-row battle-poc__aura-row--${variant}`}
      aria-label={a11y}
    >
      {chips.map((c) => (
        <span key={`${variant}-${c.key}`} className="battle-poc__aura-chip">
          {c.label}
        </span>
      ))}
    </div>
  );
}

type MechAnimState = 'idle' | 'attack' | 'attackHold' | 'hurt' | 'defeat';

function MechSprite({
  src,
  alt,
  animState,
}: {
  src: string;
  alt: string;
  animState: MechAnimState;
}) {
  const strip = MECH_SPRITE_SHEETS[src];
  if (!strip) {
    const imgAnim = animState === 'attackHold' ? 'attack' : animState;
    return (
      <img className={`battle-poc__mech-sprite battle-poc__mech-sprite--${imgAnim}`} src={src} alt={alt} />
    );
  }

  // (N - 1) / fps because the strip runs with steps(N, jump-none) — N stops
  // distributed evenly across the duration with N-1 transitions.
  const transitions = Math.max(1, strip.frameCount - 1);
  const durationMs = Math.max(120, Math.round((transitions / Math.max(strip.fps, 1)) * 1000));
  const styleVars: CSSProperties & Record<string, string | number> = {
    backgroundImage: `url(${src})`,
    ['--bp-sheet-frames' as string]: strip.frameCount,
    ['--bp-sheet-dur' as string]: `${String(durationMs)}ms`,
  };
  if (strip.frameAspect) {
    styleVars['--bp-frame-aspect'] = String(strip.frameAspect);
  }
  const stripModifier =
    animState === 'attackHold' ? 'attack-hold' : animState === 'attack' ? 'attack' : animState;
  return (
    <div
      role="img"
      aria-label={alt}
      data-aspect-fit={strip.frameAspect ? 'true' : undefined}
      className={`battle-poc__mech-sprite-strip battle-poc__mech-sprite-strip--${stripModifier}`}
      style={styleVars}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* FX: floating damage number + tracer bolt                                    */
/* -------------------------------------------------------------------------- */

function DamagePop({ side, amount }: { side: 'left' | 'right'; amount: number }) {
  return (
    <div className={`battle-poc__dmg battle-poc__dmg--${side}`}>
      -{amount}
      <span className="battle-poc__dmg-label">HP</span>
    </div>
  );
}

function TracerBolt({ direction }: { direction: 'leftward' | 'rightward' }) {
  return <div className={`battle-poc__tracer battle-poc__tracer--${direction}`} />;
}

function MuzzleFlash({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__muzzle battle-poc__muzzle--${side}`} />;
}

function ImpactSpark({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__impact battle-poc__impact--${side}`} />;
}

function SpeedLines({ direction }: { direction: 'leftward' | 'rightward' }) {
  return <div className={`battle-poc__speed-lines battle-poc__speed-lines--${direction}`} />;
}

function GroundSlam({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__ground-slam battle-poc__ground-slam--${side}`} />;
}

function ShieldAura({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__shield-aura battle-poc__shield-aura--${side}`} />;
}

function SystemLock({ actor }: { actor?: string }) {
  const side = actor === 'Enemy' ? 'enemy' : 'player';
  const label = actor === 'Enemy' ? 'ENEMY SYSTEM LOCK' : 'SYSTEM LOCK';
  return (
    <div className={`battle-poc__system-lock battle-poc__system-lock--${side}`}>
      <span>{label}</span>
    </div>
  );
}

function WhiffBanner() {
  return (
    <div className="battle-poc__whiff-banner">
      <span>WHIFF</span>
    </div>
  );
}

function FatiguePulse() {
  return <div className="battle-poc__fatigue-pulse" aria-hidden />;
}

/* -------------------------------------------------------------------------- */
/* Result banner                                                               */
/* -------------------------------------------------------------------------- */

function ResultBanner({
  kind,
  pilotFirstName = 'Pilot',
  onAgain,
  onContinue,
  onRetryHpDown,
  onRetryRerolls,
  onOpenAnalysis,
}: {
  kind: 'victory' | 'defeat';
  pilotFirstName?: string;
  onAgain: () => void;
  onContinue?: () => void;
  onRetryHpDown?: () => void;
  onRetryRerolls?: () => void;
  onOpenAnalysis?: () => void;
}) {
  return (
    <div className={`battle-poc__result battle-poc__result--${kind}`}>
      <div className="battle-poc__result-inner">
        <div className="battle-poc__result-eyebrow">ENGAGEMENT COMPLETE</div>
        <div className="battle-poc__result-title">{kind === 'victory' ? 'VICTORY' : 'DEFEAT'}</div>
        <div className="battle-poc__result-sub">
          {kind === 'victory'
            ? 'ARES-01 neutralized'
            : `${pilotFirstName} is down — reroute emergency power`}
        </div>

        {kind === 'victory' && onContinue ? (
          <button type="button" className="battle-poc__result-btn battle-poc__result-btn--primary" onClick={onContinue}>
            COLLECT REWARDS →
          </button>
        ) : null}

        {kind === 'defeat' && (onRetryHpDown ?? onRetryRerolls) ? (
          <div className="battle-poc__result-retry-group">
            <div className="battle-poc__result-retry-label">CHOOSE ASSIST TO RETURN TO FORGE</div>
            {onRetryHpDown ? (
              <button
                type="button"
                className="battle-poc__result-btn battle-poc__result-btn--assist"
                onClick={onRetryHpDown}
              >
                ↓ −10% ENEMY HP
              </button>
            ) : null}
            {onRetryRerolls ? (
              <button
                type="button"
                className="battle-poc__result-btn battle-poc__result-btn--assist"
                onClick={onRetryRerolls}
              >
                ⟳ +3 FREE REROLLS
              </button>
            ) : null}
          </div>
        ) : null}

        {onOpenAnalysis ? (
          <button type="button" className="battle-poc__result-btn battle-poc__result-btn--analyze" onClick={onOpenAnalysis}>
            ANALYZE BATTLE
          </button>
        ) : null}

        <button type="button" className="battle-poc__result-btn battle-poc__result-btn--secondary" onClick={onAgain}>
          ↻ REPLAY ENGAGEMENT
        </button>
      </div>
    </div>
  );
}

