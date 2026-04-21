import { awakeningDisplay } from './constants';
import { HudReadout } from './HudReadout';

interface ForgeTopBarProps {
  awakeningInternal: number;
  seedLabel: string;
  filledCount: number;
  onSimulate?: () => void;
  onDeploy?: () => void;
  onExit?: () => void;
}

export function ForgeTopBar({
  awakeningInternal,
  seedLabel,
  filledCount,
  onSimulate,
  onDeploy,
  onExit,
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
        <HudReadout label="PROGRAM" value={`${String(filledCount)}/9`} />
      </div>

      <div className="forge-poc__top-actions">
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
