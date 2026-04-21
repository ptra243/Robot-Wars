export interface FighterSummaryProps {
  label: string;
  side: 'player' | 'enemy';
  hp: number;
  block: number;
  maxHp: number;
  charge: number;
  junk: number;
  bulk: number;
  core: number;
  potency: number;
  exposeDamage: number;
}

export function FighterSummary(props: FighterSummaryProps) {
  const {
    label,
    side,
    hp,
    block,
    maxHp,
    charge,
    junk,
    bulk,
    core,
    potency,
    exposeDamage,
  } = props;

  const hpPercent = Math.max(0, Math.min(100, (hp / maxHp) * 100));
  const blockPercent = Math.max(0, Math.min(100, (block / Math.max(1, maxHp)) * 100));
  const enPercent = Math.max(0, Math.min(100, (charge / 99) * 100));

  const statuses: Array<{ key: string; label: string; tooltipName: string; value: number }> = [
    { key: 'junk', label: 'J', tooltipName: 'Junk', value: junk },
    { key: 'bulk', label: 'BU', tooltipName: 'Bulk', value: bulk },
    { key: 'core', label: 'R', tooltipName: 'Refined scrap', value: core },
    { key: 'pot', label: 'POT', tooltipName: 'Potency', value: potency },
    { key: 'ex', label: 'EX', tooltipName: 'Expose bonus', value: exposeDamage },
  ].filter((entry) => entry.value > 0);

  return (
    <div className={`fighter-summary fighter-summary--${side}`}>
      <div className="fighter-art">?</div>
      <div className="fighter-bars">
        <div className="fighter-name">{label}</div>
        <div className="bar-row">
          <span className="bar-label">Shield</span>
          <div className="bar bar--shield">
            <div className="bar-fill" style={{ width: `${blockPercent}%` }} />
          </div>
          <span className="bar-value">{block}</span>
        </div>
        <div className="bar-row">
          <span className="bar-label">HP</span>
          <div className="bar bar--hp">
            <div className="bar-fill" style={{ width: `${hpPercent}%` }} />
          </div>
          <span className="bar-value">
            {hp}/{maxHp}
          </span>
        </div>
        <div className="bar-row" title="Energy (charge)">
          <span className="bar-label">EN</span>
          <div className="bar bar--energy">
            <div className="bar-fill" style={{ width: `${enPercent}%` }} />
          </div>
          <span className="bar-value">{charge}</span>
        </div>
        <div className="status-row">
          {statuses.map((status) => (
            <div
              key={status.key}
              className="status-pill"
              title={`(${status.tooltipName}: ${String(status.value)})`}
            >
              <span>{status.label}</span>
              <strong>{status.value}</strong>
            </div>
          ))}
          {statuses.length === 0 && <span className="status-empty">No active statuses</span>}
        </div>
      </div>
    </div>
  );
}
