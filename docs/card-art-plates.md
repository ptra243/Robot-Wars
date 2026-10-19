# Card art plates (hero kits → Neutral + Scavenger)

Art pipeline for **shared master plates** with per-card crops. Neutrals cast cross-faction mechs; Scavenger plates own scrap/junk identity.

**Aesthetic:** **anime / 2D key visual** — stylized, cel-shaded or clean anime illustration. Match the locked Rust Ranger look. **Not** photoreal, cinematic live-action, or Western concept-art realism.

**Scope:** Neutral + Scavenger uniques only (~22 Neutral, ~35 Scavenger). Tiers (`_t1`/`_t2`/`_t3`) **share** art — never unique art per tier.

**Wired crops:** [`src/ui/cardArtPlates.ts`](../src/ui/cardArtPlates.ts) (`plateArtForCardId`) → forge library / queue / battle chips via `artFocus: 'cropped'`.

### Background-as-crop rule

Tight prop zooms must not waste the plate. Every master plate needs **three focal layers**:

1. Primary subject prop (fist / shield / backpack / slam arms)
2. Secondary prop (second fist, afterimage, revolver)
3. **Background set-piece** large enough for a medium crop (`zoom` ~1.8–2.3) — arena sigil, stands haze, dust ring, skyline, floodlights

Prompts must name the BG focal the same way they name the fist. Assign leftover Neutrals to BG crops when the fantasy is atmosphere/setup (e.g. Delayed Burst / Delayed Shell on N1 stands/dust).

---

## Commission order (gates)

```text
1. Phase 0 — Hero kits
   ├─ Scavengers / Rust Ranger ………… DONE
   ├─ Clockwork / Father Time ……… DONE (v1)
   └─ Cyberpunk / Seiryu …………… DONE (v1)
        │
        ├─ Phase 2 Scavenger plates S1–S5 …… in progress / next
        └─ Phase 1 Neutral plates N1–N5 ……… unlocked (kits ready)
```

| Order | Deliverable | Depends on | Can start now? |
|------:|---------------|------------|----------------|
| 0a | Lock Rust Ranger palette/props notes (below) | Existing assets | Done |
| 0b | Father Time portrait + mech hero | — | Done (v1) |
| 0c | Seiryu portrait + mech hero | — | Done (v1) |
| 2 | Scavenger plates S1–S5 | Rust Ranger kit | Yes |
| 1 | Neutral plates N1–N5 | Hero kits | Yes |
| 3 | Per-card crop rectangles marked on finals | Each plate | After each plate lands |

**Rules**

1. One master image per plate (wide, readable focal props).
2. Tiers share art; tier badges handle + / ++.
3. Prefer cross-faction casts on Neutrals (never Scavenger-only).
4. After generation, mark named crop regions in this doc (or a sibling crop sheet).

---

## Phase 0 — Faction hero kits

Ship **one face per faction** before Neutral plates. Expand other pilots later.

| Faction | Face | Status | Deliverables |
|---------|------|--------|--------------|
| Scavengers | Rust Ranger | **Done** | Portrait + mech + select BG locked |
| Clockwork | Father Time | **Done (v1)** | Portrait + mech hero locked below |
| Cyberpunk | Seiryu | **Done (v1)** | Portrait + mech hero locked below |

Each kit must support:

1. **Portrait crop** — HUD / pilot select  
2. **Mech cast** — recognizable in Neutral fight scenes  
3. **Style bible slice** — lighting, palette, silhouette rules  

### Scavengers — Rust Ranger (locked)

Do **not** regenerate. Use as reference sheets (img2img / style reference where supported).

| Asset | Path |
|-------|------|
| Pilot portrait | `public/poc/poc-rust-ranger.png` |
| Pilot select BG | `public/rust-ranger-pilot-select-bg.png` |
| Mech hero | `public/RustRanger_Mech.png` |
| Wired in | `src/core/pilots.ts` → `PILOT_PORTRAITS.rust_ranger` |

