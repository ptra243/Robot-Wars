import type { CardDef } from '../core/types';

/**
 * Sums all self-HP effect steps (the card’s "pay in HP" lines). Used when energy is 0
 * to show a red **HP** cost badge and omit duplicate "Lose X HP" lines in body text.
 */
export function sumSelfDamageInEffects(card: CardDef): number {
  let n = 0;
  for (const e of card.effects ?? []) {
    if (e.type === 'SelfDamage' || e.type === 'SelfDamageRespectFloor1') {
      n += e.amount;
    }
  }
  return n;
}

/** True when the card is free in energy and pays HP in its effect pipeline. */
export function isZeroEnergyHpPlayCostCard(card: CardDef): boolean {
  return card.charge_cost === 0 && sumSelfDamageInEffects(card) > 0;
}

/**
 * If this card’s HP is shown as the top-right play-cost badge, drop the matching
 * "Lose X HP …" / "Self damage …" lines from the long description to avoid double-printing.
 */
export function stripSelfHpPlayCostFromDescriptionText(body: string, card: CardDef): string {
  if (!isZeroEnergyHpPlayCostCard(card)) {
    return body;
  }
  return body
    .split('\n')
    .filter((line) => {
      const t = line.trim();
      if (/^Lose \d+ HP/i.test(t)) {
        return false;
      }
      if (/^Self damage\b/i.test(t)) {
        return false;
      }
      return true;
    })
    .join('\n');
}

export function hpPlayCostAmountForUi(card: CardDef): number | null {
  if (!isZeroEnergyHpPlayCostCard(card)) {
    return null;
  }
  return sumSelfDamageInEffects(card);
}
