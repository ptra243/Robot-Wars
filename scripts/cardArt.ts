/**
 * Card art tooling. See docs/card-art-guide.md.
 *
 *   npm run art:prompts                 → art-out/prompts.md for every card that still needs art
 *   npm run art:prompts -- junk_gasket  → print the Grok prompt(s) for specific base card ids
 *   npm run art:sync                    → rebuild src/data/cardArt.json from public/art/cards/
 *   npm run art:sheet                   → art-out/contact-sheet.html: every card's art as the game shows it
 *
 * Style wording lives in src/data/cardArtStyle.json and per-card subjects in
 * src/data/cardArtBriefs.json, so every prompt shares the same style block.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { CardCatalog, CardDef } from '../src/core/types';
import { getCardBaseIdForArt, listPlateCrops, type PlateArtResolve } from '../src/ui/cardArtPlates';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');
const cardArtDir = join(publicDir, 'art/cards');
const manifestPath = join(root, 'src/data/cardArt.json');
const outDir = join(root, 'art-out');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);

// ---------- data ----------

type FactionStyle = {
  label: string;
  palette: string;
  backdrop: string;
  references: string[];
  /** Base card id of the approved anchor card for this faction, once chosen. */
  anchor: string | null;
};
type StyleBible = {
  generator: { name: string; aspectRatio: string; resolution: string; maxReferenceImages: number };
  shared: { style: string; framing: string; avoid: string };
  factions: Record<string, FactionStyle>;
  casts: Record<string, { description: string; reference: string }>;
};
type Brief = { subject: string; cast?: string };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as T;
}

const style = readJson<StyleBible>('src/data/cardArtStyle.json');
const briefs = readJson<{ cards: Record<string, Brief> }>('src/data/cardArtBriefs.json').cards;
const descriptions = readJson<{ byCardId: Record<string, { compact: string }> }>(
  'src/data/cardDescriptions.json',
).byCardId;

function walkJson(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((ent) => {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) return walkJson(p);
    return ent.name.endsWith('.json') ? [p] : [];
  });
}

type ArtCard = {
  baseId: string;
  name: string;
  faction: string;
  rules: string;
  firstTierId: string;
};

/** One entry per base card id (tiers share art), named after its lowest tier. */
function loadArtCards(): ArtCard[] {
  const byBase = new Map<string, CardDef>();
  for (const path of walkJson(join(root, 'src/data/cards'))) {
    for (const card of (JSON.parse(readFileSync(path, 'utf8')) as CardCatalog).cards) {
      const base = getCardBaseIdForArt(card.id);
      const prev = byBase.get(base);
      if (!prev || card.card_tier < prev.card_tier) byBase.set(base, card);
    }
  }
  return [...byBase.entries()]
    .map(([baseId, card]) => ({
      baseId,
      name: card.name.replace(/\++$/, ''),
      faction: card.neutral ? 'neutral' : card.faction,
      rules: (descriptions[card.id]?.compact ?? '').replace(/\*\*/g, '').replace(/\n+/g, ' · '),
      firstTierId: card.id,
    }))
    .sort((a, b) => a.faction.localeCompare(b.faction) || a.name.localeCompare(b.name));
}

function readManifest(): Record<string, string> {
  return (JSON.parse(readFileSync(manifestPath, 'utf8')) as { cards: Record<string, string> }).cards;
}

const plates = new Map<string, PlateArtResolve>(listPlateCrops().map((p) => [p.baseId, p.plate]));

type ArtStatus = 'own' | 'plate-keep' | 'plate-replace' | 'core-placeholder' | 'none';

function statusOf(card: ArtCard, manifest: Record<string, string>): ArtStatus {
  if (manifest[card.baseId]) return 'own';
  const plate = plates.get(card.baseId);
  if (plate) return plate.review === 'keep' ? 'plate-keep' : 'plate-replace';
  if (/^(core_tap|core_refactoring|core_rebirth|deep_core_tap|sacrif_)/.test(card.firstTierId)) {
    return 'core-placeholder';
  }
  return 'none';
}