**Palette (from locked art)**

| Token | Notes |
|-------|--------|
| Armor orange | Bright weathered orange / rust plates |
| Understructure | Charcoal / dark grey joints, pistons, wiring |
| Energy | Electric cyan-blue slits, nodes, arm cores |
| Soft goods | Brown leather hat, tattered reddish-brown duster/cape, orange bandana |
| Mood light | Warm amber workshop / desert dust; sparks OK |

**Signature props:** cowboy hat, sheriff/gear badges, **dual sci-fi revolvers** (mech — he shoots, he does not punch), copper mechanical arm with blue cores (pilot), scrap workshop clutter.

**Combat fantasy:** gunslinger / revolver fire. Do **not** cast Rust Ranger as the Neutral Basic Strike fist — that role is **Glint**.

**Gap (non-blocking):** battle sprite still falls back to Glint (`PILOT_MECH_SPRITES.rust_ranger`).

### Scavengers — Glint (punch cast)

| Asset | Path |
|-------|------|
| Pilot portrait | `public/poc/poc-glint.png` |
| Mech hero | `public/poc/poc-mech-glint.png` |
| Punch strip (battle + art ref) | `public/poc/poc-mech-glint-punch-strip.png` |

**Signature look:** rabbit-ear antennae, cyan visor, orange copper plates, **purple gauntlets** with electric punch FX.

**Combat fantasy:** lucky brawler / fists. Default cast for Neutral strike / punch focals (Basic Strike, Multi-strike, Feint, Overdrive Slam).

### Clockwork — Father Time (locked v1)

| Asset | Path |
|-------|------|
| Pilot portrait | `public/poc/poc-father-time.jpg` (wired `PILOT_PORTRAITS.father_time`) |
| Mech hero | `public/FatherTime_Mech.jpg` (+ `public/poc/poc-mech-father-time.jpg`) |

| Piece | Spec |
|-------|------|
| Style | Anime 2D key visual |
| Portrait | Mature white/silver hair, pale geometric face markings, teal + brass filigree collar |
| Mech | Brass cathedral automaton; chest clock / metronome; kite shield arm + striking weapon |
| Palette | Deep teal + antique brass / gold; warm candlelight rim |
| Props | Hourglass / clock faces, hymn plates, brass lattice, stained-glass shield panes |
| Still missing | Dedicated pilot-select background (still on clockwork placeholder) |

### Cyberpunk — Seiryu (locked v1)

| Asset | Path |
|-------|------|
| Pilot portrait | `public/poc/poc-seiryu.jpg` (wired `PILOT_PORTRAITS.seiryu`) |
| Mech hero | `public/Seiryu_Mech.jpg` (+ `public/poc/poc-mech-seiryu.jpg`) |

| Piece | Spec |
|-------|------|
| Style | Anime 2D key visual |
| Portrait | Black hair + azure streak, cyan visor, dragon emblem on jacket |
| Mech | Sleek charcoal frame; dragon crest; energy blade + open palm; backpack fins |
| Palette | Black carbon + electric cyan / azure (restrained neon) |
| Props | Dragon crest, blade-arm, palm energy, capacitor / wing fins |
| Still missing | Dedicated pilot-select background (still on generic `pilot-select-bg.png`) |

---

## Casting rules

| Pool | Cast |
|------|------|
| Neutral plates | Prefer **two factions** in frame. Default fight cast: **Glint (left, punch) vs Father Time (right, barrier)**. Mix spare parts across factions on workshop plates. |
| Scavenger plates | Scavenger mechs only. **Rust Ranger** for gun/junk/hoard identity; **Glint** when the beat is fists. |
| Faces on cards | Not required on combat plates — silhouette + props matter more. |

**Role cast cheat-sheet**

