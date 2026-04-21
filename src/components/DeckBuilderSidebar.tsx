import {
  useCallback,
  useEffect,
  useId,
  useState,
  type Dispatch,
  type MouseEvent,
  type ReactElement,
  type SetStateAction,
} from 'react';
import { createPortal } from 'react-dom';
import type { CardContentService } from '../core/content';
import { decodeDeckString, encodeDeckPayload, encodeDeckString, validateDeckComposition } from '../core/run';
import type { RunState } from '../core/types';
import {
  createSavedDeckRecord,
  loadSavedDecksFromStorage,
  mergePayloadIntoRunForEditTarget,
  persistSavedDecks,
  reorderSavedDecks,
  snapshotRunForSave,
  type SavedDeckRecord,
} from '../ui/savedDecksStorage';

function IconSave(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
      <polyline points="17 21 17 13 7 13 7 21" />
      <polyline points="7 3 7 8 15 8" />
    </svg>
  );
}

function IconLoad(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

/** Duplicate / copy (deck code). */
function IconCopyCode(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h8c1.1 0 2 .9 2 2" />
    </svg>
  );
}

/** Clipboard (paste deck code). */
function IconPasteCode(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1Z" />
    </svg>
  );
}

function IconTrash(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

function IconPanelLeft(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

function IconGrip(props: { className?: string }): ReactElement {
  return (
    <svg
      className={props.className}
      width="12"
      height="16"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <circle cx="9" cy="5" r="1.5" />
      <circle cx="15" cy="5" r="1.5" />
      <circle cx="9" cy="12" r="1.5" />
      <circle cx="15" cy="12" r="1.5" />
      <circle cx="9" cy="19" r="1.5" />
      <circle cx="15" cy="19" r="1.5" />
    </svg>
  );
}

interface DeckBuilderSidebarProps {
  run: RunState;
  setRun: Dispatch<SetStateAction<RunState>>;
  content: CardContentService;
  /** Matches Phaser deck builder focus: load/paste apply to player snapshot or enemy plan only. */
  editTarget: 'player' | 'enemy';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToast: (message: string) => void;
  cloneRun: (run: RunState) => RunState;
  /** Fires after modal / prompt / confirm dismisses so Phaser can ignore stray pointer events. */
  onTransientUiClose?: () => void;
}

export function DeckBuilderSidebar({
  run,
  setRun,
  content,
  editTarget,
  open,
  onOpenChange,
  onToast,
  cloneRun,
  onTransientUiClose,
}: DeckBuilderSidebarProps): ReactElement {
  const [decks, setDecks] = useState<SavedDeckRecord[]>(() => loadSavedDecksFromStorage());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newDeckModalOpen, setNewDeckModalOpen] = useState(false);
  const [newDeckName, setNewDeckName] = useState('');
  const newDeckTitleId = useId();

  useEffect(() => {
    persistSavedDecks(decks);
  }, [decks]);

  const handleFlyoutMouseLeave = useCallback(
    (e: MouseEvent<HTMLElement>) => {
      if (newDeckModalOpen) {
        return;
      }
      const next = e.relatedTarget;
      if (next instanceof Node && e.currentTarget.contains(next)) {
        return;
      }
      onOpenChange(false);
    },
    [newDeckModalOpen, onOpenChange],
  );

  const handleCopySavedDeckCode = useCallback(
    async (deck: SavedDeckRecord, e: MouseEvent) => {
      e.stopPropagation();
      const code = encodeDeckPayload(deck.payload);
      try {
        if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(code);
        } else {
          throw new Error('no clipboard');
        }
        onToast(`Copied deck code for “${deck.name}”.`);
      } catch {
        window.prompt('Copy this deck code:', code);
        onTransientUiClose?.();
      }
    },
    [onToast, onTransientUiClose],
  );

  const handleCopyDeckCode = useCallback(async () => {
    const code = encodeDeckString(run);
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        throw new Error('no clipboard');
      }
      onToast('Deck code copied to clipboard.');
    } catch {
      window.prompt('Copy this deck code:', code);
      onTransientUiClose?.();
    }
  }, [onToast, onTransientUiClose, run]);

  const handlePasteDeckCode = useCallback(() => {
    const raw = window.prompt('Paste a deck code (RWDB…):');
    onTransientUiClose?.();
    if (raw == null || raw.trim() === '') {
      return;
    }
    const payload = decodeDeckString(raw);
    if (!payload) {
      onToast('Invalid or outdated deck code.');
      return;
    }
    const merged = cloneRun(run);
    mergePayloadIntoRunForEditTarget(merged, payload, editTarget);
    const deckErr = validateDeckComposition(merged, content);
    setRun(merged);
    onToast(
      deckErr
        ? `${editTarget === 'enemy' ? 'Loaded enemy plan from code' : 'Loaded deck from code'}. Does not meet deck rules: ${deckErr}`
        : editTarget === 'enemy'
          ? 'Loaded enemy plan from code.'
          : 'Loaded deck from code.',
    );
  }, [cloneRun, content, editTarget, onToast, onTransientUiClose, run, setRun]);

  const handleSaveNewOpen = useCallback(() => {
    setNewDeckName('');
    setNewDeckModalOpen(true);
  }, []);

  const handleSaveNewSubmit = useCallback(() => {
    const trimmed = newDeckName.trim();
    if (!trimmed) {
      return;
    }
    const record = createSavedDeckRecord(trimmed, run);
    setDecks((prev) => [...prev, record]);
    setSelectedId(record.id);
    setNewDeckModalOpen(false);
    setNewDeckName('');
    onToast(`Saved new deck “${record.name}”.`);
    onTransientUiClose?.();
  }, [newDeckName, onToast, onTransientUiClose, run]);

  const handleOverwrite = useCallback(
    (deck: SavedDeckRecord, e: React.MouseEvent) => {
      e.stopPropagation();
      const ok = window.confirm(
        `Overwrite saved deck “${deck.name}” with your current builder state?\n\nThis replaces the stored snapshot.`,
      );
      onTransientUiClose?.();
      if (!ok) {
        return;
      }
      setDecks((prev) =>
        prev.map((d) =>
          d.id === deck.id ? { ...d, payload: snapshotRunForSave(run) } : d,
        ),
      );
      onToast(`Updated “${deck.name}”.`);
    },
    [onToast, onTransientUiClose, run],
  );

  const handleLoad = useCallback(
    (deck: SavedDeckRecord, e: React.MouseEvent) => {
      e.stopPropagation();
      const merged = cloneRun(run);
      mergePayloadIntoRunForEditTarget(merged, deck.payload, editTarget);
      const deckErr = validateDeckComposition(merged, content);
      setRun(merged);
      setSelectedId(deck.id);
      onToast(
        deckErr
          ? `${editTarget === 'enemy' ? `Loaded enemy plan from “${deck.name}”` : `Loaded “${deck.name}”`}. Does not meet deck rules: ${deckErr}`
          : editTarget === 'enemy'
            ? `Loaded enemy plan from “${deck.name}”.`
            : `Loaded “${deck.name}”.`,
      );
    },
    [cloneRun, content, editTarget, onToast, run, setRun],
  );

  const handleDelete = useCallback(
    (deck: SavedDeckRecord, e: React.MouseEvent) => {
      e.stopPropagation();
      const ok = window.confirm(`Delete saved deck “${deck.name}”?\n\nThis cannot be undone.`);
      onTransientUiClose?.();
      if (!ok) {
        return;
      }
      setDecks((prev) => prev.filter((d) => d.id !== deck.id));
      setSelectedId((cur) => (cur === deck.id ? null : cur));
      onToast(`Deleted “${deck.name}”.`);
    },
    [onToast, onTransientUiClose],
  );

  const handleRowClick = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDropOnRow = useCallback(
    (toIndex: number) => (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/plain');
      const from = Number(raw);
      if (!Number.isFinite(from) || from === toIndex) {
        return;
      }
      setDecks((prev) => reorderSavedDecks(prev, from, toIndex));
    },
    [],
  );

  const saveModal =
    newDeckModalOpen &&
    createPortal(
      <div
        className="deck-builder-modal-backdrop"
        role="presentation"
        onClick={() => {
          setNewDeckModalOpen(false);
          onTransientUiClose?.();
        }}
      >
        <div
          className="deck-builder-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby={newDeckTitleId}
          onClick={(e) => e.stopPropagation()}
        >
          <h3 id={newDeckTitleId} className="deck-builder-modal__title">
            Save new deck
          </h3>
          <p className="deck-builder-modal__hint">
            Stores your current deck, hand, both plan queues, and sandbox numbers (Q / P / E).
          </p>
          <label className="deck-builder-modal__label">
            Name
            <input
              className="deck-builder-modal__input"
              type="text"
              value={newDeckName}
              onChange={(e) => setNewDeckName(e.target.value)}
              placeholder="My deck"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSaveNewSubmit();
                }
              }}
            />
          </label>
          <div className="deck-builder-modal__actions">
            <button
              type="button"
              className="deck-builder-modal__btn"
              onClick={() => {
                setNewDeckModalOpen(false);
                onTransientUiClose?.();
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className="deck-builder-modal__btn deck-builder-modal__btn--primary"
              onClick={handleSaveNewSubmit}
              disabled={!newDeckName.trim()}
            >
              Save
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );

  if (!open) {
    return (
      <>
        <button
          type="button"
          className="deck-builder-sidebar-expand"
          onClick={() => onOpenChange(true)}
          title="Show saved decks"
          aria-label="Show saved decks"
        >
          <IconPanelLeft />
          <span className="deck-builder-sidebar-expand__label">Decks</span>
        </button>
        {saveModal}
      </>
    );
  }

  return (
    <>
      <aside
        className="deck-builder-sidebar deck-builder-sidebar--flyout"
        aria-label="Saved decks"
        onMouseLeave={handleFlyoutMouseLeave}
      >
        <header className="deck-builder-sidebar__header">
          <h2 className="deck-builder-sidebar__title">Saved decks</h2>
          <div className="deck-builder-sidebar__header-actions">
            <button
              type="button"
              className="deck-builder-sidebar__icon-btn"
              onClick={() => void handleCopyDeckCode()}
              title="Copy deck code (compact, versioned)"
              aria-label="Copy deck code"
            >
              <IconCopyCode />
            </button>
            <button
              type="button"
              className="deck-builder-sidebar__icon-btn"
              onClick={handlePasteDeckCode}
              title="Paste deck code"
              aria-label="Paste deck code"
            >
              <IconPasteCode />
            </button>
            <button
              type="button"
              className="deck-builder-sidebar__icon-btn"
              onClick={handleSaveNewOpen}
              title="Save current as new deck"
              aria-label="Save current as new deck"
            >
              <IconSave />
            </button>
            <button
              type="button"
              className="deck-builder-sidebar__icon-btn"
              onClick={() => onOpenChange(false)}
              title="Hide sidebar"
              aria-label="Hide saved decks sidebar"
            >
              <span className="deck-builder-sidebar__hide-icon" aria-hidden>
                «
              </span>
            </button>
          </div>
        </header>
        <ul className="deck-builder-sidebar__list" role="listbox" aria-label="Saved deck list">
          {decks.map((deck, index) => (
            <li
              key={deck.id}
              role="option"
              aria-selected={selectedId === deck.id}
              className={`deck-builder-sidebar__row${selectedId === deck.id ? ' deck-builder-sidebar__row--selected' : ''}`}
              onDragOver={handleDragOver}
              onDrop={handleDropOnRow(index)}
            >
              <span
                className="deck-builder-sidebar__grip"
                draggable
                onDragStart={(e) => handleDragStart(index, e)}
                title="Drag to reorder"
              >
                <IconGrip />
              </span>
              <button
                type="button"
                className="deck-builder-sidebar__row-main"
                onClick={() => handleRowClick(deck.id)}
              >
                <span className="deck-builder-sidebar__name">{deck.name}</span>
              </button>
              <div className="deck-builder-sidebar__row-actions">
                <button
                  type="button"
                  className="deck-builder-sidebar__icon-btn"
                  onClick={(e) => void handleCopySavedDeckCode(deck, e)}
                  title="Copy share code for this saved deck"
                  aria-label={`Copy deck code for ${deck.name}`}
                >
                  <IconCopyCode />
                </button>
                <button
                  type="button"
                  className="deck-builder-sidebar__icon-btn"
                  onClick={(e) => handleOverwrite(deck, e)}
                  title="Overwrite with current builder"
                  aria-label={`Overwrite saved deck ${deck.name}`}
                >
                  <IconSave />
                </button>
                <button
                  type="button"
                  className="deck-builder-sidebar__icon-btn"
                  onClick={(e) => handleLoad(deck, e)}
                  title="Load into builder"
                  aria-label={`Load deck ${deck.name}`}
                >
                  <IconLoad />
                </button>
                <button
                  type="button"
                  className="deck-builder-sidebar__icon-btn deck-builder-sidebar__icon-btn--danger"
                  onClick={(e) => handleDelete(deck, e)}
                  title="Delete saved deck"
                  aria-label={`Delete saved deck ${deck.name}`}
                >
                  <IconTrash />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {decks.length === 0 && (
          <p className="deck-builder-sidebar__empty">No saved decks yet. Use the save icon above.</p>
        )}
      </aside>
      {saveModal}
    </>
  );
}
