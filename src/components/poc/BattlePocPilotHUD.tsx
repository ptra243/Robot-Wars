/** Visual cap for energy / shield bar fill (combat has no hard energy max). */
export const BATTLE_POC_ENERGY_BAR_CAP = 12;
export const BATTLE_POC_SHIELD_BAR_CAP = 40;
const ENERGY_BAR_CAP = BATTLE_POC_ENERGY_BAR_CAP;
const SHIELD_BAR_CAP = BATTLE_POC_SHIELD_BAR_CAP;
const HUD_PIPS = 20; // one pip per 5 % of max HP

export interface BattlePocPilotHUDProps {
  side: 'left' | 'right';
  name: string;
  subtitle: string;
  portrait: string;
  hp: number;
  maxHp: number;
  active: boolean;
  taking: boolean;
  theme: 'ally' | 'enemy';
  energy?: number;
  energyCap?: number;
  shield?: number;
  shieldCap?: number;
  /** Shuriken stacks (cyberpunk); shown when replay provides a value. */
  shurikenStacks?: number;
}

export function BattlePocPilotHUD({
  side,
  name,
  subtitle,
  portrait,
  hp,
  maxHp,
  active,
  taking,
  theme,
  energy,
  energyCap,
  shield,
  shieldCap,
  shurikenStacks,
}: BattlePocPilotHUDProps) {
  const activePips = Math.round(Math.max(0, Math.min(1, hp / maxHp)) * HUD_PIPS);
  const ec = energyCap ?? ENERGY_BAR_CAP;
  const sc = shieldCap ?? SHIELD_BAR_CAP;
  const energyPct = energy !== undefined ? Math.max(0, Math.min(1, energy / Math.max(ec, 1))) : null;
  const shieldPct = shield !== undefined ? Math.max(0, Math.min(1, shield / Math.max(sc, 1))) : null;

  return (
    <div
      className={[
        'battle-poc__hud',
        `battle-poc__hud--${side}`,
        `battle-poc__hud--${theme}`,
        active ? 'battle-poc__hud--active' : '',
        taking ? 'battle-poc__hud--taking' : '',
      ].join(' ')}
    >
      <div className="battle-poc__hud-portrait">
        <img src={portrait} alt={`${name} portrait`} />
        <div className="battle-poc__hud-portrait-frame" />
      </div>
      <div className="battle-poc__hud-body">
        <div className="battle-poc__hud-name">{name}</div>
        <div className="battle-poc__hud-subtitle">{subtitle}</div>
        {shieldPct !== null ? (
          <div className="battle-poc__res battle-poc__res--shield" title="Shield (block)">
            <span className="battle-poc__res-label">SH</span>
            <div className="battle-poc__res-track">
              <div
                className="battle-poc__res-fill battle-poc__res-fill--shield"
                style={{ width: `${String(shieldPct * 100)}%` }}
              />
            </div>
            <span className="battle-poc__res-num">{String(shield ?? 0)}</span>
          </div>
        ) : null}
        <div className="battle-poc__hud-pips-row">
          <div className="battle-poc__hud-pips">
            {Array.from({ length: HUD_PIPS }, (_, i) => {
              let state: string;
              if (i >= activePips) {
                state = 'empty';
              } else if (i <= 2) {
                state = 'red';
              } else if (i <= 9) {
                state = 'yellow';
              } else {
                state = 'green';
              }
              return <span key={i} className={`battle-poc__hud-pip battle-poc__hud-pip--${state}`} />;
            })}
          </div>
          <span className="battle-poc__hud-hp-num">
            {hp}
            <span className="battle-poc__hud-hp-max"> /{maxHp}</span>
          </span>
        </div>
        {energyPct !== null ? (
          <div className="battle-poc__res battle-poc__res--energy" title="Energy (charge)">
            <span className="battle-poc__res-label">EN</span>
            <div className="battle-poc__res-track">
              <div
                className="battle-poc__res-fill battle-poc__res-fill--energy"
                style={{ width: `${String(energyPct * 100)}%` }}
              />
            </div>
            <span className="battle-poc__res-num">{String(energy ?? 0)}</span>
          </div>
        ) : null}
        {shurikenStacks !== undefined ? (
          <div className="battle-poc__res battle-poc__res--shuriken" title="Shuriken stacks">
            <span className="battle-poc__res-label">SH</span>
            <span className="battle-poc__res-num battle-poc__res-num--plain">{String(shurikenStacks)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
