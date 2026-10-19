import type { CSSProperties } from 'react';
import {
  MECH_SPRITE_SHEETS,
  SCRAP_HOUND_ATTACK_SRC,
  SCRAP_HOUND_IDLE_SRC,
} from './battlePocConstants';

export function ScrapHoundCompanion({
  visible,
  anim,
}: {
  visible: boolean;
  anim: 'hidden' | 'summon' | 'idle' | 'attack';
}) {
  if (!visible || anim === 'hidden') {
    return null;
  }
  const src = anim === 'attack' ? SCRAP_HOUND_ATTACK_SRC : SCRAP_HOUND_IDLE_SRC;
  return (
    <div
      className={`battle-poc__scrap-hound battle-poc__scrap-hound--${anim}`}
      aria-hidden
    >
      <img className="battle-poc__scrap-hound-img" src={src} alt="" />
    </div>
  );
}

export function AuraChipRow({
  variant,
  chips,
  a11y,
}: {
  variant: 'buff' | 'debuff';
  chips: { key: string; label: string; iconSrc?: string; title?: string }[];
  a11y: string;
}) {
  if (chips.length === 0) {
    return null;
  }
  return (
    <div
      className={`battle-poc__aura-row battle-poc__aura-row--${variant}`}
      aria-label={a11y}
    >
      {chips.map((c) => (
        <span
          key={`${variant}-${c.key}`}
          className={`battle-poc__aura-chip${c.iconSrc ? ' battle-poc__aura-chip--icon' : ''}`}
          title={c.title ?? c.label}
        >
          {c.iconSrc ? (
            <img className="battle-poc__aura-chip-icon" src={c.iconSrc} alt="" aria-hidden />
          ) : null}
          <span className="battle-poc__aura-chip-label">{c.label}</span>
        </span>
      ))}
    </div>
  );
}

export type MechAnimState = 'idle' | 'attack' | 'attackHold' | 'hurt' | 'defeat';

export function MechSprite({
  src,
  alt,
  animState,
}: {
  src: string;
  alt: string;
  animState: MechAnimState;
}) {
  const strip = MECH_SPRITE_SHEETS[src];
  if (!strip) {
    const imgAnim = animState === 'attackHold' ? 'attack' : animState;
    return (
      <img className={`battle-poc__mech-sprite battle-poc__mech-sprite--${imgAnim}`} src={src} alt={alt} />
    );
  }

  const transitions = Math.max(1, strip.frameCount - 1);
  const durationMs = Math.max(
    120,
    Math.round(
      strip.attackDurationMs ?? (transitions / Math.max(strip.fps, 1)) * 1000,
    ),
  );
  const styleVars: CSSProperties & Record<string, string | number> = {
    backgroundImage: `url(${src})`,
    ['--bp-sheet-frames' as string]: strip.frameCount,
    ['--bp-sheet-dur' as string]: `${String(durationMs)}ms`,
  };
  if (strip.frameAspect) {
    styleVars['--bp-frame-aspect'] = String(strip.frameAspect);
  }
  const stripModifier =
    animState === 'attackHold' ? 'attack-hold' : animState === 'attack' ? 'attack' : animState;
  return (
    <div
      role="img"
      aria-label={alt}
      data-aspect-fit={strip.frameAspect ? 'true' : undefined}
      data-punch-timing={strip.weightedPunchTiming ? 'weighted' : undefined}
      className={`battle-poc__mech-sprite-strip battle-poc__mech-sprite-strip--${stripModifier}`}
      style={styleVars}
    />
  );
}

export function DamagePop({ side, amount }: { side: 'left' | 'right'; amount: number }) {
  return (
    <div className={`battle-poc__dmg battle-poc__dmg--${side}`}>
      -{amount}
      <span className="battle-poc__dmg-label">HP</span>
    </div>
  );
}

export function TracerBolt({ direction }: { direction: 'leftward' | 'rightward' }) {
  return <div className={`battle-poc__tracer battle-poc__tracer--${direction}`} />;
}

export function MuzzleFlash({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__muzzle battle-poc__muzzle--${side}`} />;
}

export function ImpactSpark({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__impact battle-poc__impact--${side}`} />;
}

export function SpeedLines({ direction }: { direction: 'leftward' | 'rightward' }) {
  return <div className={`battle-poc__speed-lines battle-poc__speed-lines--${direction}`} />;
}

export function GroundSlam({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__ground-slam battle-poc__ground-slam--${side}`} />;
}

export function ShieldAura({ side }: { side: 'left' | 'right' }) {
  return <div className={`battle-poc__shield-aura battle-poc__shield-aura--${side}`} />;
}

export function SystemLock({ actor }: { actor?: string }) {
  const side = actor === 'Enemy' ? 'enemy' : 'player';
  const label = actor === 'Enemy' ? 'ENEMY SYSTEM LOCK' : 'SYSTEM LOCK';
  return (
    <div className={`battle-poc__system-lock battle-poc__system-lock--${side}`}>
      <span>{label}</span>
    </div>
  );
}

export function WhiffBanner() {
  return (
    <div className="battle-poc__whiff-banner">
      <span>WHIFF</span>
    </div>
  );
}

export function FatiguePulse() {
  return <div className="battle-poc__fatigue-pulse" aria-hidden />;
}
