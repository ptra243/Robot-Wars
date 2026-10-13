export function BattlePocResultBanner({
  kind,
  pilotFirstName = 'Pilot',
  onAgain,
  onContinue,
  onRetryHpDown,
  onRetryRerolls,
  onStartNewRun,
  onOpenAnalysis,
}: {
  kind: 'victory' | 'defeat';
  pilotFirstName?: string;
  onAgain: () => void;
  onContinue?: () => void;
  onRetryHpDown?: () => void;
  onRetryRerolls?: () => void;
  onStartNewRun?: () => void;
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
        {kind === 'defeat' && onStartNewRun ? (
          <button
            type="button"
            className="battle-poc__result-btn battle-poc__result-btn--primary"
            onClick={onStartNewRun}
          >
            START NEW RUN
          </button>
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
