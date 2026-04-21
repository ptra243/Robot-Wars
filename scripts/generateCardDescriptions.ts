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

function main(): void {
  const rawCards = loadAllRawCards();
  const sorted = [...rawCards].sort((a, b) => a.id.localeCompare(b.id));

  const byCardId: Record<string, { full: string; compact: string }> = {};
  for (const card of sorted) {
    const normalized = normalizeCard(card);
    byCardId[normalized.id] = {
      full: buildCardDescription(normalized),
      compact: buildCardDescription(normalized, { omitTagsAndKeywords: true }),
    };
  }

  const payload = {
    schemaVersion: 1,
    byCardId,
  };

  writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${Object.keys(byCardId).length} card descriptions to ${outPath}`);
}

main();
