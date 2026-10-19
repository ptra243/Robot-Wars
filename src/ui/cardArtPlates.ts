/**
 * Shared master-plate art + per-card crop focals.
 * Crops use normalized focus (px/py 0–1) and zoom (>1), consumed by forge/battle
 * via CSS vars `--bgi-px`, `--bgi-py`, `--bgi-zoom`.
 *
 * Plate composition rule: subject prop + secondary prop + background set-piece
 * large enough for a medium crop (zoom ~1.8–2.3). See docs/card-art-plates.md.
 */

import { publicUrl } from '../assetUrl';

export type CardArtCrop = {
  /** Horizontal focus 0–1 (0 = left edge). */
  px: number;
  /** Vertical focus 0–1 (0 = top edge). */
  py: number;
  /** Scale factor; ~2.5–3.4 for tight prop crops, ~1.8–2.3 for BG set-pieces. */
  zoom: number;
};

export type PlateArtResolve = {
  url: string;
  crop: CardArtCrop;
  /**
   * Legacy reactor PNGs use a bright keyed matte; painted master plates do not.
   * When true, card faces apply the chroma-key SVG filter.
   */
  keyed?: boolean;
};

const N1 = publicUrl('/art/plates/n1-arena-clash.jpg');
const N1B = publicUrl('/art/plates/n1b-multi-fists.jpg');
const N1C = publicUrl('/art/plates/n1c-capacitor-pack.jpg');
const N6 = publicUrl('/art/plates/n6-feint-overdrive.jpg');
const S1 = publicUrl('/art/plates/s1-junk-hoard.jpg');

/** Per-base-id plate + crop. Tiers share the same entry. */
const PLATE_BY_BASE: Record<string, PlateArtResolve> = {
  // N1 Arena Clash — Glint punch (left) vs Father Time barrier (right)
  /** Single impact fist (tight — exclude second gauntlet). */
  neutral_basic_strike: { url: N1, crop: { px: 0.4, py: 0.45, zoom: 3.3 } },
  /** Hex shield only — hard right so Glint fists leave the frame. */
  neutral_barrier: { url: N1, crop: { px: 0.72, py: 0.38, zoom: 3.4 } },
  /** Upper arena dust / stands haze (BG reclaim). */
  neutral_delayed_burst: { url: N1, crop: { px: 0.5, py: 0.14, zoom: 2.05 } },
  /** Lower dust ring at feet (BG reclaim). */
  neutral_delayed_shell: { url: N1, crop: { px: 0.48, py: 0.82, zoom: 2.15 } },

  // N1b Multi-fists
  neutral_multi_strike: { url: N1B, crop: { px: 0.42, py: 0.45, zoom: 2.55 } },

  // N1c Capacitor backpack (canisters sit mid-upper on the pack)
  neutral_capacitor_feed: { url: N1C, crop: { px: 0.5, py: 0.32, zoom: 3.05 } },

  // N6 Feint / Overdrive
  neutral_overdrive_slam: { url: N6, crop: { px: 0.22, py: 0.35, zoom: 2.6 } },
  neutral_feint: { url: N6, crop: { px: 0.68, py: 0.42, zoom: 2.7 } },

  // S1 Junk Hoard — distinct focals so junk cards do not share one full-bleed crop
  junk_loader: { url: S1, crop: { px: 0.12, py: 0.38, zoom: 2.55 } },
  junk_spigot: { url: S1, crop: { px: 0.22, py: 0.62, zoom: 2.7 } },
  junk_ladder: { url: S1, crop: { px: 0.58, py: 0.36, zoom: 2.65 } },
  junk_bulwark: { url: S1, crop: { px: 0.62, py: 0.52, zoom: 2.5 } },
  junk_gasket: { url: S1, crop: { px: 0.4, py: 0.48, zoom: 2.85 } },
  junk_rivet: { url: S1, crop: { px: 0.34, py: 0.58, zoom: 2.9 } },
  junk_coil: { url: S1, crop: { px: 0.48, py: 0.34, zoom: 2.7 } },
  /** Apex FUEL-sign / pile tip — keep distinct from coil mid-spine. */
  junk_crown: { url: S1, crop: { px: 0.55, py: 0.06, zoom: 3.05 } },
  junk_aegis: { url: S1, crop: { px: 0.48, py: 0.42, zoom: 2.45 } },
  junk_generator: { url: S1, crop: { px: 0.72, py: 0.55, zoom: 2.7 } },
  junk_recycle: { url: S1, crop: { px: 0.68, py: 0.68, zoom: 2.55 } },
  field_diode: { url: S1, crop: { px: 0.78, py: 0.72, zoom: 2.95 } },
  heap_battery: { url: S1, crop: { px: 0.82, py: 0.78, zoom: 3.0 } },
  salvage_mantle: { url: S1, crop: { px: 0.36, py: 0.55, zoom: 2.5 } },
  heap_padding: { url: S1, crop: { px: 0.3, py: 0.68, zoom: 2.6 } },
};

/** Legacy core-reactor placeholder (same crop as prior CSS defaults for library). */
const CORE_REACTOR: PlateArtResolve = {
  url: publicUrl('/poc/poc-core-werewolf-mech-reactor-placeholder.png'),
  crop: { px: 0.52, py: 0.38, zoom: 2.68 },
  keyed: true,
};

export function getCardBaseIdForArt(cardId: string): string {
  return cardId.replace(/_t[123]$/, '');
}

export function isCoreSacrificeLineCardId(id: string): boolean {
  return (
    /^(core_tap|core_refactoring|core_rebirth|deep_core_tap)_/.test(id) || /^sacrif_/.test(id)
  );
}

/** Plate + crop for a catalog card id, or undefined if it still uses tag fallback art. */
export function plateArtForCardId(cardId: string): PlateArtResolve | undefined {
  const base = getCardBaseIdForArt(cardId);
  const mapped = PLATE_BY_BASE[base];
  if (mapped) return mapped;
  if (isCoreSacrificeLineCardId(cardId)) return CORE_REACTOR;
  return undefined;
}

/**
 * Inline CSS vars for cropped art containers.
 * Only set `--bgi-zoom-base` here — `--bgi-zoom` is owned by CSS so hover
 * zoom-in/out can clear cleanly without fighting an inline `--bgi-zoom`.
 */
export function artCropCssVars(crop: CardArtCrop): Record<string, string> {
  return {
    '--bgi-px': String(crop.px),
    '--bgi-py': String(crop.py),
    '--bgi-zoom-base': String(crop.zoom),
  };
}
