import * as Phaser from 'phaser';
import {
  TRADING_CARD_ASPECT_H,
  TRADING_CARD_ASPECT_W,
} from './tradingCardDimensions';
import { ensureMiniCardArtPlaceholderTexture, MINI_CARD_ART_PLACEHOLDER_KEY } from './phaserCardArt';

/**
 * World scale vs legacy 900×560 — queues are wider on screen; card cells keep 63:88 ratio.
 * HTML fighter HUD uses `ARENA_FIGHTER_OVERLAY` so it lines up with the Phaser canvas (see `.arena-host` aspect-ratio).
 */
/** World scale vs legacy 900×560 — larger = bigger queue cards on the battle screen. */
export const ARENA_SCALE = 1.52;

const LEGACY_W = 900;
const LEGACY_H = 560;

/**
 * Horizontal-only boost: widens world aspect toward common viewports (~16:9), so Phaser FIT shows
 * less empty margin on the sides of the arena host. Tune this (with `ARENA_HEIGHT_BOOST`) to match
 * your typical window aspect.
 */
export const ARENA_WIDTH_BOOST = 1.22;
/** Extra world height: more vertical space between the two queue rows (fighter / character band). */
export const ARENA_HEIGHT_BOOST = 1.12;

export const ARENA_W = Math.round(LEGACY_W * ARENA_SCALE * ARENA_WIDTH_BOOST);
export const ARENA_H = Math.round(LEGACY_H * ARENA_SCALE * ARENA_HEIGHT_BOOST);

/** Minimal margin from world edge to queue backing panel (each side). */
const QUEUE_SIDE_INSET = 8;

const QUEUE_GAP = Math.round(13 * ARENA_SCALE);
/** Panel spans almost the full arena width; card size is the max that fits nine slots. */
const QUEUE_CONTAINER_W = ARENA_W - QUEUE_SIDE_INSET * 2;
const QUEUE_CELL_W = Math.max(
  48,
  Math.floor((QUEUE_CONTAINER_W - 8 * QUEUE_GAP) / 9),
);
const QUEUE_CELL_H = Math.round((QUEUE_CELL_W * TRADING_CARD_ASPECT_H) / TRADING_CARD_ASPECT_W);
const QUEUE_ROW_PANEL_H = Math.max(
  Math.round(110 * ARENA_SCALE),
  QUEUE_CELL_H + Math.round(26 * ARENA_SCALE),
);

/**
 * Shared layout: both queues use the same cell geometry inside one wide panel.
 * Queue slots use MTG aspect ratio (63×88); cells grow to use horizontal space.
 */
export const QUEUE_UI = {
  CONTAINER_CX: ARENA_W / 2,
  CONTAINER_W: QUEUE_CONTAINER_W,
  ROW_PANEL_H: QUEUE_ROW_PANEL_H,
  CELL_W: QUEUE_CELL_W,
  CELL_H: QUEUE_CELL_H,
  GAP: QUEUE_GAP,
  SLOTS: 9,
} as const;

const CONTAINER_LEFT = QUEUE_UI.CONTAINER_CX - QUEUE_UI.CONTAINER_W / 2;

function innerPad(): number {
  const rowW =
    QUEUE_UI.SLOTS * QUEUE_UI.CELL_W + (QUEUE_UI.SLOTS - 1) * QUEUE_UI.GAP;
  return (QUEUE_UI.CONTAINER_W - rowW) / 2;
}

/** Center X of slot `index` (0–8), aligned inside the queue panel. */
export function queueSlotCenterX(index: number): number {
  return (
    CONTAINER_LEFT +
    innerPad() +
    QUEUE_UI.CELL_W / 2 +
    index * (QUEUE_UI.CELL_W + QUEUE_UI.GAP)
  );
}

export interface QueueCardStyle {
  idleFill: number;
  activeFill: number;
  strokeColor: number;
  strokeWidth: number;
  labelColor: string;
}

