import type { DragEvent as ReactDragEvent, MouseEvent as ReactMouseEvent } from 'react';
import type { CardTag, KeywordType } from '../../../core/types';
import type { CardArtCrop } from '../../../ui/cardArtPlates';

/** Faction token used for CSS modifiers (`.forge-poc__slot--${faction}`). */
export type ForgeFaction =
  | 'scavengers'
  | 'neutral'
  | 'overclock'
  | 'aegis'
  | 'cyberpunk'
  | 'clockwork';

export interface ForgeKeyword {
  type: KeywordType;
  value: number;
}

/**
 * Card shape the Forge UI consumes — derived from `CardDef` via
 * `forgeCardFromDef` (see forgeCardModel.ts).
 */
export interface ForgeCard {
  id: string;
  name: string;
  tier: 1 | 2 | 3;
  cost: number;
  /** When set, show red HP play cost instead of EN (0 energy + self-damage in effects). */
  hpPlayCost?: number;
  atk?: number;
  def?: number;
  faction: ForgeFaction;
  tags: CardTag[];
  keywords: ForgeKeyword[];
  art: string;
  /**
   * `cropped` = shared plate / reactor art with zoom via `artCrop` CSS vars.
   * `default` = full `art` URL as cover background.
   */
  artFocus: 'default' | 'cropped';
  /** Required when `artFocus === 'cropped'`. */
  artCrop?: CardArtCrop;
  /** Chroma-key knockout for legacy keyed PNGs only (not painted plates). */
  artKeyed?: boolean;
  blurb: string;
}

export interface Trait {
  id: string;
  name: string;
  /**
   * User-facing awakening rank required to unlock this trait.
   * 0 = base (always active), 1 = Awakening 1 trait, 2 = Awakening 2 trait.
   */
  unlockAt: 0 | 1 | 2;
  blurb: string;
}

export interface DragPayload {
  source: 'hand' | 'queue';
  index: number;
}

export interface ContextMenuState {
  x: number;
  y: number;
  /** Queue slot index (null = whole queue). Undefined when this menu is for a hand card. */
  slotIndex: number | null;
  /** When set, this context menu is for a hand card at this index. */
  handIndex?: number;
}

export interface HoverState {
  card: ForgeCard;
  secondaryCard?: ForgeCard;
  x: number;
  y: number;
  /** Same as x/y — required by pinnable hover helpers. */
  clientX: number;
  clientY: number;
}

export type QueueDragHandler = (e: ReactDragEvent<HTMLElement>) => void;
export type QueueMouseHandler = (e: ReactMouseEvent<HTMLElement>) => void;
