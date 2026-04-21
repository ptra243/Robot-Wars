interface DeckBuilderToastStackProps {
  toasts: Array<{ id: number; message: string }>;
}

export function DeckBuilderToastStack({ toasts }: DeckBuilderToastStackProps) {
  return (
    <div className="deck-builder-toast-stack" aria-live="polite" aria-relevant="additions text">
      {toasts.map((t) => (
        <div key={t.id} className="deck-builder-toast">
          {t.message}
        </div>
      ))}
    </div>
  );
}
