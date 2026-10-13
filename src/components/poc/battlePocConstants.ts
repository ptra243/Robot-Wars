import { COMBAT_RULES } from '../../core/rules';

export const BLANK_QUEUE_ID = COMBAT_RULES.blankQueueSlotCardId;

export const PLAYER_MAX_HP = 50;
export const ENEMY_MAX_HP = 50;

/**
 * Frozen impact pose after the strip finishes, before returning to idle.
 * Kept longer than the strip play so the punch contact reads clearly.
 */
export const PLAYER_STRIKE_HOLD_MS = 720;

/**
 * Battle phase machine. The scripted POC cycles through these in order,
 * alternating between player and enemy. Durations are tuned in
 * PHASE_DURATIONS below; `speedScale` state divides them.
 */
export type Phase =
  | 'intro'
  | 'player-reveal'
  | 'player-strike'
  /** Final punch frame held before sliding back (see PLAYER_STRIKE_HOLD_MS). */
  | 'player-strike-hold'
  | 'player-recover'
  | 'enemy-reveal'
  | 'enemy-strike'
  | 'enemy-recover'
  | 'victory'
  | 'defeat';

export type MechPose = 'idle' | 'attackWindup' | 'attackContact' | 'hurt' | 'defeat';

export interface MechPoseSet {
  idle: string;
  attackWindup: string;
  attackContact: string;
  hurt: string;
  defeat: string;
}

export interface SpriteSheetSpec {
  frameCount: number;
  /**
   * Fallback rate for uniform `steps()` strips: play time = (frameCount - 1) / fps.
   * Prefer {@link attackDurationMs} when set (time-bounded, independent of frame count).
   */
  fps: number;
  /**
   * Hard cap for the attack strip play-through (ms). Replay / phase timers use this
   * so waiting on the animation cannot stretch the battle flow.
   */
  attackDurationMs?: number;
  /**
   * Use weighted punch keyframes (fast windup → linger on contact frame) instead of
   * equal time per frame.
   */
  weightedPunchTiming?: boolean;
  /**
   * Per-frame aspect ratio (W/H), used to letterbox the strip inside the
   * landscape mech container so a portrait-leaning source doesn't get squished
   * vertically. Compute as `(sourceWidth / frameCount) / sourceHeight`.
   */
  frameAspect?: number;
}

export const PHASE_DURATIONS: Record<Phase, number> = {
  intro: 900,
  /* Slightly longer windup so the rush reads before the strip runs. */
  'player-reveal': 820,
  /* Overridden at runtime for Glint strip length — keep non-zero for typing. */
  'player-strike': 340,
  'player-strike-hold': PLAYER_STRIKE_HOLD_MS,
  /* Return slide + settle before enemy turn / next program card advance. */
  'player-recover': 580,
  'enemy-reveal': 700,
  'enemy-strike': 520,
  'enemy-recover': 380,
  victory: 0,
  defeat: 0,
};

export const ENEMY_MECH_POSES: MechPoseSet = {
  idle: '/poc/poc-mech-enemy-sprite.png',
  attackWindup: '/poc/poc-mech-enemy-sprite.png',
  attackContact: '/poc/poc-mech-enemy-sprite.png',
  hurt: '/poc/poc-mech-enemy-sprite.png',
  defeat: '/poc/poc-mech-enemy-sprite.png',
};

export const GLINT_PUNCH_STRIP = '/poc/poc-mech-glint-punch-strip.png';

export const GLINT_POSES: MechPoseSet = {
  idle: GLINT_PUNCH_STRIP,
  attackWindup: GLINT_PUNCH_STRIP,
  attackContact: GLINT_PUNCH_STRIP,
  hurt: GLINT_PUNCH_STRIP,
  defeat: GLINT_PUNCH_STRIP,
};

export const BARON_POSES: MechPoseSet = {
  idle: '/poc/poc-mech-baron-von-boar-sprite.png',
  attackWindup: '/poc/poc-mech-baron-von-boar-sprite.png',
  attackContact: '/poc/poc-mech-baron-von-boar-sprite.png',
  hurt: '/poc/poc-mech-baron-von-boar-sprite.png',
  defeat: '/poc/poc-mech-baron-von-boar-sprite.png',
};

/**
 * Optional strip animation metadata by image URL.
 *
 * Attack length is {@link SpriteSheetSpec.attackDurationMs} when set, else
 * `(frameCount - 1) / fps` seconds. `player-strike` lasts that long; then
 * `player-strike-hold` ({@link PLAYER_STRIKE_HOLD_MS}) freezes the last frame.
 * Replay dwell for a player resolve is exactly strike + hold (no unbounded wait).
 */
export const MECH_SPRITE_SHEETS: Record<string, SpriteSheetSpec | undefined> = {
  // Source: 1746×376 sliced into 6 equal columns of 291×376 each (frame
  // aspect ≈ 0.77 — closer to square than the original 0.54 portrait).
  // Each frame is independently bbox-cropped from the AI source then
  // pasted centered into a uniform column wide enough to contain the
  // widest pose (the fully-extended punch + impact burst). See
  // `scripts/sliceGlintStrip.ps1` for the slicing pipeline.
  //
  // Timing: ~340ms snap through windup/extension, then hold phase lingers on
  // the impact frame (see weighted keyframes in battle-poc.css).
  [GLINT_PUNCH_STRIP]: {
    frameCount: 6,
    fps: 14,
    attackDurationMs: 340,
    weightedPunchTiming: true,
    frameAspect: 291 / 376,
  },
};
