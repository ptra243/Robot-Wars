import '../App.css';
import { PhaserDeckBuilder } from './PhaserDeckBuilder';
import { BattlePOC } from './poc/BattlePOC';
import { TravelView } from './TravelView';
import { RetryAssistView } from './RetryAssistView';
import { RewardView } from './RewardView';
import { ForgePOC } from './poc/ForgePOC';
import { DeckCycleReportModal } from './DeckCycleReportModal';
import { PilotSelectView } from './PilotSelectView';
import { DraftView } from './DraftView';
import { TravelOverlay } from './TravelOverlay';
import { RunHudBar } from './RunHudBar';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { useBattlePlayback } from '../hooks/useBattlePlayback';
import { cloneRun } from '../core/run';
import { useGameStore } from '../stores/gameStore';

export function GameApp() {
  useBattlePlayback();

  const run = useGameStore((s) => s.run);
  const appPhase = useGameStore((s) => s.appPhase);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const deckCycleReport = useGameStore((s) => s.deckCycleReport);
  const playback = useGameStore((s) => s.playback);
  const lastResult = useGameStore((s) => s.lastResult);
  const setRun = useGameStore((s) => s.setRun);
  const handleReset = useGameStore((s) => s.handleReset);
  const handleSimulateDeckCycle = useGameStore((s) => s.handleSimulateDeckCycle);
  const handleSeedStep = useGameStore((s) => s.handleSeedStep);
  const dismissDeckCycleReport = useGameStore((s) => s.dismissDeckCycleReport);
  const handleBackToTravel = useGameStore((s) => s.handleBackToTravel);
  const handleDeployFromForge = useGameStore((s) => s.handleDeployFromForge);
  const handleGoToReward = useGameStore((s) => s.handleGoToReward);
  const handleChooseRetryAssist = useGameStore((s) => s.handleChooseRetryAssist);
  const travelModal = useGameStore((s) => s.travelModal);

  const content = useRunCardContent(run.seed);
  const combatResult = playback ?? lastResult ?? null;
  const resultKey = combatResult
    ? `${String(combatResult.events.length)}-${String(combatResult.finalState.player.hp)}-${String(combatResult.finalState.enemy.hp)}`
    : 'none';

  return (
    <main className="app-shell app-shell--fullscreen">
      {appPhase !== 'pilot_select' ? <RunHudBar /> : null}
      <div className="game-viewport">
        <div className={`arena-panel ${appPhase === 'battle' ? 'arena-panel--battle' : 'arena-panel--deck'}`}>
          {appPhase === 'pilot_select' ? (
            <PilotSelectView />
          ) : appPhase === 'draft' ? (
            <DraftView />
          ) : appPhase === 'travel' ? (
            <TravelView />
          ) : appPhase === 'retry' ? (
            <RetryAssistView />
          ) : appPhase === 'reward' ? (
            <RewardView />
          ) : appPhase === 'forge' ? (
            <ForgePOC
              content={content}
              forgeSeed={run.seed}
              faction={run.faction}
              awakening={run.loop.awakening}
              rerolls={run.loop.rerolls}
              pilotId={run.spirit.id}
              playerHp={run.loop.playerHp}
              playerHpMax={run.loop.playerHpMax}
              activeTraitIds={run.loop.playerTraitIds}
              initialHand={run.hand}
              initialQueue={run.plannedQueue}
              onRunDeploy={(queueIds, handCardIds) => {
                handleDeployFromForge(queueIds, handCardIds);
              }}
              onRerollsChange={(delta) => {
                setRun((prev) => ({
                  ...prev,
                  loop: { ...prev.loop, rerolls: Math.max(0, prev.loop.rerolls + delta) },
                }));
              }}
              onScrapHandCard={(cardId) => {
                setRun((prev) => {
                  const next = cloneRun(prev);
                  const hi = next.hand.indexOf(cardId);
                  if (hi >= 0) next.hand.splice(hi, 1);
                  const di = next.deck.indexOf(cardId);
                  if (di >= 0) next.deck.splice(di, 1);
                  next.loop.gold += 50;
                  next.loop.rerolls += 1;
                  return next;
                });
              }}
              onExit={handleBackToTravel}
            />
          ) : appPhase === 'deck' ? (
            <PhaserDeckBuilder
              run={run}
              setRun={setRun}
              content={content}
              onFullReset={() => handleReset()}
              onStartBattle={handleBackToTravel}
              onSimulateDeckCycle={handleSimulateDeckCycle}
              onSeedStep={handleSeedStep}
            />
          ) : (
            <BattlePOC
              key={resultKey}
              combatResult={combatResult}
              seed={run.seed}
              pilotId={run.spirit.id}
              replaySpeed={run.loop.battleReplaySpeed}
              onReplaySpeedChange={(s) => {
                setRun((prev) => {
                  const next = cloneRun(prev);
                  next.loop.battleReplaySpeed = s;
                  return next;
                });
              }}
              onExit={handleBackToTravel}
              onContinue={combatResult?.playerWon ? handleGoToReward : undefined}
              onRetryHpDown={
                combatResult && !combatResult.playerWon && run.loop.hearts > 0 && run.loop.retryAvailable
                  ? () => handleChooseRetryAssist('enemy_hp_down')
                  : undefined
              }
              onRetryRerolls={
                combatResult && !combatResult.playerWon && run.loop.hearts > 0 && run.loop.retryAvailable
                  ? () => handleChooseRetryAssist('free_rerolls')
                  : undefined
              }
            />
          )}
        </div>
      </div>
      {deckCycleReport ? (
        <DeckCycleReportModal report={deckCycleReport} onClose={dismissDeckCycleReport} />
      ) : null}
      {appPhase === 'travel' && travelModal ? <TravelOverlay /> : null}
      {appPhase !== 'battle' ? (
        <p className="app-status-bar" role="status">
          {statusMessage}
        </p>
      ) : null}
    </main>
  );
}
