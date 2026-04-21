import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * After `pinMs` of continuous hover on the same logical card (see `getIdentityKey`), pins that
 * card as the modal body. Hovering a **different** card for `pinMs` **replaces** the pinned card.
 * While `pausePinTimer` is true (e.g. pointer over the card modal), the timer does not advance.
 */
export function usePinnableCardHover<T extends { clientX: number; clientY: number }>(
  hover: T | null,
  getIdentityKey: (h: T) => string,
  pinMs = 1000,
  pausePinTimer = false,
): {
  displayHover: T | null;
  pinned: boolean;
  dismissPin: () => void;
} {
  const [pinned, setPinned] = useState<T | null>(null);
  const [pinCycle, setPinCycle] = useState(0);

  const hoverRef = useRef(hover);
  hoverRef.current = hover;

  const pauseRef = useRef(pausePinTimer);
  pauseRef.current = pausePinTimer;

  const getKeyRef = useRef(getIdentityKey);
  getKeyRef.current = getIdentityKey;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const identityKey = hover ? getIdentityKey(hover) : null;

  const dismissPin = useCallback(() => {
    setPinned(null);
    setPinCycle((c) => c + 1);
  }, []);

  useEffect(() => {
    if (pausePinTimer) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    if (!identityKey) {
      return;
    }

    if (pinned && getKeyRef.current(pinned) === identityKey) {
      return;
    }

    const targetKey = identityKey;
    timerRef.current = setTimeout(() => {
      if (pauseRef.current) {
        return;
      }
      const h = hoverRef.current;
      if (!h) {
        return;
      }
      if (getKeyRef.current(h) !== targetKey) {
        return;
      }
      setPinned({ ...h });
    }, pinMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [identityKey, pinned, pinCycle, pinMs, pausePinTimer]);

  const displayHover = pinned ?? hover;

  return {
    displayHover,
    pinned: pinned !== null,
    dismissPin,
  };
}
