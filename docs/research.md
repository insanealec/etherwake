# Research: Tidewater (the inspiration)

Researched 2026-09-27. Repo: https://github.com/dgreenheck/tidewater (live: https://dgreenheck.github.io/tidewater/)
Coverage: https://aifrontierpost.com/articles/opus-5-5-built-tidewater-island-game/
Reddit thread that started this: r/TopologyAI, "This is what $1874 of Opus 5.5 tokens looks like" (Reddit
blocked automated fetching, so its details weren't read).

## What it is
A browser island fishing game by Dan Greenheck (author of the threejs-water project). You cast from the
pier, beach or your own boat, fight the fish with a line-tension minigame, sell to one vendor and buy
upgrades from another. There are 18 species, and bites depend on the water, depth and time of day. Most of
the effort went into a photoreal island and ocean around a small loop.

## How it was made
- Claude Opus 5.5, about **8 hours**, **about $1,874 of tokens** (59% of a Max 20x weekly allowance).
- Built by iterative nudging ("add X", "make it better"), not a detailed spec. The author's rendering
  expertise did a lot of the steering.
- Started on **three.js with TSL**, then ported to raw WebGPU and WGSL on a branch (`docs/PORTING.md`). The
  porting rules: keep structure, names and constants, don't simplify effects away, and document anything
  that can't be ported 1:1.
- About 83k lines across about 210 source files. The public repo is one squashed commit.

## Architecture worth copying
- Folders by system: `engine/`, `ocean/`, `sky/`, `world/`, `game/`, `player/`, `post/`, `audio/`, `ui/`.
- **Systems expose shader functions to each other** through named modules with a prefix (`terrainHeightAt`,
  `cloudsShadow`, `oceanDisplacement`). This is how the terrain, ocean, clouds and so on compose. In
  three.js TSL we can do the same by exporting `Fn`s from each system.
- `WorldLayout.js` holds all the positions and zones in one place.
- `?fly&noAudio&noClouds…` URL flags turn off expensive systems for debugging and performance.
- Game logic (bites, economy, upgrades) is plain data tables (`FishTable.js`, `Gear.js`) that can be tested
  headlessly.
- There's a big headless test suite: WebGPU in Node (the `webgpu` npm package) renders each system to a
  PNG. **We'll use browser screenshots instead** (cheaper), and maybe add this later.
- Assets are free and openly licensed, fetched by scripts in `tools/` (Poly Haven, Freesound CC0, Microsoft
  Rocketbox characters). `CREDITS.md` lists every asset and technique reference.

## Rendering techniques it used (our upgrade menu)
- Ocean: 4-cascade **FFT** (Tessendorf) with foam, whitecaps, swell; breaking waves; shallow-water swash
  sim; wakes; caustics; refraction; underwater split view.
- Sky: **Hillaire 2020** atmosphere, volumetric cumulus and cirrus, cloud shadows, aerial perspective,
  god rays, lens flare.
- Lighting and post: cascaded shadows, GTAO, temporal upscaling (TAAU), bloom, auto exposure, motion blur,
  dynamic resolution.
- World: CDLOD terrain, vegetation impostors with dithered LOD fades, skinned characters.

## Takeaways for Etherwake
1. One hero system plus a small loop beats many shallow systems.
2. Start on three.js TSL (fast iteration) and only go lower-level if it's needed.
3. Keep game rules in data tables; keep world layout in one file.
4. We're on a base Claude subscription, **not** a $1.9k budget: work in small, verifiable milestones with
   docs good enough that each new session starts cold and cheaply.
