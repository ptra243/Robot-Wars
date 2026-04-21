/**
 * Which point of the card preview is pinned to the cursor (viewport coords).
 * Four corners + midpoint of left/right edges — popup extends toward screen center.
 */
export type CardPopoverAnchor = 'tl' | 'tr' | 'bl' | 'br' | 'ml' | 'mr';

const GAP = 10;

/**
 * Pick anchor so the popover opens toward the viewport center from the cursor.
 * Uses horizontal dominance → side mids; vertical dominance → top/bottom corners; else diagonal corners.
 */
export function computeCardPopoverAnchor(
  clientX: number,
  clientY: number,
  vw: number,
  vh: number,
): CardPopoverAnchor {
  const cx = vw / 2;
  const cy = vh / 2;
  const vx = cx - clientX;
  const vy = cy - clientY;
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  /** Ratio at which one axis clearly dominates (≈32° from axis). */
  const k = 1.6;

  if (ax > ay * k) {
    return vx > 0 ? 'ml' : 'mr';
  }
  if (ay > ax * k) {
    if (vy > 0) {
      return vx >= 0 ? 'tl' : 'tr';
    }
    return vx >= 0 ? 'bl' : 'br';
  }
  if (vx >= 0 && vy >= 0) {
    return 'tl';
  }
  if (vx < 0 && vy >= 0) {
    return 'tr';
  }
  if (vx >= 0 && vy < 0) {
    return 'bl';
  }
  return 'br';
}

/** CSS transform: `left`/`top` are cursor; moves box so the chosen anchor sits at cursor (+ gap). */
export function cardPopoverAnchorTransform(anchor: CardPopoverAnchor): string {
  const g = GAP;
  switch (anchor) {
    case 'tl':
      return `translate(${g}px, ${g}px)`;
    case 'tr':
      return `translate(calc(-100% - ${g}px), ${g}px)`;
    case 'bl':
      return `translate(${g}px, calc(-100% - ${g}px))`;
    case 'br':
      return `translate(calc(-100% - ${g}px), calc(-100% - ${g}px))`;
    case 'ml':
      return `translate(${g}px, -50%)`;
    case 'mr':
      return `translate(calc(-100% - ${g}px), -50%)`;
    default:
      return `translate(${g}px, ${g}px)`;
  }
}
