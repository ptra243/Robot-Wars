import { useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import { publicUrl } from '../../assetUrl';
import { CardContentService } from '../../core/content';
import { getPilotById, getPilotMechSpriteUrl, getPilotPortraitUrl } from '../../core/pilots';
import { BattleAnalysisModal } from '../poc/forge/BattleAnalysisModal';
import { PocKnockoutCardFilter } from '../poc/PocKnockoutCardFilter';
import { type BattlePocSpeed as Speed, type BattlePocStage as Stage } from '../poc/BattlePocControls';
import { BattlePocStatusbar, BattlePocTopbar } from '../poc/BattlePocChrome';
import { BattlePocPilotHUD, BATTLE_POC_ENERGY_BAR_CAP, BATTLE_POC_SHIELD_BAR_CAP } from '../poc/BattlePocPilotHUD';
import { BattlePOC } from '../poc/BattlePOC';
import { ENEMY_MAX_HP, ENEMY_MECH_POSES, PLAYER_MAX_HP } from '../poc/battlePocConstants';
import { isEnemyPhase, isPlayerPhase, makeDeck, poseSetForPilot } from '../poc/battlePocHelpers';
import { BattlePocKnockoutSvg } from '../poc/BattlePocKnockoutSvg';
import { BattlePocResultBanner } from '../poc/BattlePocResultBanner';
import { useBattlePocViewModel } from '../poc/useBattlePocViewModel';
import { CardHoverPopover as ForgeCardHoverPopover } from '../poc/forge/CardHoverPopover';
import { forgeCardFromDef } from '../poc/forge/forgeCardModel';
import type { HoverState as ForgeHoverState } from '../poc/forge/types';
import {
  advanceScripted,
  beltActorForStep,
  buildBattleVisualSteps,
  phaseForScript,
  scriptedVisualStep,
  type ScriptBeat,
} from '../../ui/phaserBattle/battleVisualStep';
import { CartridgeBelt } from './CartridgeBelt';
import { PhaserBattlefield } from './PhaserBattlefield';
import '../poc/battle-poc.css';
import './phaser-battle.css';

type BattlePhaserProps = ComponentProps<typeof BattlePOC>;

export function BattlePhaser({
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
}: BattlePhaserProps) {
  const pilot = getPilotById(pilotId);
  const playerPoses = poseSetForPilot(pilotId, getPilotMechSpriteUrl(pilotId));
  const playerPortrait = getPilotPortraitUrl(pilotId);
  const playerHudName = (pilot?.name ?? 'Glint').toUpperCase();
  const replayContent = useMemo(() => CardContentService.loadDefault(seed), [seed]);
  const replayEvents = useMemo(() => combatResult?.events ?? [], [combatResult]);
  const hasReplay = replayEvents.length > 0;
  const playerDeck = useMemo(() => makeDeck('p'), []);
  const enemyDeck = useMemo(() => makeDeck('e'), []);

  const steps = useMemo(() => {
    if (!hasReplay || !combatResult) return null;
    return buildBattleVisualSteps({
      events: combatResult.events,
      initial: combatResult.initialSnapshot,
      playerWon: combatResult.playerWon,
      pilotId,
    });
  }, [combatResult, hasReplay, pilotId]);

  const [cursor, setCursor] = useState(0);
  const [script, setScript] = useState<{
    beat: ScriptBeat;
    turn: number;
    playerHp: number;
    enemyHp: number;
  }>({ beat: 'intro', turn: 0, playerHp: PLAYER_MAX_HP, enemyHp: ENEMY_MAX_HP });
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<Speed>(replaySpeed ?? 1);
  const [stage, setStage] = useState<Stage>('market');
  const [sceneReady, setSceneReady] = useState(false);
  const [playNonce, setPlayNonce] = useState(0);
  const [restartTick, setRestartTick] = useState(0);
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
  const playingId = useRef<string | null>(null);
  const scrubPlay = useRef(false);
  const pendingAdvance = useRef(false);
  const lastArmed = useRef<string | null>(null);
  const pauseRef = useRef(paused);
  pauseRef.current = paused;

  const step = useMemo(() => {
    if (hasReplay && steps) {
      return steps[Math.max(0, Math.min(cursor, steps.length - 1))]!;
    }
    return scriptedVisualStep(script.beat, script.turn, pilotId);
  }, [cursor, hasReplay, pilotId, script.beat, script.turn, steps]);

  const vm = useBattlePocViewModel({
    combatResult,
    replayContent,
    replayStep: hasReplay ? step.eventIndex : -1,
    replayResultVisible: hasReplay && (step.kind === 'victory' || step.kind === 'defeat'),
    pilotId,
    playerMechSrc: playerPoses.idle,
    playerHudName,
    turnIndex: script.turn,
    playerHP: script.playerHp,
    enemyHP: script.enemyHp,
    phase: hasReplay ? 'intro' : phaseForScript(script.beat),
    playerDeck,
    enemyDeck,
  });

  const turnStartSteps = useMemo(() => {
    if (!steps) return [] as number[];
    const byRound = new Map<number, number>();
    steps.forEach((visual, idx) => {
      if (visual.eventIndex < 0) return;
      const event = replayEvents[visual.eventIndex];
      const round = event?.snapshot?.roundIndex ?? event?.round ?? 0;
      if (!byRound.has(round)) byRound.set(round, idx);
    });
    return [...byRound.entries()].sort((a, b) => a[0] - b[0]).map(([, idx]) => idx);
  }, [replayEvents, steps]);

  const activeTurnIndex = useMemo(() => {
    if (turnStartSteps.length === 0) return 0;
    let current = 0;
    for (let i = 0; i < turnStartSteps.length; i += 1) {
      if (turnStartSteps[i]! <= cursor) current = i;
      else break;
    }
    return current;
  }, [cursor, turnStartSteps]);

  useEffect(() => {
    if (replaySpeed !== undefined) setSpeed(replaySpeed);
  }, [replaySpeed]);

  useEffect(() => {
    if (!hasReplay) setReplayOptionsOpen(false);
  }, [hasReplay]);

  const advance = () => {
    if (hasReplay) {
      setCursor((current) => {
        const last = (steps?.length ?? 1) - 1;
        return Math.min(current + 1, last);
      });
      return;
    }
    setScript((prev) => advanceScripted(prev));
  };

  useEffect(() => {
    if (!sceneReady) return;
    const force = scrubPlay.current;
    scrubPlay.current = false;
    if (paused && !force) return;
    if (!force && lastArmed.current === step.id) return;
    lastArmed.current = step.id;
    playingId.current = step.id;
    setPlayNonce((n) => n + 1);
  }, [paused, restartTick, sceneReady, step.id]);

  useEffect(() => {
    if (paused || !pendingAdvance.current) return;
    pendingAdvance.current = false;
    advance();
    // advance closes over the latest replay/script flags via setState updaters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  const handleStepComplete = (id: string) => {
    if (id !== playingId.current) return;
    playingId.current = null;
    if (pauseRef.current) {
      pendingAdvance.current = true;
      return;
    }
    advance();
  };

  const armFromStart = () => {
    pendingAdvance.current = false;
    playingId.current = null;
    lastArmed.current = null;
    scrubPlay.current = true;
  };

  const resetBattle = () => {
    armFromStart();
    setPaused(false);
    setCursor(0);
    setScript({ beat: 'intro', turn: 0, playerHp: PLAYER_MAX_HP, enemyHp: ENEMY_MAX_HP });
    setRestartTick((tick) => tick + 1);
    setCardHover(null);
  };

  const scrubToTurnStart = (turnIndex: number) => {
    if (turnStartSteps.length === 0) return;
    const clamped = Math.max(0, Math.min(turnStartSteps.length - 1, turnIndex));
    armFromStart();
    setPaused(true);
    setCursor(turnStartSteps[clamped] ?? 0);
    setRestartTick((tick) => tick + 1);
  };

  const skipBattleReplay = () => {
    if (!hasReplay || !steps || step.kind === 'victory' || step.kind === 'defeat') return;
    armFromStart();
    setPaused(true);
    setCursor(steps.length - 1);
    setRestartTick((tick) => tick + 1);
    onSkipBattle?.();
  };

  const handleSpeedChange = (next: Speed) => {
    setSpeed(next);
    onReplaySpeedChange?.(next);
  };

  const showHover = (cardId: string, ev: { clientX: number; clientY: number }) => {
    if (!hasReplay) return;
    const catalogId = /^(?:rp|re)-\d+-(.+)$/.exec(cardId)?.[1] ?? cardId;
    try {
      setCardHover({
        card: forgeCardFromDef(replayContent.get(catalogId)),
        x: ev.clientX,
        y: ev.clientY,
        clientX: ev.clientX,
        clientY: ev.clientY,
      });
    } catch {
      setCardHover(null);
    }
  };

  const slotActor = beltActorForStep(step);
  const resultKind = step.kind === 'victory' || step.kind === 'defeat' ? step.kind : null;

  return (
    <div
      className={`battle-poc battle-poc--phaser battle-poc--scavengers battle-poc--stage-${stage}`}
      role="dialog"
      aria-label="Phaser battle"
    >
      <PocKnockoutCardFilter />
      <BattlePocKnockoutSvg />
      <div className="battle-poc__bg" />
      <div className="battle-poc__scrim" />

      <CartridgeBelt
        cards={vm.uiEnemyDeck}
        activeIndex={vm.uiEnemyTurnIndex}
        slotting={slotActor === 'enemy'}
        side="enemy"
        programWidth={vm.uiEnemyProgramWidth}
        factoryResetSlotIndex={vm.factoryResetFx?.side === 'enemy' ? vm.factoryResetFx.slotIndex : null}
        onCardHover={(card, ev) => showHover(card.id, ev)}
        onCardLeave={() => setCardHover(null)}
        topChrome={
          <BattlePocTopbar
            round={vm.uiPlayerTurnIndex + 1}
            programWidth={vm.uiProgramWidth}
            stage={stage}
            speed={speed}
            paused={paused}
            onStageChange={setStage}
            onSpeedChange={handleSpeedChange}
            onTogglePaused={() => setPaused((value) => !value)}
            onRestart={resetBattle}
            onRunEncounter={onRunEncounter}
            onExit={onExit}
            hasReplay={hasReplay}
            skipBattleDisabled={resultKind != null}
            onSkipBattle={skipBattleReplay}
          />
        }
      />

      <main className="battle-poc__stage battle-poc__stage--phaser">
        {vm.hasReplay && vm.replaySnapshot?.fatigueArmed ? (
          <div className="battle-poc__fatigue-panel" role="status">
            <span className="battle-poc__fatigue-panel-label">FATIGUE</span>
            <span className="battle-poc__fatigue-panel-stack">
              {String(vm.replaySnapshot.fatigueRoundsElapsed ?? 0)}
            </span>
          </div>
        ) : null}
        {stage === 'market' ? <div className="battle-poc__ground" aria-hidden /> : null}
        <PhaserBattlefield
          playerSrc={playerPoses.attackContact}
          enemySrc={ENEMY_MECH_POSES.idle}
          speed={speed}
          paused={paused}
          onReady={() => setSceneReady(true)}
          onStepComplete={handleStepComplete}
          playStep={sceneReady ? step : null}
          playNonce={playNonce}
        />
        <BattlePocPilotHUD
          side="left"
          name={playerHudName}
          subtitle="SCAVENGER · AWAKENING 1"
          portrait={playerPortrait}
          hp={vm.uiPlayerHp}
          maxHp={vm.uiPlayerMaxHp}
          active={isPlayerPhase(vm.uiPhase)}
          taking={slotActor === 'enemy' && step.kind === 'strike'}
          theme="ally"
          energy={vm.hasReplay && vm.rp ? vm.rp.charge : undefined}
          energyCap={BATTLE_POC_ENERGY_BAR_CAP}
          shield={vm.hasReplay && vm.rp ? vm.rp.block : undefined}
          shieldCap={BATTLE_POC_SHIELD_BAR_CAP}
          shurikenStacks={vm.hasReplay && vm.rp ? (vm.rp.shuriken ?? 0) : undefined}
        />
        <div className="battle-poc__vs">
          <span>VS</span>
        </div>
        <BattlePocPilotHUD
          side="right"
          name="ARES-01"
          subtitle="CORPORATE · AEGIS STRIKE"
          portrait={publicUrl('/poc/poc-pilot-enemy.png')}
          hp={vm.uiEnemyHp}
          maxHp={vm.uiEnemyMaxHp}
          active={isEnemyPhase(vm.uiPhase)}
          taking={slotActor === 'player' && step.kind === 'strike'}
          theme="enemy"
          energy={vm.hasReplay && vm.re ? vm.re.charge : undefined}
          energyCap={BATTLE_POC_ENERGY_BAR_CAP}
          shield={vm.hasReplay && vm.re ? vm.re.block : undefined}
          shieldCap={BATTLE_POC_SHIELD_BAR_CAP}
        />
      </main>

      <CartridgeBelt
        cards={vm.uiPlayerDeck}
        activeIndex={vm.uiPlayerTurnIndex}
        slotting={slotActor === 'player'}
        side="player"
        programWidth={vm.uiProgramWidth}
        primeTraitIds={playerTraitIds}
        faction={faction}
        factoryResetSlotIndex={vm.factoryResetFx?.side === 'player' ? vm.factoryResetFx.slotIndex : null}
        onCardHover={(card, ev) => showHover(card.id, ev)}
        onCardLeave={() => setCardHover(null)}
        bottomChrome={
          <BattlePocStatusbar
            statusText={vm.statusText}
            hasReplay={vm.hasReplay}
            replayStep={hasReplay ? step.eventIndex : script.turn}
            replayEventsLength={vm.replayEvents.length}
          />
        }
      />

      {resultKind === 'victory' ? (
        <BattlePocResultBanner
          kind="victory"
          onAgain={resetBattle}
          onContinue={onContinue}
          onOpenAnalysis={vm.hasReplay ? () => setAnalysisOpen(true) : undefined}
        />
      ) : null}
      {resultKind === 'defeat' ? (
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
          onClick={() => setReplayOptionsOpen((open) => !open)}
        >
          Replay options
        </button>
      ) : null}
      {hasReplay && replayOptionsOpen ? (
        <div className="battle-poc__replay-panel" style={{ left: replayPanelPos.x, top: replayPanelPos.y }}>
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
              const drag = dragRef.current;
              if (!drag || drag.id !== e.pointerId) return;
              setReplayPanelPos({
                x: Math.max(8, drag.originX + (e.clientX - drag.startX)),
                y: Math.max(56, drag.originY + (e.clientY - drag.startY)),
              });
            }}
            onPointerUp={(e) => {
              if (dragRef.current?.id === e.pointerId) dragRef.current = null;
              (e.currentTarget as HTMLDivElement).releasePointerCapture(e.pointerId);
            }}
          >
            <span>Replay options</span>
            <button type="button" className="battle-poc__replay-panel-close" onClick={() => setReplayOptionsOpen(false)}>
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
                {replayEvents.map((event, idx) => (
                  <button
                    key={`${event.type}-${String(idx)}`}
                    type="button"
                    className={`battle-poc__replay-log-item${step.eventIndex === idx ? ' is-active' : ''}`}
                    onClick={() => {
                      const visualIndex = steps?.findIndex((visual) => visual.eventIndex === idx) ?? -1;
                      if (visualIndex < 0) return;
                      armFromStart();
                      setPaused(true);
                      setCursor(visualIndex);
                      setRestartTick((tick) => tick + 1);
                    }}
                  >
                    <span className="battle-poc__replay-log-idx">{idx + 1}</span>
                    <span className="battle-poc__replay-log-text">{event.text}</span>
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
