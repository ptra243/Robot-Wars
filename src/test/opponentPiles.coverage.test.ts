import { describe, expect, it } from 'vitest';
import { CardContentService } from '../core/content';
import {
  OPPONENT_THEME_TABLE,
  type OpponentBand,
  type OpponentTheme,
} from '../core/run/opponentDecks';
import { validateDudExcludesFreeEnergy } from '../core/run/opponentCardWeights';

const themes: OpponentTheme[] = [
  'gathering_strike',
  'expose',
  'junk_crown',
  'junk_aegis',
  'core_factory',
];
const bands: OpponentBand[] = ['normal', 'elite', 'boss'];

describe('opponentPiles dud policy', () => {
  const all = CardContentService.loadDefault(1).getAll();
  for (const theme of themes) {
    for (const band of bands) {
      for (const aw of [0, 1] as const) {
        it(`duds exclude free-energy: ${theme} ${String(band)} aw${String(aw)}`, () => {
          const slice = OPPONENT_THEME_TABLE[theme][band][aw]!;
          expect(validateDudExcludesFreeEnergy(slice, all)).toEqual([]);
        });
      }
    }
  }
});
