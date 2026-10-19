export type BattlePresentation = 'classic' | 'phaser';

const STORAGE_KEY = 'robotwars.battlePresentation';

/** Classic CSS battle is the default so an unset option keeps the current fight. */
export function readBattlePresentation(): BattlePresentation {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'phaser' ? 'phaser' : 'classic';
  } catch {
    return 'classic';
  }
}

export function writeBattlePresentation(value: BattlePresentation): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Storage can be unavailable in private mode. The in-memory choice still applies. */
  }
}