| Fantasy | Mech | Notes |
|---------|------|-------|
| Punch / Basic Strike | **Glint** | Purple gauntlets, rabbit ears |
| Multi-strike barrage | **Glint** | Separate multi-fist plate (N1b) |
| Revolver / gunline | **Rust Ranger** | Dual revolvers — never the Neutral fist crop |
| Capacitor pack | **Rust Ranger** | Backpack canisters (N1c) |
| Barrier / hymn defense | **Father Time** | Hex shield — crop must exclude Glint fists |
| Overdrive Slam | **Baron von Boar** | Two-handed overhead (N6) |
| Feint | **Seiryu** | Dodge + forward afterimage (N6) |

---

## Phase 1 — Neutral master plates

~22 uniques. Default fight cast: **Glint (attacker / punch, left) vs Father Time (defender, right)**.

### Plate N1 — Arena Clash

**Master:** `public/art/plates/n1-arena-clash.jpg` (v2) — **Glint** (left) vs Father Time (right).

| Base id | Card | Crop focus | px | py | zoom |
|---------|------|------------|---:|---:|-----:|
| `neutral_basic_strike` | Basic Strike | Single fist / impact | 0.40 | 0.45 | 3.30 |
| `neutral_barrier` | Barrier | Hex shield only (hard right) | 0.72 | 0.38 | 3.40 |
| `neutral_delayed_burst` | Delayed Burst | Upper stands / dust haze (BG) | 0.50 | 0.14 | 2.05 |
| `neutral_delayed_shell` | Delayed Shell | Lower dust ring at feet (BG) | 0.48 | 0.82 | 2.15 |

### Plate N1b — Multi-fists

**Master:** `public/art/plates/n1b-multi-fists.jpg` — Glint multi-hit barrage (three poses / multiple purple gauntlets).

| Base id | Card | Crop focus | px | py | zoom |
|---------|------|------------|---:|---:|-----:|
| `neutral_multi_strike` | Multi-strike | Multiple fists in frame | 0.42 | 0.45 | 2.55 |

### Plate N1c — Capacitor pack

**Master:** `public/art/plates/n1c-capacitor-pack.jpg` — Rust Ranger gunslinger, backpack capacitors dominant.

| Base id | Card | Crop focus | px | py | zoom |
|---------|------|------------|---:|---:|-----:|
| `neutral_capacitor_feed` | Capacitor Feed | Backpack canister glow | 0.50 | 0.32 | 3.05 |

### Plate N6 — Feint / Overdrive Slam

**Master:** `public/art/plates/n6-feint-overdrive.jpg` — Baron overhead slam (left) + Seiryu dodge/afterimage (right) + center arena lights BG.

| Base id | Card | Crop focus | px | py | zoom |
|---------|------|------------|---:|---:|-----:|
| `neutral_overdrive_slam` | Overdrive Slam | Baron two-handed overhead | 0.22 | 0.35 | 2.60 |
| `neutral_feint` | Feint | Seiryu dodge + afterimage | 0.68 | 0.42 | 2.70 |

BG reserve (not wired yet): arena floodlight cluster `{ px: 0.48, py: 0.22, zoom: 2.0 }`.

### Plate N2 — Pit Crew / Workshop

Support bay with open chassis; faction-agnostic spare parts.

| Base id | Card | Crop focus |
|---------|------|------------|
| `neutral_servo` | Servo Tune-Up | Servo joints / wrench on limb |
| `neutral_urgent_repairs` | Urgent Repairs | Weld spark on damaged plate |
| `neutral_bulk_up` | Bulk Up | Armor plating being bolted on |
| `neutral_perpetual_motion` | Perpetual Motion | Spinning dynamos / flywheels |
| `neutral_overclock` | Overclock Burst | Overheating core / redline gauges |

### Plate N3 — Exposed Systems

Enemy panels open; wiring and weak-point node shared across crops.

