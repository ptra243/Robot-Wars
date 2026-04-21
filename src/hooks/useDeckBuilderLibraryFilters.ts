import { useState, type Dispatch, type SetStateAction } from 'react';
import type { LibraryFactionFilter, LibraryTagFilter } from '../ui/libraryFilters';

export function useDeckBuilderLibraryFilters(): {
  librarySearch: string;
  setLibrarySearch: Dispatch<SetStateAction<string>>;
  libraryFactionFilter: LibraryFactionFilter;
  setLibraryFactionFilter: Dispatch<SetStateAction<LibraryFactionFilter>>;
  libraryTagFilter: LibraryTagFilter;
  setLibraryTagFilter: Dispatch<SetStateAction<LibraryTagFilter>>;
  libraryTierIndexByBase: Record<string, number>;
  setLibraryTierIndexByBase: Dispatch<SetStateAction<Record<string, number>>>;
} {
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryFactionFilter, setLibraryFactionFilter] = useState<LibraryFactionFilter>(null);
  const [libraryTagFilter, setLibraryTagFilter] = useState<LibraryTagFilter>(null);
  const [libraryTierIndexByBase, setLibraryTierIndexByBase] = useState<Record<string, number>>({});

  return {
    librarySearch,
    setLibrarySearch,
    libraryFactionFilter,
    setLibraryFactionFilter,
    libraryTagFilter,
    setLibraryTagFilter,
    libraryTierIndexByBase,
    setLibraryTierIndexByBase,
  };
}
