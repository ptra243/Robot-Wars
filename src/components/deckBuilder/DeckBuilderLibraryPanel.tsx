import type { Dispatch, SetStateAction } from 'react';
import type { RunState } from '../../core/types';
import { useGameStore } from '../../stores/gameStore';
import {
  LIBRARY_FACTION_IDS,
  LIBRARY_FILTER_LABELS,
  LIBRARY_TAG_FILTER_ORDER,
  type LibraryFactionFilter,
  type LibraryTagFilter,
  type LibraryTagFilterId,
} from '../../ui/libraryFilters';
import {
  clampActiveSlots,
  clampSandboxCore,
  SANDBOX_ACTIVE_SLOTS_MAX,
  SANDBOX_ACTIVE_SLOTS_MIN,
  SANDBOX_CORE_MAX,
} from './deckBuilderSandboxLimits';
interface DeckBuilderLibraryPanelProps {
  run: RunState;
  librarySearch: string;
  onLibrarySearchChange: (value: string) => void;
  libraryFactionFilter: LibraryFactionFilter;
  setLibraryFactionFilter: Dispatch<SetStateAction<LibraryFactionFilter>>;
  libraryTagFilter: LibraryTagFilter;
  setLibraryTagFilter: Dispatch<SetStateAction<LibraryTagFilter>>;
}

export function DeckBuilderLibraryPanel({
  run,
  librarySearch,
  onLibrarySearchChange,
  libraryFactionFilter,
  setLibraryFactionFilter,
  libraryTagFilter,
  setLibraryTagFilter,
}: DeckBuilderLibraryPanelProps) {
  const handleSetSandboxActiveQueueSlots = useGameStore((s) => s.handleSetSandboxActiveQueueSlots);
  const handleSetSandboxPlayerCoreScrap = useGameStore((s) => s.handleSetSandboxPlayerCoreScrap);
  const handleSetSandboxEnemyCoreScrap = useGameStore((s) => s.handleSetSandboxEnemyCoreScrap);
  return (
    <div className="deck-builder-library-panel" aria-label="Library filters and search">
      <div className="deck-builder-library-toolbar">
        <div className="deck-builder-library-toolbar__filters-row">
          <div
            className="deck-builder-library-toolbar__chip-group deck-builder-library-toolbar__chip-group--faction"
            role="group"
            aria-label="Faction filter"
          >
            <button
              type="button"
              className={`deck-builder-tag-btn${libraryFactionFilter === null ? ' deck-builder-tag-btn--active' : ''}`}
              onClick={() => setLibraryFactionFilter(null)}
            >
              All
            </button>
            {LIBRARY_FACTION_IDS.map((id) => (
              <button
                key={id}
                type="button"
                className={`deck-builder-tag-btn${libraryFactionFilter === id ? ' deck-builder-tag-btn--active' : ''}`}
                onClick={() => setLibraryFactionFilter((cur) => (cur === id ? null : id))}
              >
                {LIBRARY_FILTER_LABELS[id]}
              </button>
            ))}
          </div>
          <div className="deck-builder-library-toolbar__divider" aria-hidden="true" />
          <div
            className="deck-builder-library-toolbar__chip-group deck-builder-library-toolbar__chip-group--tags"
            role="group"
            aria-label="Tag and mechanic filters"
          >
            <button
              type="button"
              className={`deck-builder-tag-btn${libraryTagFilter === null ? ' deck-builder-tag-btn--active' : ''}`}
              onClick={() => setLibraryTagFilter(null)}
            >
              All
            </button>
            {LIBRARY_TAG_FILTER_ORDER.map((id: LibraryTagFilterId) => (
              <button
                key={id}
                type="button"
                className={`deck-builder-tag-btn${libraryTagFilter === id ? ' deck-builder-tag-btn--active' : ''}`}
                onClick={() => setLibraryTagFilter((cur) => (cur === id ? null : id))}
              >
                {LIBRARY_FILTER_LABELS[id]}
              </button>
            ))}
          </div>
        </div>
        <input
          className="deck-builder-library-search"
          type="search"
          placeholder="Search card names…"
          value={librarySearch}
          onChange={(e) => onLibrarySearchChange(e.target.value)}
          aria-label="Search cards by name"
        />
        <div
          className="deck-builder-sandbox-refined"
          role="group"
          aria-label="Starting refined scrap for the next combat"
        >
          <span className="deck-builder-library-toolbar__label">Start refined</span>
          <label className="deck-builder-sandbox-refined__field">
            <span className="deck-builder-sandbox-refined__abbr" title="Active queue slots in battle">
              Q
            </span>
            <input
              className="deck-builder-sandbox-refined__input"
              type="number"
              min={SANDBOX_ACTIVE_SLOTS_MIN}
              max={SANDBOX_ACTIVE_SLOTS_MAX}
              inputMode="numeric"
              value={run.sandboxActiveQueueSlots}
              onChange={(e) => {
                const raw = e.target.value;
                const next = raw === '' ? SANDBOX_ACTIVE_SLOTS_MAX : clampActiveSlots(Number(raw));
                handleSetSandboxActiveQueueSlots(next);
              }}
              aria-label="Active queue slots used in battle"
            />
          </label>
          <label className="deck-builder-sandbox-refined__field">
            <span className="deck-builder-sandbox-refined__abbr" title="Player">
              P
            </span>
            <input
              className="deck-builder-sandbox-refined__input"
              type="number"
              min={0}
              max={SANDBOX_CORE_MAX}
              inputMode="numeric"
              value={run.sandboxPlayerCoreScrap}
              onChange={(e) => {
                const raw = e.target.value;
                const next = raw === '' ? 0 : clampSandboxCore(Number(raw));
                handleSetSandboxPlayerCoreScrap(next);
              }}
              aria-label="Player starting refined scrap"
            />
          </label>
          <label className="deck-builder-sandbox-refined__field">
            <span className="deck-builder-sandbox-refined__abbr" title="Enemy">
              E
            </span>
            <input
              className="deck-builder-sandbox-refined__input"
              type="number"
              min={0}
              max={SANDBOX_CORE_MAX}
              inputMode="numeric"
              value={run.sandboxEnemyCoreScrap}
              onChange={(e) => {
                const raw = e.target.value;
                const next = raw === '' ? 0 : clampSandboxCore(Number(raw));
                handleSetSandboxEnemyCoreScrap(next);
              }}
              aria-label="Enemy starting refined scrap"
            />
          </label>
        </div>
      </div>
    </div>
  );
}
