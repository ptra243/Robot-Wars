/**
 * When a queue slot’s card id changes, keep `fighter.deck` in sync by swapping one
 * deck occurrence (first match). Skips if `fromId` is missing or already `toId`.
 */
export function replaceOneDeckOccurrence(
  deck: string[],
  fromId: string | null | undefined,
  toId: string,
): void {
  if (!fromId || fromId === toId) {
    return;
  }
  const i = deck.indexOf(fromId);
  if (i >= 0) {
    deck[i] = toId;
  }
}