| Base id | Card | Crop focus |
|---------|------|------------|
| `neutral_expose_wiring` | Expose Wiring | Torn wiring cluster |
| `neutral_expose_drone_uplink` | Expose Drone Uplink | Small drone near exposed panel |
| `neutral_static_clamp` | Static Clamp | Clamp on limb joint |
| `neutral_capitalising_strike` | Capitalising Strike | Finisher into exposed weak point |
| `neutral_harassing_strike` | Harassing Strike | Quick poke at same weak point |

### Plate N4 — Shield Lattice

Layered barrier tech; each shield state visually distinct.

| Base id | Card | Crop focus |
|---------|------|------------|
| `neutral_shield_reinforcement` | Shield Reinforcement | Thick layered plates |
| `neutral_shield_conditioning` | Shield Conditioning | Soft glow conditioning field |
| `neutral_siphoning_strike` | Siphoning Strike | Strike + drain line into own shield |

*(Delayed Shell now maps to N1 BG dust ring.)*

### Plate N5 — Timed Ordnance

| Base id | Card | Crop focus |
|---------|------|------------|
| `neutral_gathering_strike` | Gathering Strike | Strikes accumulating / tally marks on fist |

*(Delayed Burst now maps to N1 BG stands haze.)*

---

## Phase 2 — Scavenger master plates

~35 uniques. Cast: **Rust Ranger / scavenger mechs only**. Can run in parallel with Phase 0 Clockwork/Cyberpunk work.

### Plate S1 — Junk Hoard Spine

Tall scrap pile + scavenger mech; gizmos large enough for tight crops.

**Master:** `public/art/plates/s1-junk-hoard.jpg` (v1 draft) — strong Rust Ranger + pile silhouette; next pass should enlarge distinct spigot / ladder / crown / generator focals (current pile reads more as environment than cropable gizmos). Has stray background text — regenerate before shipping crops.

| Base id | Card | Crop focus |
|---------|------|------------|
| `junk_spigot` | Junk Spigot | Spigot feeding pile |
| `junk_loader` | Junk Loader | Loader arm into pile |
| `field_diode` | Junk Surge | Surge diode / inject gizmo |
| `junk_ladder` | Junk Ladder | Ladder of threshold gizmos |
| `junk_bulwark` | Junk Bulwark | Bulwark plates on pile face |
| `junk_gasket` | Junk Gasket | Gasket hardware |
| `junk_rivet` | Junk Rivet | Rivet hardware |
| `junk_coil` | Junk Coil | Coil mid/apex |
| `junk_crown` | Junk Crown | Crown apex |
| `junk_aegis` | Junk Aegis | Aegis face-plate |
| `junk_generator` | Junk Generator | Continuous generator in heap |
| `junk_recycle` | Junk Recycle | Recycle engine |
| `heap_battery` | Heap Battery | Battery cells in heap |
| `salvage_mantle` | Salvage Mantle | Mantle on chassis |
| `heap_padding` | Heap Padding | Padding on chassis |

### Plate S2 — Graft / Blood-Scrap

Self-damage for payoff; **shield rider** tied to the wound. No flesh gore — cracked armor + energy bleed.

| Base id | Card | Crop focus |
|---------|------|------------|
| `gutter_offering` | Gutter Offering | Offering wound + nascent shield |
| `sacrif_rift` | Glass Rift | Glass-like rift cut |
| `sacrif_plate` | Plated Cut | Plated cutting edge |
| `blood_to_scrap` | Blood to Scrap | Wound → junk motes |
| `anemic_dividend` | Anemic Dividend | Dividend from missing structure |
| `hollow_frame` | Hollow Frame | Damaged frame still standing |
| `hot_swap` | Hot Swap | Component swap under shield |

### Plate S3 — Core Reactor

Extends existing shared reactor art for `core_*` / `sacrif_*` (`isCoreSacrificeLineCardId` in forge card model). Placeholder: `public/poc/poc-core-werewolf-mech-reactor-placeholder.png`.

