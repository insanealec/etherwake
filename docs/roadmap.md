# Etherwake: roadmap

**Read this first each session.** Update the status and "Next up" sections at the end of every session.

## Status
- **Current milestone:** 2, solar surfer (slice 4 done: landings, spins, wipeouts, pennant).
- **Milestone 2 so far (2026-09-27):** `src/player/Surfer.js` rides `sea.heightAt`/`normalAt` at 120 Hz
  substeps: slope pull (normal's horizontal part), W thrust, S brake, grip on sideways slip, linear +
  quadratic drag, speed-scaled carving, Space jump (plus the surface's own lift), air spin, and landing via
  a surface-following vertical speed (capped at 20 m/s). Numbers in `src/game/Gear.js` (`BOARD`). Primitive
  board, mast, sail and rider with lean and crouch. `src/core/ChaseCamera.js` (spring-damped, follows travel
  direction, dips on landing, stays above the sea). `F` toggles fly/surf, `?fly` starts in fly, `R` resets.
  `Input.wasPressed` / `tap` for edge-triggered keys. `App.time` is a game clock (sum of capped dt) so tab
  switches don't jump the sea. HUD shows the controls and speed. Sail cruise ~10.5 m/s riding straight
  downwind (the board catches the swell ahead, which moves ~11 m/s); natural crest launches are rare at
  these speeds (big swells are gentle), so air comes from a timed Space near a crest.
  **Slice 2 (2026-09-28):** user says it's "pretty fun". Added the solar wind (`src/world/Wind.js`: `WIND`
  table plus `sailPower( yaw )` polar curve: 60% running, 110% beam reach, 0 in irons; the boom swings to
  the downwind side), crest pop (`BOARD.pop`: jumping off a rising face adds part of its lift; airtime
  0.7 to 1.6 s depending on timing), slope pull 1.3, a glowing foamy wake ribbon (`src/player/Wake.js`,
  re-draped on the moving surface each frame), point of sail and power in the HUD, and Board and Wind
  folders in the tweak panel. Measured: ~11 m/s running, ~18.6 m/s on a beam reach (across the swells).
  **Slice 3 (2026-09-28), from user feedback** ("can't catch up to jump off a wave; the pull stops you
  going reverse over a wave"): faster board (running ~20 m/s now outruns the ~11 m/s swells, beam ~24),
  a wind-free `pump` on W so upwind still crawls (~10 m/s), a narrower no-go zone (>150°), asymmetric slope
  pull (`slopeUp` 0.55 when climbing, `slope` 1.3 when descending), floatier `airGravity` 9, and
  `maxLaunch` 15 m/s. Timed jumps (auto-jump on a rising face): upwind into the swells ~3.9 s / 14 m,
  beam ~2.9 s, running ~2 s; untimed jumps ~1.4 s.
  **Slice 4 (2026-09-28):** landing grades in `Surfer.land()`: heading vs travel within `cleanAngle` 30°
  is clean, up to `wipeoutAngle` 65° is sketchy (keeps 75% speed), beyond is a wipeout (board rolls,
  rider topples, heavy drag, back up after 1.6 s facing the drift). Landing backwards counts as a revert
  (the model swings round via a smoothed `visualYaw`). Spin (`airSpin`) and airtime are tracked;
  `airTurn` 4.5 rad/s so a 360 fits in ~1.4 s. `onLand( result )` drives a centred toast
  ("360 · 2.6s air · clean", "180 · revert · clean", "Wipeout!"). A red pennant at the mast top streams
  downwind as the in-world wind cue.
  **Testing:** with the pane hidden, drive frames with a fake clock:
  `t += 1000 / 60; __ew.frame( t )` in a loop (don't mix with live rAF timestamps).
- **Milestone 1 summary (2026-09-27):** `src/sea/Waves.js` (the SEA/WAVES table, 6 Gerstner waves) drives
  both `Etherium.heightAt`/`normalAt` (JS, fixed-point solve for the horizontal displacement) and
  `etheriumWaves` (TSL vertex displacement plus tangent, binormal and Jacobian). Camera-following nonlinear
  grid (512x512, ~0.6 m at the centre, 2.5 km half-extent); each vertex snaps to a world-fixed lattice of
  its own power-of-two spacing (`snapStep` attribute) so the sparse outer grid doesn't swim. Small waves
  fade with distance. Unlit emissive shading: teal/violet troughs, gold/rose crests, cloud noise, Jacobian
  foam, near-camera sparkles, sun glint, fresnel rim, underside glow. Density fog swaps to thick violet
  underwater, and the backdrop turns solid fog colour there too (`uUnderwater`). lil-gui tweak panel
  `src/ui/TweakPanel.js` (`H`, or `?tweaks`). About 1.3 ms/frame GPU at 650x700.
  **Palette gotcha:** colours are linear, so keep them very saturated (sRGB output turns (1, .45, .3) into
  pale peach). **Testing gotcha:** when the browser pane is hidden, rAF stops; drive frames manually with
  `__ew.sea.update( t, __ew.camera ); __ew.renderer.render( __ew.scene, __ew.camera )`.

## Next up
Milestone 2 is close to done. Get the user's impressions of landings, spins and wipeouts. Remaining small
polish if wanted: spray particles off the rail on hard carves; a pre-landing cue (e.g. the pennant or the
board tint shows when you're lined up for a clean landing). Then call milestone 2 done and start
**milestone 3 (sky)**: sun disc and glow, a banded gas giant with rings, a better starfield, bloom via
`PostProcessing` + `BloomNode`, and tone-mapping and exposure tuning.

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

### 1. The Etherium (the centerpiece) ✅
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
