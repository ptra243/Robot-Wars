/**
 * Slot centering for plan queue and library carousel (shared band width and card size).
 */
import { DECK_BUILD } from './deckBuildConstants';

export { DECK_BUILD };

const QUEUE_LEFT = DECK_BUILD.CONTAINER_CX - DECK_BUILD.QUEUE_BAND_W / 2;

function innerPadRow(cellW: number, bandW: number): number {
  const { SLOTS: n, QUEUE_GAP: g } = DECK_BUILD;
  const rowW = n * cellW + (n - 1) * g;
  return (bandW - rowW) / 2;
}

/** Plan queue — uses full {@link DECK_BUILD.QUEUE_BAND_W}. */
export function deckQueueSlotCenterX(slotIndex: number): number {
  const cw = DECK_BUILD.QUEUE_CELL_W;
  return QUEUE_LEFT + innerPadRow(cw, DECK_BUILD.QUEUE_BAND_W) + cw / 2 + slotIndex * (cw + DECK_BUILD.QUEUE_GAP);
}

/** Library carousel — same geometry as the plan queue (shared band + card size). */
export function deckCarouselSlotCenterX(slotIndex: number): number {
  return deckQueueSlotCenterX(slotIndex);
}
