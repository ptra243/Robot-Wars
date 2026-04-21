/**
 * Deck builder layout (Phaser game space).
 * Queue row spans the full game width minus {@link GAME_PAD_X} on each side.
 * Library carousel uses the same card size so queue and library stay aligned.
 */
import { tradingCardHeightForWidth } from './tradingCardDimensions';

const GAME_W = 1400;
const GAME_H = 900;
const GAME_PAD_X = 15;
/** Inset (world px) for chrome drawn inside the deck builder canvas — keep margins in-scene, not on the HTML host. */
const SCENE_EDGE_INSET = 12;
/** Usable width for the plan queue row (matches HTML overlay intent). */
const QUEUE_BAND_W = GAME_W - 2 * GAME_PAD_X;
const SLOTS = 9;
const QUEUE_GAP = 8;

const QUEUE_CELL_W = Math.floor((QUEUE_BAND_W - (SLOTS - 1) * QUEUE_GAP) / SLOTS);
const QUEUE_CELL_H = Math.round(tradingCardHeightForWidth(QUEUE_CELL_W));

/** Library carousel uses the same card size and horizontal band as the plan queue. */
const CAROUSEL_CELL_W = QUEUE_CELL_W;
const CAROUSEL_CELL_H = QUEUE_CELL_H;

const QUEUE_PANEL_H = Math.max(300, QUEUE_CELL_H + 100);

/** Top edge of the HTML filter strip in game space (was ~59.75% of {@link GAME_H}). */
const LIBRARY_FILTER_TOP_WORLD_Y = Math.round(GAME_H * 0.5975);

export const DECK_BUILD = {
  GAME_W,
  GAME_H,
  GAME_PAD_X,
  SCENE_EDGE_INSET,
  /** Horizontal content width used for titles / library chrome alignment. */
  CONTAINER_CX: 700,
  CONTAINER_W: 1200,
  /** Plan queue + matching HTML filters use the full game width minus side padding. */
  QUEUE_BAND_W,
  QUEUE_GAP,
  SLOTS,
  QUEUE_ROW_CY: 280,
  QUEUE_PANEL_H,
  QUEUE_CELL_W,
  QUEUE_CELL_H,
  CAROUSEL_ROW_CY: 688,
  CAROUSEL_PANEL_H: QUEUE_PANEL_H,
  CAROUSEL_CELL_W,
  CAROUSEL_CELL_H,
  /** Push carousel cells below the HTML filter strip. */
  LIBRARY_CAROUSEL_Y_OFFSET: 88,
  /** Align React overlay `top` with legacy layout when syncing to canvas. */
  LIBRARY_FILTER_TOP_WORLD_Y,
} as const;
