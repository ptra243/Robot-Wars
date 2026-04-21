import type { CSSProperties, ReactNode } from 'react';
import {
  TRADING_CARD_ASPECT_H,
  TRADING_CARD_ASPECT_W,
} from '../ui/tradingCardDimensions';

export interface TradingCardProps {
  children: ReactNode;
  /**
   * Box width. Height is always derived from the fixed aspect ratio.
   * Use a number (px), CSS length, or `100%` with `fill`.
   */
  width?: number | string;
  /** Optional max width (e.g. `min(200px, calc(100vw - 32px))`). */
  maxWidth?: number | string;
  /**
   * When true, the card uses `width: 100%` of the parent and keeps ratio
   * (parent should define width).
   */
  fill?: boolean;
  /** Centered empty/minimal content styling */
  variant?: 'default' | 'placeholder';
  className?: string;
  style?: CSSProperties;
}

/**
 * Reusable trading-card shell: fixed **63:88** aspect ratio at any size.
 * Inner layout uses flex; use `trading-card__*` classes from `App.css`.
 */
export function TradingCard({
  children,
  width,
  maxWidth,
  fill,
  variant = 'default',
  className = '',
  style,
}: TradingCardProps) {
  const sizeStyle: CSSProperties = {};
  if (fill) {
    sizeStyle.width = '100%';
    sizeStyle.maxWidth = '100%';
  } else if (width !== undefined) {
    sizeStyle.width = typeof width === 'number' ? `${width}px` : width;
  }
  if (maxWidth !== undefined) {
    sizeStyle.maxWidth = typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
  }

  return (
    <div
      className={[
        'trading-card',
        fill ? 'trading-card--fill' : '',
        variant === 'placeholder' ? 'trading-card--placeholder' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...sizeStyle,
        aspectRatio: `${TRADING_CARD_ASPECT_W} / ${TRADING_CARD_ASPECT_H}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
