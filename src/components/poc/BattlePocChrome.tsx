import type { ReactElement } from 'react';
import {
  type BattlePocSpeed as Speed,
  type BattlePocStage as Stage,
  SkipBattleControl,
  SpeedControl,
  StageControl,
} from './BattlePocControls';

export function BattlePocTopbar({
  round,
  programWidth,
  stage,
  speed,
  paused,
  onStageChange,
  onSpeedChange,
  onTogglePaused,
  onRestart,
  onRunEncounter,
  onExit,
  hasReplay,
  skipBattleDisabled,
  onSkipBattle,
}: {
  round: number;
  programWidth: number;
  stage: Stage;
  speed: Speed;
  paused: boolean;
  onStageChange: (s: Stage) => void;
  onSpeedChange: (s: Speed) => void;
  onTogglePaused: () => void;
  onRestart: () => void;
  onRunEncounter?: () => void;
  onExit: () => void;
  hasReplay?: boolean;
  skipBattleDisabled?: boolean;
  onSkipBattle?: () => void;
}): ReactElement {
  return (
    <header className="battle-poc__topbar">
      <div className="battle-poc__topbar-brand">
        <span className="battle-poc__topbar-mark">◆</span>
        <span className="battle-poc__topbar-title">COMBAT · ACT I · RUN 001</span>
      </div>
      <div className="battle-poc__topbar-turn">
        ROUND <strong>{round}</strong> / {programWidth}
      </div>
      <div className="battle-poc__topbar-controls">
        <StageControl value={stage} onChange={onStageChange} />
        <SpeedControl value={speed} onChange={onSpeedChange} />
        {hasReplay && onSkipBattle ? (
          <SkipBattleControl disabled={skipBattleDisabled} onSkip={onSkipBattle} />
        ) : null}
        <button type="button" className="battle-poc__ctrl" onClick={onTogglePaused}>
          {paused ? '▶ PLAY' : '❚❚ PAUSE'}
        </button>
        <button type="button" className="battle-poc__ctrl" onClick={onRestart}>
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
  );
}

export function BattlePocStatusbar({
  statusText,
  hasReplay,
  replayStep,
  replayEventsLength,
}: {
  statusText: string;
  hasReplay: boolean;
  replayStep: number;
  replayEventsLength: number;
}): ReactElement {
  return (
    <footer className="battle-poc__statusbar">
      <div className="battle-poc__status-marker" />
      <div className="battle-poc__status-text">{statusText}</div>
      <div className="battle-poc__status-hint">
        {hasReplay
          ? `REPLAY · event ${String(replayStep + 1)} / ${String(replayEventsLength)}`
          : 'POC · auto-plays · both decks: 9× Basic Attack'}
      </div>
    </footer>
  );
}
