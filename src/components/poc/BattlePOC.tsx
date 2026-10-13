import { useEffect, useMemo, useRef, useState } from 'react';
import { CardContentService } from '../../core/content';
import { getPilotById, getPilotMechSpriteUrl, getPilotPortraitUrl } from '../../core/pilots';
import type { CombatResult } from '../../core/types';
import { BattleAnalysisModal } from './forge/BattleAnalysisModal';
import { PocKnockoutCardFilter } from './PocKnockoutCardFilter';
import { type BattlePocSpeed as Speed, type BattlePocStage as Stage } from './BattlePocControls';
import { BattlePocStatusbar, BattlePocTopbar } from './BattlePocChrome';
import { BattlePocDeckStrip } from './BattlePocDeckStrip';
import { BattlePocArena } from './BattlePocArena';
import { DECK_SIZE, ATTACK_DAMAGE } from './battlePocCardModel';
import {
  ENEMY_MAX_HP,
  PHASE_DURATIONS,
  PLAYER_MAX_HP,
  type Phase,
} from './battlePocConstants';
import {
  isEnemyPhase,
  isPlayerPhase,
  makeDeck,
  playerStrikePhaseMsForPilot,
  playerStrikeTotalMsForPilot,
} from './battlePocHelpers';
import { BattlePocKnockoutSvg } from './BattlePocKnockoutSvg';
import { BattlePocResultBanner } from './BattlePocResultBanner';
import { useBattlePocViewModel } from './useBattlePocViewModel';
import { CardHoverPopover as ForgeCardHoverPopover } from './forge/CardHoverPopover';
import { forgeCardFromDef } from './forge/forgeCardModel';
import type { HoverState as ForgeHoverState } from './forge/types';
import './battle-poc.css';

interface BattlePOCProps {
  onExit: () => void;
  combatResult?: CombatResult | null;
  seed?: number;
  pilotId?: string;
  onRunEncounter?: () => void;
  onContinue?: () => void;
  onRetryHpDown?: () => void;
  onRetryRerolls?: () => void;
  onStartNewRun?: () => void;
  replaySpeed?: Speed;
  onReplaySpeedChange?: (s: Speed) => void;
  onSkipBattle?: () => void;
  /** Pilot + relic traits for Prime slot markers on the player program. */
  playerTraitIds?: readonly string[];
  /** Run faction — Prime markers only for clockwork. */
  faction?: string;
}

