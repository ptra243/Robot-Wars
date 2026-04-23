/**
 * Regenerates `src/data/cardDescriptions.json` from current card JSON + `buildCardDescription`.
 * Runs automatically before `npm run dev`; manual: `npm run generate:card-descriptions`.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardCatalog, CardDef } from '../src/core/types';
import { normalizeCard } from '../src/core/normalizeCard';
import { validateCatalog } from '../src/core/catalogValidation';
import { buildCardDescription } from '../src/ui/cardText';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const cardsDir = join(root, 'src/data/cards');
const outPath = join(root, 'src/data/cardDescriptions.json');

type ModuleShape = CardCatalog | { default: CardCatalog };
type DescriptionEntry = { full: string; compact: string };

function walkJsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) {
      out.push(...walkJsonFiles(p));
    } else if (ent.name.endsWith('.json')) {
      out.push(p);
    }
  }
  return out;
}

function unwrapModule(moduleValue: ModuleShape): CardCatalog {
  return 'default' in moduleValue ? moduleValue.default : moduleValue;
}

function loadAllRawCards(): CardDef[] {
  const all: CardDef[] = [];
  for (const path of walkJsonFiles(cardsDir)) {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as ModuleShape;
    const catalog = unwrapModule(raw);
    all.push(...catalog.cards);
  }
  validateCatalog(all);
  return all;
}

function applyDescriptionOverrides(byCardId: Record<string, DescriptionEntry>): void {
  // Replace compact fallback boilerplate with the generated full line (usually `Tags: ...`),
  // so card text still communicates something meaningful without glossary context.
  for (const entry of Object.values(byCardId)) {
    if (entry.compact.includes('open Tags in the glossary for rules text.')) {
      entry.compact = entry.full;
    }
  }

  // Shield Conditioning: make retention behavior explicit in both full + compact text.
  byCardId.neutral_shield_conditioning_t1 = {
    full: 'Persistent: for the rest of battle, your Shield retention at round start is x0.75 (you keep 75% instead of the default 50%).\nTags: Shield.',
    compact: 'Persistent: Shield retention x0.75 for the rest of battle.',
  };
  byCardId.neutral_shield_conditioning_t2 = {
    full: 'Persistent: for the rest of battle, your Shield retention at round start is x0.85.\nTags: Shield.',
    compact: 'Persistent: Shield retention x0.85 for the rest of battle.',
  };
  byCardId.neutral_shield_conditioning_t3 = {
    full: 'Persistent: for the rest of battle, your Shield retention at round start is x1.00 (no Shield decay).\nTags: Shield.',
    compact: 'Persistent: Shield retention x1.00 for the rest of battle.',
  };

  // Junk Coil: remove embedded card-name header/extra spacing in generated description.
  byCardId.junk_coil_t1 = {
    full: 'Baseline: +1 Energy\nJunk ≥ 4: Gain Junk equal to your Energy (after the baseline +1)\nJunk ≥ 12: If you can pay 4 Energy — +potency, floor(junk at snapshot ÷ 4)\nTags: Junk, Energy.',
    compact: '+1 Energy\nJunk ≥ 4: Junk gained = your Energy\nJunk ≥ 12: Pay 4 Energy → potency from pile',
  };

  byCardId.neutral_static_clamp_t1 = {
    full: 'Strike 2.\nApply Weaken 2 to the enemy (their outgoing damage is reduced by 1 per stack; one stack decays after each of their turns).\nTags: Strike.',
    compact: 'Strike 2.\nApply Weaken 2.',
  };
  byCardId.neutral_static_clamp_t2 = {
    full: 'Strike 3.\nApply Weaken 3 to the enemy (their outgoing damage is reduced by 1 per stack; one stack decays after each of their turns).\nTags: Strike.',
    compact: 'Strike 3.\nApply Weaken 3.',
  };
  byCardId.neutral_static_clamp_t3 = {
    full: 'Strike 4.\nApply Weaken 4 to the enemy (their outgoing damage is reduced by 1 per stack; one stack decays after each of their turns).\nTags: Strike.',
    compact: 'Strike 4.\nApply Weaken 4.',
  };

  byCardId.neutral_delayed_shell_t1 = {
    full: 'Delayed 1: after 1 combat round, gain Shield 5.\nTags: Shield.',
    compact: 'Delayed 1: gain Shield 5.',
  };
  byCardId.neutral_delayed_shell_t2 = {
    full: 'Delayed 1: after 1 combat round, gain Shield 7.\nTags: Shield.',
    compact: 'Delayed 1: gain Shield 7.',
  };
  byCardId.neutral_delayed_shell_t3 = {
    full: 'Delayed 1: after 1 combat round, gain Shield 9.\nTags: Shield.',
    compact: 'Delayed 1: gain Shield 9.',
  };

  byCardId.neutral_delayed_burst_t1 = {
    full: 'Delayed 2: after 2 combat rounds, deal 6 non-Strike damage.\nTags: Direct.',
    compact: 'Delayed 2: deal 6 damage.',
  };
  byCardId.neutral_delayed_burst_t2 = {
    full: 'Delayed 2: after 2 combat rounds, deal 8 non-Strike damage.\nTags: Direct.',
    compact: 'Delayed 2: deal 8 damage.',
  };
  byCardId.neutral_delayed_burst_t3 = {
    full: 'Delayed 2: after 2 combat rounds, deal 10 non-Strike damage.\nTags: Direct.',
    compact: 'Delayed 2: deal 10 damage.',
  };

  byCardId.neutral_overdrive_slam_t1 = {
    full: 'Strike 8.\nSelf-stun 1 turn after resolving (forced stall on your next activation).\nTags: Strike.',
    compact: 'Strike 8.\nSelf-stun 1 turn.',
  };
  byCardId.neutral_overdrive_slam_t2 = {
    full: 'Strike 10.\nSelf-stun 1 turn after resolving (forced stall on your next activation).\nTags: Strike.',
    compact: 'Strike 10.\nSelf-stun 1 turn.',
  };
  byCardId.neutral_overdrive_slam_t3 = {
    full: 'Strike 12.\nSelf-stun 1 turn after resolving (forced stall on your next activation).\nTags: Strike.',
    compact: 'Strike 12.\nSelf-stun 1 turn.',
  };
}

function main(): void {
  const rawCards = loadAllRawCards();
  const sorted = [...rawCards].sort((a, b) => a.id.localeCompare(b.id));

  const byCardId: Record<string, DescriptionEntry> = {};
  for (const card of sorted) {
    const normalized = normalizeCard(card);
    byCardId[normalized.id] = {
      full: buildCardDescription(normalized),
      compact: buildCardDescription(normalized, { omitTagsAndKeywords: true }),
    };
  }
  applyDescriptionOverrides(byCardId);

  const payload = {
    schemaVersion: 1,
    byCardId,
  };

  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(byCardId).length} card descriptions to ${outPath}`);
}

main();
