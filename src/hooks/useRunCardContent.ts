import { useMemo } from 'react';
import { CardContentService } from '../core/content';

export function useRunCardContent(seed: number): CardContentService {
  return useMemo(() => CardContentService.loadDefault(seed), [seed]);
}
