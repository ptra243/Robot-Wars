export function HudReadout({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`forge-poc__hud-item${accent ? ' forge-poc__hud-item--accent' : ''}`}>
      <span className="forge-poc__hud-label">{label}</span>
      <span className="forge-poc__hud-value">{value}</span>
    </div>
  );
}