| Base id | Card | Crop focus |
|---------|------|------------|
| `core_tap` | Core Tap | Reactor punch / vent |
| `deep_core_tap` | Core Sacrifice | Deeper vent / sacrifice bloom |
| `core_refactoring` | Core Refactoring | Tool arms on reactor rings |
| `core_rebirth` | Core Rebirth | Rebirth bloom upward |
| `sacrif_echo` | Corebleed Oath | Echo bleed outward |

### Plate S4 — Scrap Economy / Engines

| Base id | Card | Crop focus |
|---------|------|------------|
| `scrap_dividend` | Scrap Dividend | Dividend chute |
| `scrap_dynamo` | Scrap Dynamo | Spinning dynamo |
| `scrap_transfusion` | Scrap Transfusion | Transfusion hose / line |
| `chassis_refinance` | Chassis Refinance | Chassis bay rebuild |
| `dynamo_peal` | Dynamo Peal | Peal blast wave |
| `needle_driver` | Needle Driver | Needle driver tool |
| `strip_mine` | Strip Mine | Strip-mine claws |
| `salvage_strike` | Salvage Strike | Salvage weapon swing |

### Plate S5 — Scrap Hound

Silhouette refs: `public/icons/scrap-engine.jpg`, `scrap-hound-attack.jpg`, `scrap-hound-shield.jpg`.
Battle companion stills (POC): `public/poc/poc-scrap-hound-idle.jpg` (summon/idle), `public/poc/poc-scrap-hound-attack.jpg` (attack tick).
Events: `scrap_hound_summon`, `scrap_hound_attack`. Future strip work can replace stills with multi-frame sheets registered beside `MECH_SPRITE_SHEETS`.

| Focus | Crop |
|-------|------|
| Scrap Engines | Boxy engine cluster |
| Attack hound | Turret / jaws / gun stance |
| Shield hound | Auto-shield dome on back |
| Summon / idle | Companion pose at player's feet |
| Attack lunge | Companion attack-tick pose |

---

## Image generation prompts

Copy-paste starters (Flux / Midjourney / SDXL). Append **Shared style** to every prompt. Use **Shared negatives** where the tool supports them.

### Shared style

