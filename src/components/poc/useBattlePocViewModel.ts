import { useMemo } from 'react';
import type { CardContentService } from '../../core/content';
import { COMBAT_RULES } from '../../core/rules';
import type { CombatResult } from '../../core/types';
import { battleCardFromId, DECK_SIZE, ATTACK_DAMAGE, type BattleCard } from './battlePocCardModel';
import { buildBattleAnalysisSeries } from './battlePocAnalysis';
import {
  BLANK_QUEUE_ID,
  ENEMY_MECH_POSES,
  ENEMY_MAX_HP,
  PLAYER_MAX_HP,
  type MechPose,
  type Phase,
} from './battlePocConstants';
import {
  deckCardsFromReplayQueue,
  padQueueToDeckSize,
  poseSetForPilot,
} from './battlePocHelpers';
import type { MechAnimState } from './BattlePocFx';

export interface BattlePocViewModel {
  hasReplay: boolean;
  replayEvents: NonNullable<CombatResult['events']>;
  replaySnapshot: CombatResult['initialSnapshot'] | undefined;
  rp: CombatResult['initialSnapshot']['player'] | undefined;
  re: CombatResult['initialSnapshot']['enemy'] | undefined;
  activeEvent: CombatResult['events'][number] | undefined;
  prevReplaySnapshot: CombatResult['initialSnapshot'] | undefined;
  replayDone: boolean;
  uiPlayerDeck: BattleCard[];
  uiEnemyDeck: BattleCard[];
  uiProgramWidth: number;
  uiEnemyProgramWidth: number;
  uiPlayerTurnIndex: number;
  uiEnemyTurnIndex: number;
  uiPlayerMaxHp: number;
  uiEnemyMaxHp: number;
  uiPlayerHp: number;
  uiEnemyHp: number;
  uiPhase: Phase;
  activePlayerCard: BattleCard;
  activeEnemyCard: BattleCard;
  playerDamageTaken: number;
  enemyDamageTaken: number;
  eventFlags: {
    stall: boolean;
    whiff: boolean;
    fatigueTick: boolean;
    factoryReset: boolean;
    playerResolve: boolean;
    enemyResolve: boolean;
  };
  /** When set, the named program chip plays the Factory Reset rip/explode FX. */
  factoryResetFx: { side: 'player' | 'enemy'; slotIndex: number; cardId: string } | null;
  playerStrikeStyle: 'rush' | 'overhead';
  playerPose: MechPose;
  enemyPose: MechPose;
  playerMechSrcResolved: string;
  enemyMechSrcResolved: string;
  playerAnimState: MechAnimState;
  enemyAnimState: MechAnimState;
  playerAttackAnimKey: string;
  enemyAttackAnimKey: string;
  statusText: string;
  analysisSeries: ReturnType<typeof buildBattleAnalysisSeries>;
}

