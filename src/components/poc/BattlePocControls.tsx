export type BattlePocSpeed = 1 | 2 | 4;
export type BattlePocStage = 'alley' | 'market' | 'neon';

export function SkipBattleControl({
  disabled,
  onSkip,
}: {
  disabled?: boolean;
  onSkip: () => void;
}) {
  return (
    <button
      type="button"
      className="battle-poc__skip-battle"
      disabled={disabled}
      onClick={onSkip}
      aria-label="Skip battle replay"
    >
      SKIP
    </button>
  );
}

export function SpeedControl({
  value,
  onChange,
}: {
  value: BattlePocSpeed;
  onChange: (s: BattlePocSpeed) => void;
}) {
  const options: BattlePocSpeed[] = [1, 2, 4];
  return (
    <div className="battle-poc__speed" role="group" aria-label="Battle speed">
      <span className="battle-poc__speed-label">SPEED</span>
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          className={['battle-poc__speed-btn', value === opt ? 'battle-poc__speed-btn--active' : ''].join(' ')}
          onClick={() => {
            onChange(opt);
          }}
          aria-pressed={value === opt}
        >
          {opt}×
        </button>
      ))}
    </div>
  );
}

export function StageControl({
  value,
  onChange,
}: {
  value: BattlePocStage;
  onChange: (s: BattlePocStage) => void;
}) {
  const options: { id: BattlePocStage; label: string }[] = [
    { id: 'alley', label: 'ALLEY' },
    { id: 'market', label: 'DUEL' },
    { id: 'neon', label: 'NEON' },
  ];
  return (
    <div className="battle-poc__speed" role="group" aria-label="Arena stage">
      <span className="battle-poc__speed-label">STAGE</span>
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={['battle-poc__speed-btn', value === opt.id ? 'battle-poc__speed-btn--active' : ''].join(' ')}
          onClick={() => {
            onChange(opt.id);
          }}
          aria-pressed={value === opt.id}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