/** Map.groupBy needs Node 21+; Vite 8 still supports Node 20.19. */
function groupByFaction(cards: ArtCard[]): Map<string, ArtCard[]> {
  const out = new Map<string, ArtCard[]>();
  for (const c of cards) out.set(c.faction, [...(out.get(c.faction) ?? []), c]);
  return out;
}

const NEEDS_ART: ReadonlySet<ArtStatus> = new Set(['plate-replace', 'core-placeholder', 'none']);

// ---------- prompts ----------

function subjectFor(card: ArtCard): { subject: string; draft: boolean; cast?: string } {
  const brief = briefs[card.baseId];
  if (brief) return { subject: brief.subject, draft: false, cast: brief.cast };
  return {
    subject: `An object or action that shows "${card.name}" at a glance (card text: ${card.rules})`,
    draft: true,
  };
}

function promptFor(card: ArtCard, manifest: Record<string, string>): string {
  const faction = style.factions[card.faction] ?? style.factions.neutral;
  const { subject, draft, cast } = subjectFor(card);
  const castInfo = cast ? style.casts[cast] : undefined;
  const anchorPath = faction.anchor ? manifest[faction.anchor] : undefined;

  const refs = [
    ...(anchorPath ? [`public${anchorPath}  (anchor card: match its style and lighting)`] : []),
    ...(castInfo ? [`${castInfo.reference}  (this mech appears: keep its design)`] : []),
    ...faction.references.map((r) => `${r}  (faction style reference)`),
  ];
  // First mention of a file wins, so the anchor and the cast keep their stronger labels.
  const seen = new Set<string>();
  const uniqueRefs = refs
    .filter((r) => {
      const path = r.split('  ')[0];
      if (seen.has(path)) return false;
      seen.add(path);
      return true;
    })
    .slice(0, style.generator.maxReferenceImages);
  const missing = uniqueRefs.filter((r) => !existsSync(join(root, r.split('  ')[0])));

  const sentence = (s: string) => s.trim().replace(/\.+$/, '');
  const subjectLine = castInfo
    ? `${sentence(subject)}. ${sentence(castInfo.description)}`
    : sentence(subject);
  const lowerFirst = subjectLine.charAt(0).toLowerCase() + subjectLine.slice(1);
  const newPrompt = [
    `Subject: ${subjectLine}.`,
    `Style: ${style.shared.style}`,
    `Colours: ${faction.palette}`,
    `Background: ${faction.backdrop}`,
    `Framing: ${style.shared.framing}`,
    `Avoid: ${style.shared.avoid}`,
  ].join('\n');

  const lines = [
    `### ${card.name} — \`${card.baseId}\` (${faction.label})`,
    '',
    `Card text: ${card.rules || '—'}`,
    draft ? '\n> **DRAFT subject** — write a real one in `src/data/cardArtBriefs.json` first.' : '',
    '',
    `**Grok settings:** aspect ratio ${style.generator.aspectRatio}, ${style.generator.resolution}`,
    '',
    `**Attach these reference images:**`,
    ...uniqueRefs.map((r) => `- ${r}`),
    ...missing.map((r) => `- ⚠ missing file: ${r.split('  ')[0]}`),
    '',
    '**Prompt (new image):**',
    '```text',
    newPrompt,
    '```',
  ];
  if (anchorPath) {
    lines.push(
      '',
      '**Prompt (edit the anchor card instead, usually more consistent):** attach the anchor card first, then:',
      '```text',
      `Edit this image: replace the subject with ${lowerFirst}. Keep the background, lighting, colours, framing and drawing style exactly the same. ${style.shared.avoid}`,
      '```',
    );
  }
  lines.push(
    '',
    `**Save as:** \`public/art/cards/${card.baseId}.png\` (or .jpg/.webp), then run \`npm run art:sync\`.`,
    '',
  );
  return lines.filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n');
}

