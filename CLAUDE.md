# Etherwake

A space-fantasy solar-surfing game for the browser, in a Treasure Planet-like tone (original IP).
three.js (WebGPURenderer and TSL) plus Vite. Inspired by Tidewater.

## Start here every session
1. Read `docs/roadmap.md` for status, the next task and the working rules.
2. Read `docs/concept.md` for design and tone, and `docs/research.md` for Tidewater notes and techniques.
3. At the end of the session, update `docs/roadmap.md` (Status and Next up) and commit.

## Budget
The user is on a base Claude subscription. Be economical: small milestone slices, don't re-explore the
codebase when the docs answer the question, don't spawn subagents unless asked, and prefer simple
techniques that can be upgraded later.

## Commands
- `npm run dev` starts the dev server on http://127.0.0.1:5190 (or `$PORT`, see `vite.config.js`). Use `preview_start` with name
  `etherwake` (in `.claude/launch.json`).
- `npm run build` does a static build into `dist/`.

## Code conventions
- ES modules, tabs, three.js source style (spaces inside parentheses).
- Import runtime classes from `three/webgpu` and shader nodes from `three/tsl`. Don't use
  `three`/WebGLRenderer directly.
- Materials are `*NodeMaterial`s; custom shading goes in TSL `Fn`s.
- One folder per system: `core/` (input, cameras, loop), `sky/`, `sea/`, `player/`, `world/`, `game/`,
  `post/`, `ui/`, `audio/`.
- Systems that other systems query expose both a **JS function** (physics and gameplay) and a **TSL
  `Fn`** (rendering) built from the same parameter table. Example: `Etherium.heightAt` and
  `etheriumHeight`.
- Gameplay numbers live in data tables (`game/Gear.js` and so on); world positions live in
  `world/WorldLayout.js`.
- `App.js` owns the renderer, scene, camera and frame loop, and wires systems together.
- URL flags for debugging (`?fly`, `?noAudio`, `?noBloom`…) are read from `app.params`.

## Verifying changes
- Run the dev server, open it in the built-in browser, and check the console for errors (it logs
  `[etherwake] renderer backend: webgpu|webgl2`).
- Drive it from JS through the `window.__ew` debug handle (the App instance). For input:
  `__ew.input.keys.add('KeyW')` / `.delete(...)`. Don't rely on synthesized key events.
- Take a screenshot as proof for visual changes.
- **The user may play in the same browser pane. Protect their save and their ears.** First thing in
  every test script after a page load, run `__ew.testMode()`: a throwaway save slot and audio off, for
  that page session only. Never call `save.reset()` / `addCredits` etc. on the real slot, and don't set
  persistent flags in the pane's localStorage (they would affect the user's game). Loud test audio has
  hurt the user before: use `?noAudio` when navigating yourself, and check sound levels with silent
  `OfflineAudioContext` renders, never by playing it.

## Git
- Commit after each working step so it can be rolled back. Branch `main`.
- Commit before large or risky refactors.

## Assets
Only openly licensed assets (CC0 preferred: Poly Haven, Kenney, Quaternius, ambientCG, Freesound CC0). Record
each one in `CREDITS.md` with its source and license.