```text
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

### Shared negatives

```text
photoreal, photorealistic, realistic, live action, real human, skin pores, uncanny valley, 3D render, Unreal Engine, octane render, cinematic realism, text, letters, numbers, UI, HUD, watermark, logo, border, frame, collage, split panel, multiple panels, blurry focal props, muddy silhouettes, gore, blood spray, severed limbs, camera noise, lens flare spam, purple neon overload
```

### Technical recipe for master plates

- Aspect: **16:9 or 3:2 landscape** (room for 4–6 card crops).
- Composition: place **distinct focal props in separate regions** (left fist, right shield, backpack glow, mid grounding) so crops do not all center on the same face.
- After generation: mark crop rectangles (fist / shield / backpack / etc.).

---

### Phase 0 prompts

**Rust Ranger:** skip — use `public/poc/poc-rust-ranger.png` + `public/RustRanger_Mech.png` as references.

#### Clockwork — Father Time (portrait)

```text
Bust portrait of Father Time, solemn clockwork cantor-pilot, brass filigree collar, pale geometric face markings, hourglass and lattice motifs in costume, deep teal and antique brass palette with warm candlelight rim, serene severe expression, three-quarter view, shoulders clear for HUD crop,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border
```

#### Clockwork — Father Time (mech hero)

```text
Full-body three-quarter hero pose of Father Time clockwork mech, cathedral-automaton silhouette, brass lattice limbs, rotating metronome core in chest, hymn-plate pauldrons, teal glass and antique brass palette, standing on marble-and-gear arena floor, silhouette readable at thumbnail, clear shield-arm plane on one side and striking limb on the other, minimalist or simple ground plane,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border
```

#### Cyberpunk — Seiryu (portrait)

```text
Bust portrait of Seiryu, cyberpunk storm pilot, sharp azure accents, sleek visor, dragon-scale patterned jacket collar, cool cyan and electric blue palette with black carbon fiber, disciplined calm expression, three-quarter view, shoulders clear for HUD crop, neon rim light but restrained,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border
```

#### Cyberpunk — Seiryu (mech hero)

```text
Full-body three-quarter hero pose of Seiryu storm mech, sleek bipedal frame with azure dragon-crest shoulder, capacitor fins on backpack, blade-arm and open palm, cyan energy veins in joints, black and electric blue palette, rooftop arena with distant neon city bokeh, silhouette readable at thumbnail, distinct backpack glow region for capacitor crops,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border
```

---

### Phase 1 — Neutral plate prompts

Cast baked in: **Glint scavenger punch-mech (left/attacker) vs Father Time clockwork mech (right/defender)** unless noted. Rust Ranger is **not** the Neutral fist cast — use him on gun/junk plates.

#### Plate N1 — Arena Clash

```text
Wide landscape key art, two giant mechs mid-fight in a dusty arena: left Glint scavenger punch-mech (rabbit-ear antennae, cyan visor, orange copper plates, large purple gauntlets with electric FX — NO cowboy hat, NO revolvers) throwing a heavy punch with fist and impact sparks clearly separated on the left third; right clockwork brass Father Time defender raising a glowing hexagonal barrier plane on the right third; Glint backpack capacitors glowing cyan in upper-left; secondary purple fist mid-swing for multi-hit readability; feint shoulder twist visible on Glint torso; downward smash silhouette implied in center composition; empty space between focal props so each region can be cropped into a card; no pilots' faces required,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate N2 — Pit Crew / Workshop

```text
Wide landscape workshop bay key art, open mech chassis on a repair gantry, multiple clear focal props spaced apart: articulated servo joints being tuned with a wrench (left), welding sparks repairing a damaged plate (center-left), heavy armor plating being bolted on (center), spinning dynamos and flywheels (right), overheating core gauges redlining (upper-right); scavenger orange scrap and clockwork brass spare parts mixed so it feels faction-agnostic; bright practical work lights, grease and metal filings,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate N3 — Exposed Systems

```text
Wide landscape combat key art, enemy mech with armor panels torn open exposing glowing wiring clusters; small recon drone hovering near a panel (upper focal); industrial clamp locked on a limb joint (mid-left); attacker blade/fist lined up on a bright weak-point node (center-right); quick poke strike trail toward the same node (left); teal and amber cable glow, dark arena background, props spaced for independent card crops,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate N4 — Shield Lattice

```text
Wide landscape key art of layered defensive barrier technology around a defending mech: thick overlapping shield plates (left), soft conditioning energy field shimmer (center), translucent shell still forming incomplete (right), attacker strike connected by a siphon energy line draining into the defender's shield (lower-center); cool blue-silver palette with restrained highlights; each shield state visually distinct for cropping,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate N5 — Timed Ordnance

```text
Wide-but-simple landscape key art, mech weapon systems charging: cannon barrel with building energy charge and countdown rings (left half), armored fist with engraved tally / strike-count marks and residual impact rings (right half); shared arena floor connecting both; minimal clutter so two strong crops work; amber charge light vs steel fist,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

---

### Phase 2 — Scavenger plate prompts

Cast: **Rust Ranger / scavenger mechs only**.

#### Plate S1 — Junk Hoard Spine

