import { awakeningDisplay } from './constants';
import { HudReadout } from './HudReadout';

interface ForgeTopBarProps {
  awakeningInternal: number;
  seedLabel: string;
  filledCount: number;
  /** Max program slots in play (5–9) for the readout `filled / cap`. */
  programSlotCap: number;
  onSimulate?: () => void;
  onDeploy?: () => void;
  onExit?: () => void;
  viewMode?: 'player' | 'enemy';
  onViewModeChange?: (next: 'player' | 'enemy') => void;
}

export function ForgeTopBar({
  awakeningInternal,
  seedLabel,
  filledCount,
  programSlotCap,
  onSimulate,
  onDeploy,
  onExit,
  viewMode = 'player',
  onViewModeChange,
}: ForgeTopBarProps) {
  return (
    <header className="forge-poc__topbar">
      <div className="forge-poc__brand">
        <div className="forge-poc__brand-glyph">◆</div>
        <div className="forge-poc__brand-text">
          <span className="forge-poc__brand-title">
            ROBOT<span className="accent">WARS</span>
          </span>
          <span className="forge-poc__brand-sub">
            {'//'} DECK FORGE · v0.4 PROTOTYPE
          </span>
        </div>
      </div>

      <div className="forge-poc__hud">
        <HudReadout label="SEED" value={seedLabel} />
        <HudReadout
          label="AWAKENING"
          value={String(awakeningDisplay(awakeningInternal)).padStart(2, '0')}
          accent
        />
        <HudReadout
          label="PROGRAM"
          value={`${String(filledCount)}/${String(programSlotCap)}`}
        />
      </div>

      <div className="forge-poc__top-actions">
        {onViewModeChange ? (
          <div className="forge-poc__view-toggle" role="group" aria-label="Forge perspective">
            <button
              className={`forge-poc__view-toggle-btn${viewMode === 'player' ? ' forge-poc__view-toggle-btn--active' : ''}`}
              type="button"
              onClick={() => onViewModeChange('player')}
              aria-pressed={viewMode === 'player'}
            >
              PLAYER
            </button>
            <button
              className={`forge-poc__view-toggle-btn${viewMode === 'enemy' ? ' forge-poc__view-toggle-btn--active' : ''}`}
              type="button"
              onClick={() => onViewModeChange('enemy')}
              aria-pressed={viewMode === 'enemy'}
            >
              ENEMY
            </button>
          </div>
        ) : null}
        <button
          className="forge-poc__btn forge-poc__btn--ghost"
          type="button"
          onClick={onSimulate}
          disabled={!onSimulate}
        >
          <span className="bracket">[</span>SIMULATE<span className="bracket">]</span>
        </button>
        <button className="forge-poc__btn forge-poc__btn--primary" type="button" onClick={onDeploy}>
          <span className="bracket">[</span>DEPLOY<span className="bracket">]</span>
        </button>
        {onExit ? (
          <button
            className="forge-poc__btn forge-poc__btn--exit"
            type="button"
            onClick={onExit}
            aria-label="Exit prototype"
          >
            ✕
          </button>
        ) : null}
      </div>
    </header>
  );
}