/**
 * Backing panel for a queue row (enemy or player). Same geometry for both sides.
 */
export function createQueueRowPanel(
  scene: Phaser.Scene,
  rowCenterY: number,
  strokeColor: number,
): Phaser.GameObjects.Rectangle {
  return scene.add
    .rectangle(QUEUE_UI.CONTAINER_CX, rowCenterY, QUEUE_UI.CONTAINER_W, QUEUE_UI.ROW_PANEL_H, 0x0f1420, 0.95)
    .setStrokeStyle(1, strokeColor)
    .setDepth(0);
}

/** Darken an 0xRRGGBB fill toward black (factor 0–1). */
export function shadeFill(base: number, factor: number): number {
  const r = ((base >> 16) & 0xff) * factor;
  const g = ((base >> 8) & 0xff) * factor;
  const b = (base & 0xff) * factor;
  return ((r & 0xff) << 16) | ((g & 0xff) << 8) | (b & 0xff);
}

export interface MiniMtgQueueCard {
  root: Phaser.GameObjects.Container;
  border: Phaser.GameObjects.Rectangle;
  titleBg: Phaser.GameObjects.Rectangle;
  artBg: Phaser.GameObjects.Rectangle;
  /** Card art (forge URLs); alpha 0 until texture loads. */
  artImage: Phaser.GameObjects.Image;
  rulesBg: Phaser.GameObjects.Rectangle;
  titleText: Phaser.GameObjects.Text;
  rulesText: Phaser.GameObjects.Text;
  /** Guards stale async art loads when the slot’s card id changes. */
  artTargetId?: string;
}

/**
 * Small MTG-shaped card: title band, art window, rules strip (Phaser world units).
 */
export function createMiniMtgQueueCard(
  scene: Phaser.Scene,
  centerX: number,
  centerY: number,
  cellW: number,
  cellH: number,
  style: QueueCardStyle,
): MiniMtgQueueCard {
  const w = cellW;
  const h = cellH;
  const pad = Math.max(1, Math.floor(Math.min(w, h) * 0.03));
  const titleH = Math.max(10, Math.floor(h * 0.17));
  const artH = Math.floor(h * 0.44);
  const rulesH = Math.max(6, h - titleH - artH - 5 * pad);

  const titleBgColor = shadeFill(style.idleFill, 0.58);
  const artBgColor = 0x080a0e;
  const rulesBgColor = shadeFill(style.idleFill, 0.45);

  const top = -h / 2;

  const border = scene.add
    .rectangle(0, 0, w, h, style.idleFill, 1)
    .setStrokeStyle(style.strokeWidth, style.strokeColor)
    .setOrigin(0.5);

  const yTitleC = top + pad + titleH / 2;
  const titleBg = scene.add
    .rectangle(0, yTitleC, w - pad * 2, titleH - 1, titleBgColor, 1)
    .setStrokeStyle(1, 0x020202)
    .setOrigin(0.5);

  const yArtC = top + pad + titleH + pad + artH / 2;
  const artBg = scene.add
    .rectangle(0, yArtC, w - pad * 2, artH, artBgColor, 1)
    .setStrokeStyle(1, 0x010101)
    .setOrigin(0.5);

  ensureMiniCardArtPlaceholderTexture(scene);
  const artImage = scene.add
    .image(0, yArtC, MINI_CARD_ART_PLACEHOLDER_KEY)
    .setDisplaySize(w - pad * 2, artH)
    .setAlpha(0);

  const yRulesC = top + pad + titleH + pad + artH + pad + rulesH / 2;
  const rulesBg = scene.add
    .rectangle(0, yRulesC, w - pad * 2, rulesH, rulesBgColor, 1)
    .setStrokeStyle(1, 0x030303)
    .setOrigin(0.5);

  const titleSize = Math.max(7, Math.floor(titleH * 0.52));
  const rulesSize = Math.max(5, Math.floor(rulesH * 0.3));

  const titleText = scene.add
    .text(0, yTitleC, '', {
      color: style.labelColor,
      fontFamily: 'Consolas, monospace',
      fontSize: `${titleSize}px`,
      align: 'center',
    })
    .setOrigin(0.5);

  const rulesText = scene.add
    .text(0, yRulesC, '', {
      color: style.labelColor,
      fontFamily: 'Consolas, monospace',
      fontSize: `${rulesSize}px`,
      align: 'center',
      wordWrap: { width: w - pad * 4 },
      lineSpacing: 0,
    })
    .setOrigin(0.5);

  const root = scene.add.container(centerX, centerY, [
    border,
    titleBg,
    artBg,
    artImage,
    rulesBg,
    titleText,
    rulesText,
  ]);
  root.setDepth(1);

  return { root, border, titleBg, artBg, artImage, rulesBg, titleText, rulesText };
}

