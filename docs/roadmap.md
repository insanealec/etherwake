# Etherwake: roadmap

**Read this first each session.** Update the status and "Next up" sections at the end of every session.

## Status
- **Current milestone:** 1, the Etherium (not started)
- **Last session (2026-09-27):** research, concept and plan written; milestone 0 scaffold done. Vite plus
  three.js 0.186 WebGPURenderer, TSL procedural starfield and nebula haze, fly camera, placeholder brass
  torus-knot and asteroids. Confirmed running on the WebGPU backend in the built-in browser.

## Next up
Start **milestone 1**. First session target: replace the placeholder asteroids with a Gerstner swell surface
(TSL vertex displacement) with a glowing crest shader and fog below, and look at it with the fly camera.

## Working rules (base subscription, so be economical)
- **One milestone slice per session.** End every session with something that runs, a commit, and this
  file updated.
- **Simple first, upgradeable later.** Gerstner before FFT; fake volumetrics before raymarching. Keep each
  system behind a small interface so internals can be swapped.
- **Verify in the browser**: run the dev server, check the console, take a screenshot, and drive the game
  through `window.__ew` from JS (e.g. `__ew.input.keys.add('KeyW')`).
- **Commit before risky changes** so we can roll back. One commit per working step.
- Don't build later-milestone features early.

---

## Milestones

### 0. Scaffold ✅
Vite, three.js WebGPU (WebGL2 fallback), starfield backdrop, fly camera, docs, git.

### 1. The Etherium (the centerpiece)
The glowing sea you'll surf on.
- `src/sea/Etherium.js`: a large grid mesh (later camera-following or clipmap LOD) displaced by a sum of
  Gerstner waves in a TSL vertex node.
- **One wave function, shared by CPU and GPU**: the same wave parameters are evaluated in JS for
  `heightAt(x, z, t)` and `normalAt` (needed for the surfer physics in milestone 2) and in TSL for
  rendering. Keep the parameters in one table.
- Shading: an emissive, cloudy surface with glow that rises on the crests, foam and sparkle at the peaks
  (steepness or Jacobian), a fresnel rim, and noise-driven color variation (gold and rose on the crests,
  teal and violet in the troughs).
- Below the surface: thickening glowing fog (an underside shader, and scene fog tinted by depth).
- A tweak panel (lil-gui, `H` to toggle) for wave amplitude, wavelength, speed and colors.
- **Done when:** flying over it at dusk colors looks gorgeous and clearly "surfable" (readable swell
  slopes), at 60 fps.
- Later upgrade: an FFT cascade for detail plus big Gerstner swells for gameplay.

### 2. Solar surfer (the core feel)
- `src/player/Surfer.js`: board physics against `Etherium.heightAt` and `normalAt`: gravity along the
  slope, drag, grip (lateral friction), sail thrust from the wind direction times the trim, jumping off
  crests, air control, and landing alignment.
- Chase camera (spring-damped, looks ahead, dips on landing). `F` toggles the fly camera for debugging.
- A placeholder board and rider (primitives) with lean and crouch.
- **Done when:** carving down a swell and launching off a crest feels good. Tune until it does. This is
  the make-or-break milestone.

### 3. Sky
A sun (a disc plus a lens-flare-ish glow), a gas giant (a TSL shader with animated banded storms), rings
(a lit ring with transparency), a better star and nebula backdrop, bloom (three `BloomNode` via
`PostProcessing`), and tone-mapping and exposure tuning. Optional time-of-light shift.

### 4. The port
A floating dock-town anchored to a small moon: modular dock pieces, lanterns (local lights), sails and
banners. Use Kenney, Quaternius or Poly Haven models (openly licensed, listed in `CREDITS.md`) or
procedural geometry. Walk-on-foot mode (dock only), vendor NPCs, a dialogue box UI.

### 5. The loop
Job board (courier: fetch a parcel from a buoy and return; race: gates against the clock and a rival),
stardust collectibles along wave lines, tricks scoring coin, the shipwright's upgrade shop (data table in
`src/game/Gear.js`), a HUD, and saving to localStorage.

### 6. Leviathans
Star-whale pods (procedural or openly licensed model plus vertex-shader swimming), riding their bow wave,
song audio, and breaching.

### 7. The galleon
A small solar galleon: board it, walk the deck, take the helm, sail between regions, launch the board from
the deck.

### 8+. Regions and polish
The flare-storm zone (giant flare wave-fronts as set-pieces), the gas giant's rings (ice slalom), the black
hole rim (a lensing post-pass), a real volumetric nebula (raymarched), positional audio (Freesound CC0),
performance work (LOD, dynamic resolution), a title screen, and GitHub Pages deploy.

---

## Open questions
- Final names: game title (working "Etherwake"), port, characters.
- Should the sea be one infinite plane, or regions of etherium "islands" in the void? (Leaning towards one
  sea per region, joined by galleon travel.)