function cmdPrompts(ids: string[]): void {
  const cards = loadArtCards();
  const manifest = readManifest();
  if (ids.length > 0) {
    for (const id of ids) {
      const card = cards.find((c) => c.baseId === getCardBaseIdForArt(id));
      if (!card) {
        console.error(`Unknown card id: ${id}`);
        process.exitCode = 1;
        continue;
      }
      console.log(promptFor(card, manifest));
    }
    return;
  }
  const todo = cards.filter((c) => NEEDS_ART.has(statusOf(c, manifest)));
  const drafts = todo.filter((c) => !briefs[c.baseId]).length;
  const byFaction = groupByFaction(todo);
  const body = [
    '# Card art prompts',
    '',
    `Generated by \`npm run art:prompts\`. ${String(todo.length)} cards need art; ${String(drafts)} still have a DRAFT subject.`,
    'Workflow: docs/card-art-guide.md. Make each faction\'s anchor card first.',
    '',
    ...[...byFaction.entries()].flatMap(([faction, list]) => [
      `## ${style.factions[faction]?.label ?? faction} (${String(list.length)})`,
      '',
      ...list.map((c) => promptFor(c, manifest)),
    ]),
  ].join('\n');
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, 'prompts.md');
  writeFileSync(out, body);
  console.log(`Wrote ${relative(root, out)}: ${String(todo.length)} cards need art (${String(drafts)} draft subjects).`);
}

// ---------- sync ----------

function cmdSync(): void {
  const cards = loadArtCards();
  const known = new Set(cards.map((c) => c.baseId));
  mkdirSync(cardArtDir, { recursive: true });
  const files = readdirSync(cardArtDir).filter((f) => IMAGE_EXTS.has(extname(f).toLowerCase()));

  const next: Record<string, string> = {};
  const unknown: string[] = [];
  const duplicates: string[] = [];
  for (const file of files.sort()) {
    const id = file.slice(0, -extname(file).length);
    if (!known.has(id)) {
      unknown.push(file);
      continue;
    }
    if (next[id]) duplicates.push(file);
    else next[id] = `/art/cards/${file}`;
  }

  const prev = readManifest();
  const sorted = Object.fromEntries(Object.entries(next).sort(([a], [b]) => a.localeCompare(b)));
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>;
  manifest.cards = sorted;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const added = Object.keys(sorted).filter((id) => !prev[id]);
  const removed = Object.keys(prev).filter((id) => !(id in sorted));
  console.log(`cardArt.json: ${String(Object.keys(sorted).length)} cards with their own art.`);
  if (added.length) console.log(`  added: ${added.join(', ')}`);
  if (removed.length) console.log(`  removed: ${removed.join(', ')}`);
  if (unknown.length) {
    console.warn(`  ⚠ not a base card id (rename to <base_id>.png, e.g. junk_gasket.png): ${unknown.join(', ')}`);
  }
  if (duplicates.length) console.warn(`  ⚠ duplicate art for the same card, ignored: ${duplicates.join(', ')}`);
}

// ---------- contact sheet ----------

const STATUS_LABEL: Record<ArtStatus, string> = {
  own: 'Own art',
  'plate-keep': 'Plate crop (OK)',
  'plate-replace': 'Plate crop (misses — replace)',
  'core-placeholder': 'Placeholder',
  none: 'No card art yet',
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch] ?? ch);
}

/** Art window markup matching the game: per-card art = cover; plate = forge crop math. */
function artWindow(card: ArtCard, manifest: Record<string, string>, shape: 'wide' | 'tall'): string {
  const own = manifest[card.baseId];
  const toRel = (p: string) => `../public${p}`;
  if (own) return `<div class="win ${shape}" style="background-image:url('${toRel(own)}')"></div>`;
  const plate = plates.get(card.baseId);
  if (plate) {
    const { px, py, zoom } = plate.crop;
    return `<div class="win ${shape} crop" style="--px:${String(px)};--py:${String(py)};--z:${String(zoom)}"><img src="${toRel(plate.url)}" alt=""></div>`;
  }
  return `<div class="win ${shape} empty"><span>no art</span></div>`;
}

