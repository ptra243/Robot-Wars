import { publicUrl } from '../../assetUrl';
import { CardContentService } from '../../core/content';
import { buildCardDescription } from '../../ui/cardText';
import { plateArtForCardId, type CardArtCrop } from '../../ui/cardArtPlates';
import { cardArtUrlFromDef } from './forge/forgeCardModel';
import { hpPlayCostAmountForUi } from '../../ui/hpPlayCost';

export const DECK_SIZE = 9;
export const ATTACK_DAMAGE = 6;

export interface BattleCard {
  id: string;
  name: string;
  cost: number;
  /** 0 energy + self-damage in effects: show red HP chip instead of EN. */
  hpPlayCost?: number;
  atk: number;
  /** Shield value when this is primarily a Shield card. */
  def?: number;
  text: string;
  art: string;
  /** Match forge lib / queue art crop for shared plates. */
  artFocus: 'default' | 'cropped';
  artCrop?: CardArtCrop;
  /** Chroma-key knockout for legacy keyed PNGs only (not painted plates). */
  artKeyed?: boolean;
  /** Visual row in expanded chip: Strike (ATK) vs Shield (DEF). */
  statKind: 'strike' | 'shield' | 'other';
  /** Legacy chip flag; no hidden cards in battle preview anymore. */
  fog?: boolean;
  /** Out-of-act program width — not Neutral Basic. */
  locked?: boolean;
}

export function battleCardFromId(id: string, content: CardContentService): BattleCard {
  try {
    const card = content.get(id);
    const hasStrike = card.tags.includes('Strike');
    const hasShield = card.tags.includes('Shield');
    const statKind: BattleCard['statKind'] = hasShield && !hasStrike ? 'shield' : hasStrike ? 'strike' : 'other';
    const atkV = card.base_damage > 0 ? card.base_damage : 0;
    const defV = card.base_block > 0 ? card.base_block : 0;
    const primary = statKind === 'shield' ? defV || atkV : atkV || defV;
    const hpPlay = hpPlayCostAmountForUi(card) ?? undefined;
    const plate = plateArtForCardId(id);
    return {
      id,
      name: card.name,
      cost: card.charge_cost,
      hpPlayCost: hpPlay,
      atk: primary,
      def: statKind === 'shield' && defV > 0 ? defV : undefined,
      text: buildCardDescription(card, { omitTagsAndKeywords: true }),
      art: plate?.url ?? cardArtUrlFromDef(card),
      artFocus: plate ? 'cropped' : 'default',
      artCrop: plate?.crop,
      artKeyed: plate?.keyed,
      statKind,
    };
  } catch {
    return {
      id,
      name: id,
      cost: 1,
      atk: ATTACK_DAMAGE,
      text: `Deal ${String(ATTACK_DAMAGE)} damage.`,
      art: publicUrl('/poc/poc-card-attack.png'),
      artFocus: 'default',
      statKind: 'strike',
    };
  }
}
