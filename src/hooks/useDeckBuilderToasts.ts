import { useCallback, useState } from 'react';

const TOAST_MS = 3200;

export function useDeckBuilderToasts(): {
  toasts: Array<{ id: number; message: string }>;
  pushToast: (message: string) => void;
} {
  const [toasts, setToasts] = useState<Array<{ id: number; message: string }>>([]);

  const pushToast = useCallback((message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, TOAST_MS);
  }, []);

  return { toasts, pushToast };
}
