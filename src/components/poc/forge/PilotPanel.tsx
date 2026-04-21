import { getPilotById, getPilotPortraitUrl } from '../../../core/pilots';
import { TRAIT_REGISTRY } from '../../../core/traits';
import { GLINT_TRAITS } from './constants';
import { TraitRow } from './TraitRow';
import type { Trait } from './types';

function traitsForPilot(pilotId: string): Trait[] {
  const pilot = getPilotById(pilotId);
  if (!pilot) {
    return GLINT_TRAITS;
  }
  const slots: { traitId: string; unlockAt: 0 | 1 | 2 }[] = [
    { traitId: pilot.traitIds.base, unlockAt: 0 },
    { traitId: pilot.traitIds.aw0, unlockAt: 1 },
    { traitId: pilot.traitIds.aw1, unlockAt: 2 },
  ];
  return slots.map(({ traitId, unlockAt }) => {
    const def = TRAIT_REGISTRY[traitId];
    if (!def) {
      return { id: traitId, name: traitId, unlockAt, blurb: '' };
    }
    return {
      id: def.id,
      name: def.label,
      unlockAt,
      blurb: def.text,
    };
  });
}

interface PilotPanelProps {
  /** Zero-based run awakening tier (0…2); matches `run.loop.awakening`. */
  awakeningInternal: number;
  pilotId: string;
  playerHp: number;
  playerHpMax: number;
}

export function PilotPanel({
  awakeningInternal,
  pilotId,
  playerHp,
  playerHpMax,
}: PilotPanelProps) {
  const displayAwakening = awakeningInternal + 1;
  const pilot = getPilotById(pilotId);
  const portraitUrl = getPilotPortraitUrl(pilotId);
  const name = pilot?.name ?? 'Pilot';
  const role = pilot?.flavor ?? '';
  const traits = traitsForPilot(pilotId);
  const hpMax = Math.max(1, playerHpMax, playerHp);
  const hp = Math.max(0, playerHp);

  return (
    <aside className="forge-poc__pilot">
      <div className="forge-poc__pilot-portrait">
        <div className="forge-poc__corner forge-poc__corner--tl" />
        <div className="forge-poc__corner forge-poc__corner--tr" />
        <div className="forge-poc__corner forge-poc__corner--bl" />
        <div className="forge-poc__corner forge-poc__corner--br" />
        <img
          src={portraitUrl}
          alt={name}
          className="forge-poc__pilot-img"
        />
        <div className="forge-poc__pilot-portrait-fade" />
      </div>

      <div className="forge-poc__pilot-identity">
        <h2 className="forge-poc__pilot-name">{name.toUpperCase()}</h2>
        <div className="forge-poc__pilot-subtitle">
          <span className="forge-poc__pilot-role">{role}</span>
          <span className="forge-poc__pilot-sep">·</span>
          <span className="forge-poc__pilot-awakening">
            Awakening {displayAwakening}
          </span>
        </div>
      </div>

      <div className="forge-poc__pilot-hp">
        <div className="forge-poc__pilot-hp-head">
          <span className="forge-poc__pilot-hp-label">HP</span>
          <span className="forge-poc__pilot-hp-value">
            {hp}
            <span className="forge-poc__pilot-hp-max">/{playerHpMax}</span>
          </span>
        </div>
        <div className="forge-poc__statbar-track forge-poc__statbar-track--accent">
          <div
            className="forge-poc__statbar-fill"
            style={{ width: `${String(Math.max(0, Math.min(100, (hp / hpMax) * 100)))}%` }}
          />
          <div className="forge-poc__statbar-ticks" />
        </div>
      </div>

      <div className="forge-poc__traits">
        <div className="forge-poc__traits-head">
          <span className="forge-poc__section-eyebrow">{'//'} TRAITS</span>
        </div>
        {traits.map((trait) => (
          <TraitRow
            key={trait.id}
            trait={trait}
            awakeningInternal={awakeningInternal}
          />
        ))}
      </div>
    </aside>
  );
}
