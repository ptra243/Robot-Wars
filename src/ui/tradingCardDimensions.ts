/**
 * Standard playing-card / MTG face ratio (63×88 mm).
 * Use everywhere (Phaser queues, React previews) so layout stays consistent.
 */
export const TRADING_CARD_ASPECT_W = 63;
export const TRADING_CARD_ASPECT_H = 88;

export function tradingCardHeightForWidth(width: number): number {
  return (width * TRADING_CARD_ASPECT_H) / TRADING_CARD_ASPECT_W;
}

export function tradingCardWidthForHeight(height: number): number {
  return Math.round((height * TRADING_CARD_ASPECT_W) / TRADING_CARD_ASPECT_H);
}
