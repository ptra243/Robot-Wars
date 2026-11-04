# Card art guide

How to make card art that stays consistent. **One image per card**, generated in Grok from a shared style block and the same reference images every time.

This replaces shared master plates with crops ([card-art-plates.md](card-art-plates.md)). Plates put many subjects in one wide image, then zoomed in on guessed coordinates. In practice most crops landed on the wrong thing: on the Junk Hoard plate, Junk Spigot showed a cape and Junk Crown showed sky. The plate crops that work are kept; the rest are marked `replace` and give way automatically when a card gets its own image.

## Where things live

| What | Where |
|------|-------|
| Style bible: shared style, framing, avoid-list, faction palettes and backdrops, reference images, mech casts | `src/data/cardArtStyle.json` |
| One-line brief per card: what its image shows | `src/data/cardArtBriefs.json` |
| Card images, named `<base_id>.png` (or `.jpg`/`.webp`) | `public/art/cards/` |
| Which cards have their own image (generated, don't edit) | `src/data/cardArt.json` |
| Art lookup: own image → plate crop → fallback | `src/ui/cardArtPlates.ts` (`resolveCardArt`) |

Tiers share art, so `junk_gasket_t1` to `_t3` all use `public/art/cards/junk_gasket.png`.

## Commands

```bash
npm run art:prompts                  # art-out/prompts.md — Grok prompt for every card still needing art
npm run art:prompts -- junk_gasket   # print one card's prompt
npm run art:sync                     # after adding images: update src/data/cardArt.json
npm run art:sheet                    # art-out/contact-sheet.html — every card's art as the game crops it
```

`art-out/` is git-ignored.

## The template

Every prompt has the same parts. Only **Subject** changes per card.

- **Subject** — from the card's brief, plus the mech's description when a specific mech appears (`cast`).
- **Style** — anime 2D key visual, cel-shaded, crisp linework, rim light.
- **Colours** — the faction palette.
- **Background** — the faction backdrop, the same for every card in that faction.
- **Framing** — square image, one subject centred in the middle 60%, margin on every side.
- **Avoid** — no text, no frame, not photoreal.

**Why square with a centred subject:** the game shows card art in a 16:10 window (library, popover) and a 3:4 window (queue). A square image with the subject in the middle survives both crops. The contact sheet shows both windows for every card.

## Workflow in Grok

1. **Make one anchor card per faction.** Pick a simple card, run `npm run art:prompts -- <id>`, attach the listed reference images, and generate at 1:1. Regenerate until it is exactly the look you want.
2. **Lock it.** Save it as `public/art/cards/<id>.png`, set `"anchor": "<id>"` for that faction in `cardArtStyle.json`, and run `npm run art:sync`.
3. **Make the rest from the anchor.** From now on each prompt lists the anchor as the first reference and adds an **edit** prompt: attach the anchor and ask Grok to replace only the subject. This keeps background, lighting and framing far more consistent than generating from scratch. Grok seeds are not reproducible, so references are what hold the style.
4. **Save, sync, check.** Save each image as `public/art/cards/<base_id>.png`, run `npm run art:sync`, then `npm run art:sheet` and open the sheet. Reject anything with text, the wrong palette, or a subject that isn't obvious in both windows.

Batch by faction: do all of one faction's cards in one sitting with the same anchor.

## Writing briefs

A brief says what the picture **shows**, in one line: an object or action someone could recognise at card size.

- Good: "A large brass gasket ring glowing faintly cyan"
- Too vague: "Junk synergy"
- Too busy: "Rust Ranger standing on a junk pile while a spigot pours scrap and a crown sits on top"

Add `"cast": "glint"` (or `rust_ranger`, `father_time`, `seiryu`, `baron`) when a specific mech must appear. Its description is added to the prompt and its image is attached as a reference.

Cards without a brief get a **DRAFT** subject built from the name and rules text. Write real briefs before generating.

## Changing the style

Edit `cardArtStyle.json` and re-run `npm run art:prompts`. Never hand-edit wording in one card's prompt; the shared wording is what keeps cards consistent.

## Rules for AI agents (Cursor, Claude)

- Don't invent crop coordinates or pick a "focus area" of an image without looking at it. New art is one image per card, not a crop.
- Don't add new master plates.
- Get prompts from `npm run art:prompts`; add or improve subjects in `cardArtBriefs.json`.
- After adding images run `npm run art:sync`, then `npm run art:sheet`, and ask the person to check the sheet.
- When a card's own image replaces a `replace` plate crop, the crop entry can stay; the per-card image wins.
