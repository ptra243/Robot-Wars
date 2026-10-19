import '../App.css';
import { PhaserDeckBuilder } from './PhaserDeckBuilder';
import { BattleView } from './phaser-battle/BattleView';
import { TravelView } from './TravelView';
import { RetryAssistView } from './RetryAssistView';
import { RewardView } from './RewardView';
import { ForgePOC } from '../features/forge/ForgePOC';
import { DeckCycleReportModal } from './DeckCycleReportModal';
import { PilotSelectView } from './PilotSelectView';
import { DraftView } from './DraftView';
import { TravelOverlay } from './TravelOverlay';
import { RunHudBar } from './RunHudBar';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { useBattlePlayback } from '../hooks/useBattlePlayback';
import { useGameStore } from '../stores/gameStore';
import { resolvePlayerCombatTraitIds } from '../core/run';

export function GameApp() {
  const appPhase = useGameStore((s) => s.appPhase);
  useBattlePlayback();

  const run = useGameStore((s) => s.run);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const deckCycleReport = useGameStore((s) => s.deckCycleReport);
  const playback = useGameStore((s) => s.playback);
  const lastResult = useGameStore((s) => s.lastResult);
  const handleReset = useGameStore((s) => s.handleReset);
  const handleSimulateDeckCycle = useGameStore((s) => s.handleSimulateDeckCycle);
  const handleSeedStep = useGameStore((s) => s.handleSeedStep);
  const dismissDeckCycleReport = useGameStore((s) => s.dismissDeckCycleReport);
  const handleBackToTravel = useGameStore((s) => s.handleBackToTravel);
  const handleDeployFromForge = useGameStore((s) => s.handleDeployFromForge);
  const handleGoToReward = useGameStore((s) => s.handleGoToReward);
  const handleChooseRetryAssist = useGameStore((s) => s.handleChooseRetryAssist);
  const handleAdjustRerolls = useGameStore((s) => s.handleAdjustRerolls);
  const handleScrapHandCard = useGameStore((s) => s.handleScrapHandCard);
  const handleSetBattleReplaySpeed = useGameStore((s) => s.handleSetBattleReplaySpeed);
  const handleSkipBattleReplay = useGameStore((s) => s.handleSkipBattleReplay);
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
              playerHp={run.loop.playerHpMax}
              playerHpMax={run.loop.playerHpMax}
              activeTraitIds={resolvePlayerCombatTraitIds(run)}
              activeQueueSlots={run.sandboxActiveQueueSlots}
              initialHand={run.hand}
              initialQueue={run.plannedQueue}
              initialEnemyQueue={run.enemyPlannedQueue}
              initialEnemyDeck={run.combatEnemyFatigueDeck ?? undefined}
              onRunDeploy={(queueIds, handCardIds) => {
                handleDeployFromForge(queueIds, handCardIds);
              }}
              onRerollsChange={(delta) => {
                handleAdjustRerolls(delta);
              }}
              onScrapHandCard={(cardId) => {
                handleScrapHandCard(cardId);
              }}
              onExit={handleBackToTravel}
            />
          ) : appPhase === 'deck' ? (
            <PhaserDeckBuilder
              run={run}
              content={content}
              onFullReset={() => handleReset()}
              onStartBattle={handleBackToTravel}
              onSimulateDeckCycle={handleSimulateDeckCycle}
              onSeedStep={handleSeedStep}
            />
          ) : (
            <BattleView
              key={resultKey}
              combatResult={combatResult}
              seed={run.seed}
              pilotId={run.spirit.id}
              replaySpeed={run.loop.battleReplaySpeed}
              onReplaySpeedChange={(s) => {
                handleSetBattleReplaySpeed(s);
              }}
              onSkipBattle={handleSkipBattleReplay}
              playerTraitIds={resolvePlayerCombatTraitIds(run)}
              faction={run.faction}
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
              onStartNewRun={combatResult && !combatResult.playerWon && run.loop.hearts <= 0 ? handleReset : undefined}
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
