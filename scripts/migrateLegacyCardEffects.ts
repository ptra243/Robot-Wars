/**
 * One-shot: fill `effects` from compileLegacy for cards that don't have a non-empty effects array.
 * Run: npx tsx scripts/migrateLegacyCardEffects.ts
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardCatalog, CardDef } from '../src/core/types';
import { compileLegacyToEffects } from '../src/core/effects/compileLegacy';
import { normalizeCard } from '../src/core/normalizeCard';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

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

function migrate(): void {
  const cardsDir = join(root, 'src/data/cards');
  let files = 0;
  let cardsMigrated = 0;
  let cardsSkipped = 0;

  for (const filePath of walkJsonFiles(cardsDir)) {
    const raw = JSON.parse(readFileSync(filePath, 'utf8')) as CardCatalog;
    if (!raw.cards?.length) continue;
    files += 1;
    let changed = false;
    for (const card of raw.cards) {
      if (card.effects && card.effects.length > 0) {
        cardsSkipped += 1;
        continue;
      }
      const normalized = normalizeCard(card);
      card.effects = compileLegacyToEffects(normalized);
      cardsMigrated += 1;
      changed = true;
    }
    if (changed) {
      writeFileSync(filePath, `${JSON.stringify(raw, null, '\t')}\n`, 'utf8');
    }
  }

  console.log(JSON.stringify({ files, cardsMigrated, cardsSkipped }, null, 2));
}

migrate();
