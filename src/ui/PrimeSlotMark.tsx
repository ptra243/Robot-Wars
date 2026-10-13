import type { ReactElement } from 'react';
import { primeSlotHoverText } from '../core/clockwork';

interface PrimeSlotMarkProps {
  slotIndex: number;
  traitIds?: readonly string[];
  faction?: string;
  className?: string;
}

/** Small ◈ marker + native tooltip for prime program slots. */
export function PrimeSlotMark({
  slotIndex,
  traitIds = [],
  faction,
  className = '',
}: PrimeSlotMarkProps): ReactElement {
  const tip = primeSlotHoverText(slotIndex, traitIds, faction);
  return (
    <span
      className={['prime-slot-mark', className].filter(Boolean).join(' ')}
      title={tip}
      aria-label={tip}
    >
      ◈
    </span>
  );
}