export function BattlePOC({
  onExit,
  combatResult,
  seed = 1,
  onRunEncounter,
  onContinue,
  onRetryHpDown,
  onRetryRerolls,
  onStartNewRun,
  pilotId = 'glint',
  replaySpeed,
  onReplaySpeedChange,
  onSkipBattle,
  playerTraitIds = [],
  faction,
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
  const [replayOptionsOpen, setReplayOptionsOpen] = useState(false);
  const [replayPanelPos, setReplayPanelPos] = useState({ x: 26, y: 92 });
  const [replayLogOpen, setReplayLogOpen] = useState(true);
  const [cardHover, setCardHover] = useState<ForgeHoverState | null>(null);
  const dragRef = useRef<{
    id: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const playerStrikeMs = useMemo(() => playerStrikePhaseMsForPilot(pilotId), [pilotId]);
  const playerStrikeTotalMs = useMemo(() => playerStrikeTotalMsForPilot(pilotId), [pilotId]);

  const vm = useBattlePocViewModel({
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
  });

  useEffect(() => {
    if (replaySpeed !== undefined) {
      setSpeed(replaySpeed);
    }
  }, [replaySpeed]);

  const handleSpeedChange = (s: Speed) => {
    setSpeed(s);
    onReplaySpeedChange?.(s);
  };

  const skipBattleReplay = () => {
    if (!hasReplay || replayResultVisible) {
      return;
    }
    setReplayStep(Math.max(0, replayEvents.length - 1));
    setReplayResultVisible(true);
    setPaused(true);
    onSkipBattle?.();
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
    setCardHover(null);
  };

  const turnStartSteps = useMemo(() => {
    if (!hasReplay) return [] as number[];
    const byRound = new Map<number, number>();
    replayEvents.forEach((ev, idx) => {
      const round = ev.snapshot?.roundIndex ?? ev.round ?? 0;
      if (!byRound.has(round)) {
        byRound.set(round, idx);
      }
    });
    return [...byRound.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, idx]) => idx);
  }, [hasReplay, replayEvents]);

  const activeTurnIndex = useMemo(() => {
    if (turnStartSteps.length === 0) return 0;
    if (replayStep < 0) return 0;
    let current = 0;
    for (let i = 0; i < turnStartSteps.length; i += 1) {
      if (turnStartSteps[i]! <= replayStep) current = i;
      else break;
    }
    return current;
  }, [turnStartSteps, replayStep]);

  const scrubToTurnStart = (turnIndex: number) => {
    if (turnStartSteps.length === 0) return;
    const clamped = Math.max(0, Math.min(turnStartSteps.length - 1, turnIndex));
    const step = turnStartSteps[clamped] ?? 0;
    setReplayStep(step);
    setPaused(true);
    setReplayResultVisible(false);
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
  }, [phase, paused, playerHP, enemyHP, turnIndex, speed, playerStrikeMs, hasReplay]);

  useEffect(() => {
    if (!hasReplay || paused) {
      return undefined;
    }
    if (replayStep >= replayEvents.length - 1) {
      return undefined;
    }
    const ev = replayStep >= 0 ? replayEvents[replayStep] : undefined;
    const isPlayerResolve = ev?.type === 'resolve' && ev.actor === 'Player';
    const isFactoryReset = ev?.type === 'factory_reset';
    /* Dwell exactly for the punch strip + impact hold budget (time-bounded).
     * Factory Reset gets its own beat so the rip/explode chip FX can read. */
    const duration =
      (isPlayerResolve ? playerStrikeTotalMs : isFactoryReset ? 900 : 450) / speed;
    const timer = window.setTimeout(() => {
      setReplayStep((step) => Math.min(step + 1, replayEvents.length - 1));
    }, duration);
    return () => window.clearTimeout(timer);
  }, [hasReplay, paused, replayStep, replayEvents, speed, playerStrikeTotalMs]);

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
    const timer = window.setTimeout(() => {
      setReplayResultVisible(true);
    }, 320 / speed);
    return () => window.clearTimeout(timer);
  }, [hasReplay, replayEvents.length, replayStep, speed]);

  useEffect(() => {
    if (!hasReplay) {
      setReplayOptionsOpen(false);
    }
  }, [hasReplay]);

  return (
    <div
      className={`battle-poc battle-poc--scavengers battle-poc--stage-${stage}`}
      role="dialog"
      aria-label="Battle UI preview"
    >
      <PocKnockoutCardFilter />
      <BattlePocKnockoutSvg />

      <div className="battle-poc__bg" />
      <div className="battle-poc__scrim" />

      <BattlePocDeckStrip
        cards={vm.uiEnemyDeck}
        activeIndex={vm.uiEnemyTurnIndex}
        expandChips={isEnemyPhase(vm.uiPhase) && (vm.uiPhase === 'enemy-reveal' || vm.uiPhase === 'enemy-strike')}
        side="enemy"
        programWidth={vm.uiEnemyProgramWidth}
        primeTraitIds={[]}
        factoryResetSlotIndex={
          vm.factoryResetFx?.side === 'enemy' ? vm.factoryResetFx.slotIndex : null
        }
        onCardHover={(card, ev) => {
          if (!hasReplay) return;
          try {
            setCardHover({
              card: forgeCardFromDef(replayContent.get(card.id)),
              x: ev.clientX,
              y: ev.clientY,
              clientX: ev.clientX,
              clientY: ev.clientY,
            });
          } catch {
            setCardHover(null);
          }
        }}
        onCardLeave={() => {
          setCardHover(null);
        }}
        topChrome={
          <BattlePocTopbar
            round={vm.uiPlayerTurnIndex + 1}
            programWidth={vm.uiProgramWidth}
            stage={stage}
            speed={speed}
            paused={paused}
            onStageChange={setStage}
            onSpeedChange={handleSpeedChange}
            onTogglePaused={() => {
              setPaused((p) => !p);
            }}
            onRestart={resetBattle}
            onRunEncounter={onRunEncounter}
            onExit={onExit}
            hasReplay={hasReplay}
            skipBattleDisabled={replayResultVisible}
            onSkipBattle={skipBattleReplay}
          />
        }
      />

      <BattlePocArena
        vm={vm}
        stage={stage}
        playerHudName={playerHudName}
        playerPortrait={playerPortrait}
        pilotNameForAlt={pilot?.name}
      />

      <BattlePocDeckStrip
        cards={vm.uiPlayerDeck}
        activeIndex={vm.uiPlayerTurnIndex}
        expandChips={
          isPlayerPhase(vm.uiPhase) &&
          (vm.uiPhase === 'player-reveal' ||
            vm.uiPhase === 'player-strike' ||
            vm.uiPhase === 'player-strike-hold')
        }
        side="player"
        programWidth={vm.uiProgramWidth}
        primeTraitIds={playerTraitIds}
        faction={faction}
        factoryResetSlotIndex={
          vm.factoryResetFx?.side === 'player' ? vm.factoryResetFx.slotIndex : null
        }
        onCardHover={(card, ev) => {
          if (!hasReplay) return;
          try {
            setCardHover({
              card: forgeCardFromDef(replayContent.get(card.id)),
              x: ev.clientX,
              y: ev.clientY,
              clientX: ev.clientX,
              clientY: ev.clientY,
            });
          } catch {
            setCardHover(null);
          }
        }}
        onCardLeave={() => {
          setCardHover(null);
        }}
        bottomChrome={
          <BattlePocStatusbar
            statusText={vm.statusText}
            hasReplay={vm.hasReplay}
            replayStep={replayStep}
            replayEventsLength={vm.replayEvents.length}
          />
        }
      />

      {vm.uiPhase === 'victory' ? (
        <BattlePocResultBanner
          kind="victory"
          onAgain={resetBattle}
          onContinue={onContinue}
          onOpenAnalysis={vm.hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {vm.uiPhase === 'defeat' ? (
        <BattlePocResultBanner
          kind="defeat"
          pilotFirstName={pilot?.name ?? 'Pilot'}
          onAgain={resetBattle}
          onRetryHpDown={onRetryHpDown}
          onRetryRerolls={onRetryRerolls}
          onStartNewRun={onStartNewRun}
          onOpenAnalysis={vm.hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {analysisOpen ? (
        <BattleAnalysisModal
          selected={analysisSide}
          onSelect={setAnalysisSide}
          onClose={() => setAnalysisOpen(false)}
          playerSeries={vm.analysisSeries.player}
          enemySeries={vm.analysisSeries.enemy}
          playerInitial={vm.analysisSeries.playerInitial}
          enemyInitial={vm.analysisSeries.enemyInitial}
          playerCardContributions={vm.analysisSeries.playerCardContributions}
          enemyCardContributions={vm.analysisSeries.enemyCardContributions}
          playerStatCategories={vm.analysisSeries.playerStatCategories}
          enemyStatCategories={vm.analysisSeries.enemyStatCategories}
          content={replayContent}
        />
      ) : null}
      {hasReplay ? (
        <button
          type="button"
          className="battle-poc__replay-options-fab"
          onClick={() => setReplayOptionsOpen((v) => !v)}
        >
          Replay options
        </button>
      ) : null}
      {hasReplay && replayOptionsOpen ? (
        <div
          className="battle-poc__replay-panel"
          style={{ left: replayPanelPos.x, top: replayPanelPos.y }}
        >
          <div
            className="battle-poc__replay-panel-head"
            onPointerDown={(e) => {
              dragRef.current = {
                id: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                originX: replayPanelPos.x,
                originY: replayPanelPos.y,
              };
              (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
            }}
            onPointerMove={(e) => {
              const d = dragRef.current;
              if (!d || d.id !== e.pointerId) return;
              setReplayPanelPos({
                x: Math.max(8, d.originX + (e.clientX - d.startX)),
                y: Math.max(56, d.originY + (e.clientY - d.startY)),
              });
            }}
            onPointerUp={(e) => {
              if (dragRef.current?.id === e.pointerId) dragRef.current = null;
              (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            }}
          >
            <span>Replay options</span>
            <button
              type="button"
              className="battle-poc__replay-panel-close"
              onClick={() => setReplayOptionsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="battle-poc__replay-panel-body">
            <label className="battle-poc__replay-scrub-label">
              Turn start: {activeTurnIndex + 1}/{Math.max(1, turnStartSteps.length)}
            </label>
            <input
              type="range"
              className="battle-poc__replay-scrubber"
              min={0}
              max={Math.max(0, turnStartSteps.length - 1)}
              value={Math.max(0, Math.min(activeTurnIndex, Math.max(0, turnStartSteps.length - 1)))}
              onChange={(e) => scrubToTurnStart(Number(e.target.value))}
            />
            <details
              className="battle-poc__replay-log"
              open={replayLogOpen}
              onToggle={(e) => setReplayLogOpen((e.currentTarget as HTMLDetailsElement).open)}
            >
              <summary>Replay log ({replayEvents.length})</summary>
              <div className="battle-poc__replay-log-list">
                {replayEvents.map((ev, idx) => (
                  <button
                    key={`${ev.type}-${idx}`}
                    type="button"
                    className={`battle-poc__replay-log-item${idx === replayStep ? ' is-active' : ''}`}
                    onClick={() => {
                      setReplayStep(idx);
                      setPaused(true);
                      setReplayResultVisible(false);
                    }}
                  >
                    <span className="battle-poc__replay-log-idx">{idx + 1}</span>
                    <span className="battle-poc__replay-log-text">{ev.text}</span>
                  </button>
                ))}
              </div>
            </details>
          </div>
        </div>
      ) : null}
      {cardHover ? <ForgeCardHoverPopover hover={cardHover} zIndex={1300} /> : null}
    </div>
  );
}