function cmdSheet(): void {
  const cards = loadArtCards();
  const manifest = readManifest();
  const counts = new Map<ArtStatus, number>();
  for (const c of cards) counts.set(statusOf(c, manifest), (counts.get(statusOf(c, manifest)) ?? 0) + 1);
  const factions = groupByFaction(cards);

  const sections = [...factions.entries()]
    .map(([faction, list]) => {
      const tiles = list
        .map((c) => {
          const st = statusOf(c, manifest);
          const brief = briefs[c.baseId]?.subject ?? '(no brief)';
          return `<figure class="card ${st}">
  <div class="pair">${artWindow(c, manifest, 'wide')}${artWindow(c, manifest, 'tall')}</div>
  <figcaption><b>${escapeHtml(c.name)}</b> <code>${c.baseId}</code><br><span class="st">${STATUS_LABEL[st]}</span><br><i>${escapeHtml(brief)}</i></figcaption>
</figure>`;
        })
        .join('\n');
      return `<h2>${escapeHtml(style.factions[faction]?.label ?? faction)} <small>${String(list.length)}</small></h2>\n<div class="grid">${tiles}</div>`;
    })
    .join('\n');

  const summary = [...counts.entries()].map(([s, n]) => `${STATUS_LABEL[s]}: ${String(n)}`).join(' · ');
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Card art contact sheet</title>
<style>
  body { font: 13px/1.4 system-ui, sans-serif; margin: 16px; background: #15161a; color: #e6e6e6; }
  h1 { margin: 0 0 4px; } h2 { margin: 28px 0 8px; border-bottom: 1px solid #333; } small { color: #888; }
  .note { color: #aaa; margin: 0 0 8px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .card { margin: 0; padding: 8px; background: #1f2026; border-radius: 6px; border-top: 3px solid #555; }
  .card.own { border-color: #3fb37f; } .card.plate-keep { border-color: #d8b13a; }
  .card.plate-replace, .card.core-placeholder { border-color: #e0603a; } .card.none { border-color: #555; }
  .pair { display: grid; grid-template-columns: 16fr 7.5fr; gap: 6px; align-items: start; }
  .win { position: relative; overflow: hidden; background: #000 center / cover no-repeat; border-radius: 3px; }
  .win.wide { aspect-ratio: 16 / 10; } .win.tall { aspect-ratio: 3 / 4; }
  .win.crop img { position: absolute; left: calc(var(--px) * 100% * (1 - var(--z))); top: calc(var(--py) * 100% * (1 - var(--z)));
    width: calc(var(--z) * 100%); height: calc(var(--z) * 100%); object-fit: cover;
    object-position: calc(var(--px) * 100%) calc(var(--py) * 100%); }
  .win.empty { display: grid; place-items: center; color: #666; background: repeating-linear-gradient(45deg, #222 0 8px, #1a1a1a 8px 16px); }
  figcaption { margin-top: 6px; } code { color: #9ab; font-size: 11px; } .st { color: #bbb; } i { color: #999; }
</style></head><body>
<h1>Card art contact sheet</h1>
<p class="note">${String(cards.length)} cards · ${escapeHtml(summary)}</p>
<p class="note">Each card shows its art in the library's 16:10 window and the queue's 3:4 window. Check: is the subject obvious in both? Do the colours match the faction? Any stray text?</p>
${sections}
</body></html>`;
  mkdirSync(outDir, { recursive: true });
  const out = join(outDir, 'contact-sheet.html');
  writeFileSync(out, html);
  console.log(`Wrote ${relative(root, out)} — open it in a browser. ${summary}`);
}

// ---------- main ----------

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case 'prompts':
    cmdPrompts(args);
    break;
  case 'sync':
    cmdSync();
    break;
  case 'sheet':
    cmdSheet();
    break;
  default:
    console.error('Usage: tsx scripts/cardArt.ts <prompts [ids...] | sync | sheet>');
    process.exitCode = 1;
}
