import type { Trait } from './types';

interface TraitRowProps {
  trait: Trait;
  awakeningInternal: number;
  forcedUnlocked?: boolean;
}

export function TraitRow({ trait, awakeningInternal, forcedUnlocked = false }: TraitRowProps) {
  const unlocked =
    forcedUnlocked || trait.unlockAt === 0 || awakeningInternal >= trait.unlockAt;
  const slotLabel =
    trait.unlockAt === 0 ? 'BASE' : `AWAKENING ${String(trait.unlockAt)}`;

  return (
    <div
      className={`forge-poc__trait${
        unlocked ? ' forge-poc__trait--active' : ' forge-poc__trait--locked'
      }`}
    >
      <div className="forge-poc__trait-head">
        <span className="forge-poc__trait-slot">{slotLabel}</span>
        <span className="forge-poc__trait-status">
          {unlocked ? '◆ ACTIVE' : '◇ LOCKED'}
        </span>
      </div>
      {unlocked ? (
        <>
          <div className="forge-poc__trait-name">{trait.name}</div>
          <div className="forge-poc__trait-blurb">{trait.blurb}</div>
        </>
      ) : null}
    </div>
  );
}