/** @deprecated Use MiniMtgQueueCard — alias for migration */
export type QueueCardObjects = MiniMtgQueueCard;

/**
 * Arena queue slot: one mini MTG card (interactive hit area = `border`).
 */
export function createQueueCard(
  scene: Phaser.Scene,
  slotIndex: number,
  rowCenterY: number,
  style: QueueCardStyle,
): MiniMtgQueueCard {
  const x = queueSlotCenterX(slotIndex);
  return createMiniMtgQueueCard(scene, x, rowCenterY, QUEUE_UI.CELL_W, QUEUE_UI.CELL_H, style);
}

/**
 * Vertical centers for the two queue rows (Phaser world space).
 * Enemy sits under the top inset; **player row is bottom-anchored** so it stays visually at the
 * bottom of the arena as the world size changes.
 */
const QUEUE_ROW_TOP_INSET = Math.round(24 * ARENA_SCALE);
const QUEUE_ROW_BOTTOM_INSET = Math.round(14 * ARENA_SCALE);

export const QUEUE_ROW_Y = (() => {
  const half = QUEUE_UI.ROW_PANEL_H / 2;
  return {
    enemy: QUEUE_ROW_TOP_INSET + half,
    player: ARENA_H - QUEUE_ROW_BOTTOM_INSET - half,
  } as const;
})();

/** Match `.arena-host` aspect-ratio in CSS (string for the `aspect-ratio` property). */
export const ARENA_ASPECT_RATIO_STRING = `${ARENA_W} / ${ARENA_H}`;

/**
 * Percentages of the arena frame — use on `.fighter-overlay` so it sits between queue panels (aligned with Phaser).
 */
export const ARENA_FIGHTER_OVERLAY = (() => {
  const half = QUEUE_UI.ROW_PANEL_H / 2;
  const topEdge = QUEUE_ROW_Y.enemy + half;
  const bottomEdge = QUEUE_ROW_Y.player - half;
  const inset = (ARENA_W - QUEUE_UI.CONTAINER_W) / 2;
  return {
    topPct: (topEdge / ARENA_H) * 100,
    heightPct: ((bottomEdge - topEdge) / ARENA_H) * 100,
    insetPct: (inset / ARENA_W) * 100,
  } as const;
})();

/** Outcome line: just below the player queue panel, above the bottom edge. */
export const ARENA_FOOTER_Y = (() => {
  const playerBottom = QUEUE_ROW_Y.player + QUEUE_UI.ROW_PANEL_H / 2;
  const y = playerBottom + Math.round(20 * ARENA_SCALE);
  return Math.min(y, ARENA_H - 8);
})();

export const ARENA_TRANSCRIPT = {
  x: Math.round(40 * ARENA_SCALE),
  y: Math.round((438 / LEGACY_H) * ARENA_H),
  wordWrap: Math.min(Math.round(820 * ARENA_SCALE * ARENA_WIDTH_BOOST), ARENA_W - 80),
} as const;

/** Title text Y above each panel */
export function queueTitleY(rowCenterY: number): number {
  return rowCenterY - QUEUE_UI.ROW_PANEL_H / 2 - 14;
}
