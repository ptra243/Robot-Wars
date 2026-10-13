import '../App.css';
import { useEffect } from 'react';
import { PhaserDeckBuilder } from './PhaserDeckBuilder';
import { BattlePOC } from '../features/battle/BattlePOC';
import { DeckCycleReportModal } from './DeckCycleReportModal';
import { useRunCardContent } from '../hooks/useRunCardContent';
import { useBattlePlayback } from '../hooks/useBattlePlayback';
import { useGameStore } from '../stores/gameStore';

export function BattleSimulationApp() {
  const run = useGameStore((s) => s.run);
  const appPhase = useGameStore((s) => s.appPhase);
  const statusMessage = useGameStore((s) => s.statusMessage);
  const deckCycleReport = useGameStore((s) => s.deckCycleReport);
  const playback = useGameStore((s) => s.playback);
  const lastResult = useGameStore((s) => s.lastResult);
  const handleSetBattleReplaySpeed = useGameStore((s) => s.handleSetBattleReplaySpeed);
  const handleSkipBattleReplay = useGameStore((s) => s.handleSkipBattleReplay);
  const handleReset = useGameStore((s) => s.handleReset);
  const handleStartBattleFromDeck = useGameStore((s) => s.handleStartBattleFromDeck);
  const handleSimulateEncounter = useGameStore((s) => s.handleSimulateEncounter);
  const handleSimulateDeckCycle = useGameStore((s) => s.handleSimulateDeckCycle);
  const handleSeedStep = useGameStore((s) => s.handleSeedStep);
  const dismissDeckCycleReport = useGameStore((s) => s.dismissDeckCycleReport);
  const handleOpenDeckBuilder = useGameStore((s) => s.handleOpenDeckBuilder);

  const content = useRunCardContent(run.seed);
  useEffect(() => {
    handleOpenDeckBuilder();
  }, [handleOpenDeckBuilder]);

  const isBattle = appPhase === 'battle';
  useBattlePlayback();
  const combatResult = playback ?? lastResult ?? null;

  // Key resets BattlePOC (remounts) whenever a new encounter result arrives.
  const resultKey = combatResult
    ? `${String(combatResult.events.length)}-${String(combatResult.finalState.player.hp)}-${String(combatResult.finalState.enemy.hp)}`
    : 'none';

  return (
    <main className="app-shell app-shell--fullscreen">
      <div className="game-viewport">
        <div className={`arena-panel ${isBattle ? 'arena-panel--battle' : 'arena-panel--deck'}`}>
          {isBattle ? (
            <BattlePOC
              key={resultKey}
              combatResult={combatResult}
              seed={run.seed}
              pilotId={run.spirit.id}
              replaySpeed={run.loop.battleReplaySpeed}
              onReplaySpeedChange={(s) => {
                handleSetBattleReplaySpeed(s);
              }}
              onSkipBattle={handleSkipBattleReplay}
              onExit={handleOpenDeckBuilder}
              onRunEncounter={handleSimulateEncounter}
            />
          ) : (
            <PhaserDeckBuilder
              run={run}
              content={content}
              onFullReset={() => handleReset()}
              onStartBattle={handleStartBattleFromDeck}
              onSimulateDeckCycle={handleSimulateDeckCycle}
              onSeedStep={handleSeedStep}
            />
          )}
        </div>
      </div>
      {deckCycleReport ? (
        <DeckCycleReportModal report={deckCycleReport} onClose={dismissDeckCycleReport} />
      ) : null}
      {!isBattle ? (
        <p className="app-status-bar" role="status">
          {statusMessage}
        </p>
      ) : null}
    </main>
  );
}

