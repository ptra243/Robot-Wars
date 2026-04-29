/**
 * Pilot definitions.
 *
 * Each pilot's traits are referenced by ID — the full label, text, and hook
 * implementations live in `src/core/traits.ts`. To look up display info for a
 * trait use `TRAIT_REGISTRY[traitId]` from that module.
 */

export interface PilotDef {
  id: string;
  name: string;
  flavor: string;
  faction: string;
  /** Trait IDs for each tier. These must match keys in TRAIT_REGISTRY. */
  traitIds: {
    base: string;
    aw0: string;
    aw1: string;
  };
}

export const PILOT_DEFS: PilotDef[] = [
  {
    id: 'glint',
    name: 'Glint',
    flavor: 'Born under a lucky star. When things go wrong, they sometimes go right.',
    faction: 'scavengers',
    traitIds: {
      base: 'glint_base',
      aw0: 'glint_aw0',
      aw1: 'glint_aw1',
    },
  },
  {
    id: 'baron_von_boar',
    name: 'Baron von Boar',
    flavor: 'Every table has a house. Every house has an owner.',
    faction: 'scavengers',
    traitIds: {
      base: 'baron_base',
      aw0: 'baron_aw0',
      aw1: 'baron_aw1',
    },
  },
  {
    id: 'rust_ranger',
    name: 'Rust Ranger',
    flavor: 'Law of the wasteland is enforced one junk shell at a time.',
    faction: 'scavengers',
    traitIds: {
      base: 'rust_ranger_base',
      aw0: 'rust_ranger_aw0',
      aw1: 'rust_ranger_aw1',
    },
  },
  {
    id: 'seiryu',
    name: 'Seiryu',
    flavor: 'Azure discipline. Charge the storm, then cut once.',
    faction: 'cyberpunk',
    traitIds: {
      base: 'seiryu_base',
      aw0: 'seiryu_aw0',
      aw1: 'seiryu_aw1',
    },
  },
  {
    id: 'suzaku',
    name: 'Suzaku',
    flavor: 'Vermilion velocity. Stay airborne and weaponize tempo.',
    faction: 'cyberpunk',
    traitIds: {
      base: 'suzaku_base',
      aw0: 'suzaku_aw0',
      aw1: 'suzaku_aw1',
    },
  },
  {
    id: 'byakko',
    name: 'Byakko',
    flavor: 'White tiger execution. Expose, overclock, finish.',
    faction: 'cyberpunk',
    traitIds: {
      base: 'byakko_base',
      aw0: 'byakko_aw0',
      aw1: 'byakko_aw1',
    },
  },
  {
    id: 'genbu',
    name: 'Genbu',
    flavor: 'Black shell doctrine. Fortify, endure, retaliate.',
    faction: 'cyberpunk',
    traitIds: {
      base: 'genbu_base',
      aw0: 'genbu_aw0',
      aw1: 'genbu_aw1',
    },
  },
];

export function getPilotById(id: string): PilotDef | undefined {
  return PILOT_DEFS.find((p) => p.id === id);
}

/** Pilot portrait for UI (paths under /public). */
export const PILOT_PORTRAITS: Record<string, string> = {
  glint: '/poc/poc-glint.png',
  baron_von_boar: '/poc/poc-baron-von-boar.png',
  rust_ranger: '/poc/poc-rust-ranger.png',
  seiryu: '/poc/poc-card-cyberpunk-dragon.png',
  suzaku: '/poc/poc-card-cyberpunk-bird.png',
  byakko: '/poc/poc-card-cyberpunk-tiger.png',
  genbu: '/poc/poc-card-cyberpunk-tortoise.png',
};

export function getPilotPortraitUrl(pilotId: string): string {
  return PILOT_PORTRAITS[pilotId] ?? PILOT_PORTRAITS.glint;
}

/** Full-screen backgrounds for pilot select & travel (paths under /public). */
export const PILOT_SELECT_BACKGROUNDS: Record<string, string> = {
  glint: '/pilot-select-bg.png',
  baron_von_boar: '/baron-pilot-select-bg.png',
  rust_ranger: '/rust-ranger-pilot-select-bg.png',
  seiryu: '/pilot-select-bg.png',
  suzaku: '/pilot-select-bg.png',
  byakko: '/pilot-select-bg.png',
  genbu: '/pilot-select-bg.png',
};

export function getPilotSelectBackgroundUrl(pilotId: string): string {
  return PILOT_SELECT_BACKGROUNDS[pilotId] ?? PILOT_SELECT_BACKGROUNDS.glint;
}

/** Player mech sprite in battle POC (paths under /public). */
export const PILOT_MECH_SPRITES: Record<string, string> = {
  glint: '/poc/poc-mech-glint-sprite.png',
  baron_von_boar: '/poc/poc-mech-baron-von-boar-sprite.png',
  /** Placeholder until Rust Ranger battle sprite exists. */
  rust_ranger: '/poc/poc-mech-glint-sprite.png',
  seiryu: '/poc/poc-mech-enemy-sprite.png',
  suzaku: '/poc/poc-mech-enemy-sprite.png',
  byakko: '/poc/poc-mech-enemy-sprite.png',
  genbu: '/poc/poc-mech-enemy-sprite.png',
};

export function getPilotMechSpriteUrl(pilotId: string): string {
  return PILOT_MECH_SPRITES[pilotId] ?? PILOT_MECH_SPRITES.glint;
}
