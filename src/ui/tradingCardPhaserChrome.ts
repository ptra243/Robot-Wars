import { ARENA_BATTLE_CURRENT_CARD } from './arenaBattleQueueTokens';
import { shadeFill, type MiniMtgQueueCard } from './arenaQueueUi';

/**
 * Visual match for React `TradingCard` / `.trading-card--chrome` in Phaser mini cards.
 * Keeps the same face/title/art/rules banding as the DOM card shell.
 */
export type TradingChromeTone = 'player' | 'enemy';
export type TradingChromeVariant = 'idle' | 'active' | 'dropHighlight';

/** Core face (≈ #141210). */
const CHROME_FACE = 0x141210;
/** Title band base (≈ #2a2318). */
const CHROME_TITLE = 0x2a2318;
const CHROME_ART = 0x0a0c10;
const CHROME_RULES = 0x141210;

/** Idle / non-current slot border (brighter accent). */
const STROKE_PLAYER_IDLE = 0x3b82f6;
const STROKE_ENEMY_IDLE = 0xef4444;
const STROKE_HIGHLIGHT = 0xfbbf24;

export function paintMiniMtgTradingChrome(
  card: MiniMtgQueueCard,
  tone: TradingChromeTone,
  variant: TradingChromeVariant,
): void {
  const isPlayer = tone === 'player';
  let strokeColor: number;
  if (variant === 'dropHighlight') {
    strokeColor = STROKE_HIGHLIGHT;
  } else if (variant === 'active') {
    strokeColor = isPlayer
      ? ARENA_BATTLE_CURRENT_CARD.strokePlayer
      : ARENA_BATTLE_CURRENT_CARD.strokeEnemy;
  } else {
    strokeColor = isPlayer ? STROKE_PLAYER_IDLE : STROKE_ENEMY_IDLE;
  }
  const strokeW = variant === 'dropHighlight' ? 3 : 2;

  let face = CHROME_FACE;
  if (variant === 'active') {
    face = isPlayer ? 0x1c2838 : 0x2c181c;
  } else if (variant === 'dropHighlight') {
    face = isPlayer ? 0x1e3a5f : 0x3d1f24;
  }

  const titleTint = isPlayer ? shadeFill(CHROME_TITLE, 0.92) : 0x3d2828;
  const rulesTint = shadeFill(CHROME_RULES, isPlayer ? 0.96 : 0.94);

  card.border.setFillStyle(face, 1);
  card.border.setStrokeStyle(strokeW, strokeColor);
  card.titleBg.setFillStyle(titleTint, 1);
  card.artBg.setFillStyle(CHROME_ART, 1);
  card.rulesBg.setFillStyle(rulesTint, 1);

  const labelColor = isPlayer ? '#e8edf5' : '#fde8e8';
  card.titleText.setStyle({ color: labelColor });
  card.rulesText.setStyle({ color: labelColor });
}