export function useBattlePocViewModel(input: {
  combatResult: CombatResult | null | undefined;
  replayContent: CardContentService;
  replayStep: number;
  replayResultVisible: boolean;
  pilotId: string;
  playerMechSrc: string;
  playerHudName: string;
  turnIndex: number;
  playerHP: number;
  enemyHP: number;
  phase: Phase;
  playerDeck: BattleCard[];
  enemyDeck: BattleCard[];
}): BattlePocViewModel {
  const {
    combatResult,
    replayContent,
    replayStep,
    replayResultVisible,
    pilotId,
    playerMechSrc,
    playerHudName,
    turnIndex,
    playerHP,
    enemyHP,
    phase,
    playerDeck,
    enemyDeck,
  } = input;

  const replayEvents = combatResult?.events ?? [];
  const hasReplay = replayEvents.length > 0;

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

  const factoryResetFx = useMemo(() => {
    if (!hasReplay || activeEvent?.type !== 'factory_reset' || !activeEvent.cardId) {
      return null;
    }
    const side: 'player' | 'enemy' = activeEvent.actor === 'Enemy' ? 'enemy' : 'player';
    const slotIndex =
      side === 'enemy'
        ? Math.max(0, Math.min(replayEnemyActive - 1, replaySnapshot?.enemyQueueCursor ?? 0))
        : Math.max(0, Math.min(replayPlayerActive - 1, replaySnapshot?.playerQueueCursor ?? 0));
    return { side, slotIndex, cardId: activeEvent.cardId };
  }, [
    hasReplay,
    activeEvent,
    replayPlayerActive,
    replayEnemyActive,
    replaySnapshot?.playerQueueCursor,
    replaySnapshot?.enemyQueueCursor,
  ]);

  const replayPlayerDeck = useMemo(() => {
    const deck = deckCardsFromReplayQueue(replayPlayerQueueRaw, replayPlayerActive, replayContent, 'rp');
    if (factoryResetFx?.side === 'player') {
      const destroyed = battleCardFromId(factoryResetFx.cardId, replayContent);
      deck[factoryResetFx.slotIndex] = {
        ...destroyed,
        id: `rp-${String(factoryResetFx.slotIndex)}-${factoryResetFx.cardId}-reset`,
      };
    }
    return deck;
  }, [replayPlayerQueueRaw, replayPlayerActive, replayContent, factoryResetFx]);

  const replayEnemyDeck = useMemo(() => {
    const deck = deckCardsFromReplayQueue(replayEnemyQueueRaw, replayEnemyActive, replayContent, 're');
    if (factoryResetFx?.side === 'enemy') {
      const destroyed = battleCardFromId(factoryResetFx.cardId, replayContent);
      deck[factoryResetFx.slotIndex] = {
        ...destroyed,
        id: `re-${String(factoryResetFx.slotIndex)}-${factoryResetFx.cardId}-reset`,
      };
    }
    return deck;
  }, [replayEnemyQueueRaw, replayEnemyActive, replayContent, factoryResetFx]);

  const uiPlayerDeck = hasReplay ? replayPlayerDeck : playerDeck;
  const uiEnemyDeck = hasReplay ? replayEnemyDeck : enemyDeck;
  const uiProgramWidth = hasReplay ? replayPlayerActive : DECK_SIZE;
  const uiEnemyProgramWidth = hasReplay ? replayEnemyActive : DECK_SIZE;
  const uiPlayerTurnIndex = hasReplay
    ? Math.max(0, Math.min(uiProgramWidth - 1, replaySnapshot?.playerQueueCursor ?? 0))
    : turnIndex;
  const uiEnemyTurnIndex = hasReplay
    ? Math.max(0, Math.min(uiEnemyProgramWidth - 1, replaySnapshot?.enemyQueueCursor ?? 0))
    : turnIndex;
  const uiPlayerMaxHp = hasReplay
    ? Math.max(
        combatResult?.initialSnapshot.player.maxHp ?? 0,
        combatResult?.initialSnapshot.player.hp ?? 0,
        combatResult?.finalState.player.hp ?? 0,
        replaySnapshot?.player.hp ?? 0,
        PLAYER_MAX_HP,
      )
    : PLAYER_MAX_HP;
  const uiEnemyMaxHp = hasReplay
    ? Math.max(
        combatResult?.initialSnapshot.enemy.maxHp ?? 0,
        combatResult?.initialSnapshot.enemy.hp ?? 0,
        combatResult?.finalState.enemy.hp ?? 0,
        replaySnapshot?.enemy.hp ?? 0,
        ENEMY_MAX_HP,
      )
    : ENEMY_MAX_HP;
  const uiPlayerHp = hasReplay ? (replaySnapshot?.player.hp ?? uiPlayerMaxHp) : playerHP;
  const uiEnemyHp = hasReplay ? (replaySnapshot?.enemy.hp ?? uiEnemyMaxHp) : enemyHP;

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

  const pTurnCard = uiPlayerDeck[uiPlayerTurnIndex];
  const activePlayerCard =
    pTurnCard && !pTurnCard.locked ? pTurnCard : battleCardFromId(BLANK_QUEUE_ID, replayContent);
  const eTurnCard = uiEnemyDeck[uiEnemyTurnIndex];
  const activeEnemyCard =
    eTurnCard && !eTurnCard.locked
      ? eTurnCard
      : battleCardFromId(BLANK_QUEUE_ID, replayContent);

  const playerDamageTaken = Math.max(
    0,
    (prevReplaySnapshot?.player.hp ?? uiPlayerHp) - (replaySnapshot?.player.hp ?? uiPlayerHp),
  );
  const enemyDamageTaken = Math.max(
    0,
    (prevReplaySnapshot?.enemy.hp ?? uiEnemyHp) - (replaySnapshot?.enemy.hp ?? uiEnemyHp),
  );

  const eventType = activeEvent?.type ?? '';
  const eventFlags = {
    stall: eventType === 'stall_skip',
    whiff:
      eventType === 'whiff' ||
      eventType === 'continuous_skip' ||
      eventType === 'persistent_skip' ||
      eventType === 'bonus_fizzle',
    fatigueTick: eventType === 'fatigue_tick',
    factoryReset: eventType === 'factory_reset',
    playerResolve: uiPhase === 'player-strike',
    enemyResolve: uiPhase === 'enemy-strike',
  };

  const playerStrikeStyle: 'rush' | 'overhead' = pilotId === 'baron_von_boar' ? 'overhead' : 'rush';
  const playerPoseSet = poseSetForPilot(pilotId, playerMechSrc);
  const enemyPoseSet = ENEMY_MECH_POSES;

  const playerPose =
    uiPhase === 'defeat'
      ? 'defeat'
      : uiPhase === 'enemy-strike'
        ? 'hurt'
        : uiPhase === 'player-strike' || uiPhase === 'player-strike-hold'
          ? 'attackContact'
          : uiPhase === 'player-reveal'
            ? 'attackWindup'
            : 'idle';
  const enemyPose =
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

  /* Windup keeps frame 0 (idle). Only contact plays the strip once — starting the
   * strip during reveal made it finish mid-lunge and read as a stuttery restart. */
  const playerAnimState: MechAnimState =
    playerPose === 'defeat'
      ? 'defeat'
      : playerPose === 'hurt'
        ? 'hurt'
        : uiPhase === 'player-strike-hold'
          ? 'attackHold'
          : playerPose === 'attackContact'
            ? 'attack'
            : 'idle';
  const enemyAnimState: MechAnimState =
    enemyPose === 'defeat'
      ? 'defeat'
      : enemyPose === 'hurt'
        ? 'hurt'
        : enemyPose === 'attackContact'
          ? 'attack'
          : 'idle';
  /** Remount key so each strike restarts the CSS strip from frame 0. */
  const playerAttackAnimKey =
    playerAnimState === 'attack' || playerAnimState === 'attackHold'
      ? `p-atk-${String(uiPlayerTurnIndex)}-${String(hasReplay ? (activeEvent?.round ?? 0) : turnIndex)}`
      : 'p-idle';
  const enemyAttackAnimKey =
    enemyAnimState === 'attack'
      ? `e-atk-${String(uiEnemyTurnIndex)}-${String(hasReplay ? (activeEvent?.round ?? 0) : turnIndex)}`
      : 'e-idle';

  const statusText = useMemo(() => {
    if (hasReplay) {
      if (replayDone && combatResult && replayResultVisible) {
        return combatResult.playerWon ? 'VICTORY — Enemy core offline' : 'DEFEAT — Reactor critical';
      }
      if (activeEvent?.type === 'factory_reset') {
        return 'FACTORY RESET — program card destroyed';
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

  const analysisSeries = useMemo(() => buildBattleAnalysisSeries(combatResult), [combatResult]);

  return {
    hasReplay,
    replayEvents,
    replaySnapshot,
    rp,
    re,
    activeEvent,
    prevReplaySnapshot,
    replayDone,
    uiPlayerDeck,
    uiEnemyDeck,
    uiProgramWidth,
    uiEnemyProgramWidth,
    uiPlayerTurnIndex,
    uiEnemyTurnIndex,
    uiPlayerMaxHp,
    uiEnemyMaxHp,
    uiPlayerHp,
    uiEnemyHp,
    uiPhase,
    activePlayerCard,
    activeEnemyCard,
    playerDamageTaken,
    enemyDamageTaken,
    eventFlags,
    factoryResetFx,
    playerStrikeStyle,
    playerPose,
    enemyPose,
    playerMechSrcResolved,
    enemyMechSrcResolved,
    playerAnimState,
    enemyAnimState,
    playerAttackAnimKey,
    enemyAttackAnimKey,
    statusText,
    analysisSeries,
  };
}
