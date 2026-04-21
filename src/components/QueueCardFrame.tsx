import type { ReactNode } from 'react';
import { TradingCard } from './TradingCard';

/**
 * Full trading-card layout (title, cost, art, rules) using {@link TradingCard} as the shell.
 * Scales with width while preserving the 63:88 ratio.
 */
export function QueueCardFrame({
  title,
  costContent,
  showCost,
  artPlaceholder = 'Art',
  children,
}: {
  title: string;
  costContent: string;
  showCost: boolean;
  artPlaceholder?: string;
  children: ReactNode;
}) {
  return (
    <TradingCard width="100%" maxWidth="min(200px, calc(100vw - 32px))" className="trading-card--chrome">
      <header className="trading-card__header">
        <span className="trading-card__name">{title}</span>
        <span
          className={
            showCost ? 'trading-card__cost' : 'trading-card__cost trading-card__cost--empty'
          }
        >
          {showCost ? costContent : ''}
        </span>
      </header>
      <div className="trading-card__art" aria-hidden>
        {artPlaceholder}
      </div>
      <div className="trading-card__text">{children}</div>
    </TradingCard>
  );
}