```text
Wide landscape scavenger key art, towering junk hoard mountain of scrap with Rust Ranger–style orange scavenger mech standing beside it; spaced focal props: leaking junk spigot and loader arm feeding the pile (lower-left), ladder of threshold gizmos and bulwark plates on the pile face (mid), gasket/rivet hardware details, coiled junk crown and aegis face-plate at the apex (upper), humming generator/recycle engines and heap battery cells embedded mid-heap (right), scrap mantle and padding draped on the mech chassis; ochre dust, rust orange, gunmetal, cyan energy accents; every gizmo large enough to survive a tight card crop,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate S2 — Graft / Blood-Scrap

```text
Wide landscape scavenger key art, mech performing controlled self-damage ritual for power: cracked chest plate with ember-red graft seam (center), nascent hexagonal shield blooming from the wound (right), glass-like rift cut and plated cutting edge (left), scrap chunks crystallizing out of the wound into junk motes (lower), hollow damaged frame silhouette still standing strong (background); shield rider must be visually tied to the wound; rust and ember palette, no gore — damage reads as cracked armor and energy bleed, not flesh,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate S3 — Core Reactor

```text
Wide landscape scavenger key art, werewolf-adjacent scrap mech opening a blazing core reactor in its chest; spaced focals: reactor vent punch (center), refactoring tool arms adjusting reactor rings (left), rebirth bloom of scrap-light erupting upward (upper), echo bleed of core energy mirroring outward (right); amber-white core light, dark scrap body; readable for tight crops on vent vs bloom,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate S4 — Scrap Economy / Engines

```text
Wide landscape scavenger industrial key art, scrap-economy workshop-battlefield hybrid: dividend chute pouring scrap tokens (left), spinning scrap dynamo and transfusion hose transferring energy (center), chassis refinance bay rebuilding a mech torso (mid-right), peal blast wave and needle driver tool (right), strip-mine claws tearing floor plates (lower), salvage weapon mid-swing (upper-left); ochre dust and oil; each machine readable as its own card crop,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

#### Plate S5 — Scrap Hound

```text
Wide landscape scavenger key art, scrap engines converting into a scrap-hound pet: cluster of boxy scrap engines (left), hound-turret form with attack stance jaws/gun (center), auto-shield dome projecting from hound back (right), scavenger mech supervising in background; same ochre/gunmetal/orange language as junk hoard with cyan accents; clear three focals for engine / attack / shield crops,
Robot Wars card-game key art, anime illustration, 2D anime key visual, stylized mecha anime, clean cel-shaded rendering matching Rust Ranger locked art (warm amber light, expressive anime proportions, readable silhouettes), clear material separation (metal / energy / scrap), vibrant but controlled color, NOT photoreal, NOT live-action, NOT realistic 3D render, no UI, no text, no watermarks, no logos, no frames, no border, high detail focal props, soft atmospheric dust, consistent lighting across the plate so tight crops still read as the same scene
```

---

## Checklist

- [x] Phase 0 Rust Ranger locked + palette/props extracted
- [x] Father Time portrait + mech (v1) + wired in `pilots.ts`
- [x] Seiryu portrait + mech (v1) + wired in `pilots.ts`
- [ ] Dedicated select BGs for Father Time / Seiryu
- [x] Neutral plate N1 Arena Clash v2 + retuned Barrier/Strike crops
- [x] N1b Multi-fists (`public/art/plates/n1b-multi-fists.jpg`) → Multi-strike
- [x] N1c Capacitor pack (`public/art/plates/n1c-capacitor-pack.jpg`) → Capacitor Feed
- [x] N6 Feint/Overdrive (`public/art/plates/n6-feint-overdrive.jpg`) → Feint + Overdrive Slam
- [x] N1 BG reclaim → Delayed Burst / Delayed Shell
- [x] Background-as-crop rule documented
- [x] Crops wired in `src/ui/cardArtPlates.ts`
- [x] Scavenger plate S1 Junk Hoard v1 draft — needs gizmo pass
- [ ] Generate remaining Scavenger plates S2–S5
- [ ] Generate remaining Neutral plates N2–N5
- [ ] Eyeball Barrier crop (confirm no Glint fists)
- [ ] Map S1+ plates once art is crop-ready
