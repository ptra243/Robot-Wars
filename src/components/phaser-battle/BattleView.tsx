import { useState, type ComponentProps } from 'react';
import { readBattlePresentation } from '../../ui/battlePresentation';
import { BattlePOC } from '../poc/BattlePOC';
import { BattlePhaser } from './BattlePhaser';

type BattleViewProps = ComponentProps<typeof BattlePOC>;

/**
 * Reads the landing battle option once per mount so a fight keeps the
 * renderer it started with.
 */
export function BattleView(props: BattleViewProps) {
  const [presentation] = useState(readBattlePresentation);
  if (presentation === 'phaser') {
    return <BattlePhaser {...props} />;
  }
  return <BattlePOC {...props} />;
}
