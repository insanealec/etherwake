# Etherwake: roadmap

**Read this first each session.** Update the status and "Next up" sections at the end of every session.

## Status
- **Current milestone:** 4, the port (slices 1 and 2 done: port, walking, NPCs, dialogue). Milestones 2 and 3 done (the optional sun drift is
  deferred to polish).
- **Design note from the user:** gameplay numbers (board speed, wind strength, etc.) stay as tunable
  variables; later, upgrades bought with credits will modify them (e.g. a faster board). Don't bake in
  "test" values the user sets in the tweak panel.
- **Milestone 4 slice 1 (2026-09-28):** `src/world/WorldLayout.js` (`HARBOR`, `SPAWN`). Harbour calm in the
  shared wave function: swells shrink to 10% inside 140 m and back to full by 320 m (`harborCalm` in JS,
  `uHarbor` in TSL, both in `Etherium.js`). `src/world/Port.js`, procedural: a smooth lumpy moonlet
  (`mergeVertices` for smooth normals), a boardwalk ring (42 to 54 m), four piers (52 m) on instanced
  pilings, instanced lantern posts, pier-end point lights, shacks with lit windows, banners that stream
  downwind, a lighthouse with a sweeping additive beam. 2D colliders (ring circle + pier rectangles)
  push the board out and bounce it slightly; skipped when the board is above deck height, so you can
  jump a pier. The surfer spawns off the east pier's end.
- **Milestone 4 slice 2 (2026-09-28):** on foot. Modes are now surf / walk / fly (F returns to the mode you
  left). In surf, E near a pier-end slip (slow, grounded) docks: the board parks in the slip
  (`Surfer.park`, rider hidden) and you walk (`src/player/Walker.js`, camera-relative WASD, Shift runs,
  kept on deck by `port.walkable()` with per-axis sliding; `src/player/Figure.js` builds the primitive
  people). `src/core/WalkCamera.js` orbits (mouse or arrow keys) and raycasts `port.cameraObstacles`
  so it doesn't sit inside shacks. `src/game/Characters.js` (data: name, shack, colours, lines) and
  `src/world/Npcs.js` (figures at shack doors, turn to face you): Dockmaster, Shipwright, Tea-seller
  near the east pier. `src/ui/Dialogue.js` + `#dialogue` box: E talks, E/Space advances. `#prompt`
  shows the available action. E at a pier end launches the board.
- **Nebula sea (2026-09-28, user request: "more gas-nebula-esque, particles you surf through"):** planned
  as three slices, physics untouched (surfer still rides `heightAt`). Slice 1: the sea's `colorNode` is now
  gas (domain-warped clouds drifting downwind, high-contrast dense/thin lanes, gold puffs at pinching crests,
  back-lit glow toward the sun, grazing-angle thickening, soft sun-facing shading so slopes stay readable).
  Slice 2: `src/sea/Motes.js`, instanced `Sprite` motes whose positions come purely from `instanceIndex`
  on a world-anchored lattice around the camera, riding `etheriumWaves`, rising and fading, shoved aside by
  the board. Two layers in `MOTE_LAYERS` (wide 256² at 1.4 m out to 150 m; near 128² at 0.5 m out to
  30 m). `?noMotes` disables. Cost: whole scene ~1.8 ms at 1080p 4x MSAA via `__ew.benchmark()`
  (offscreen render timed to queue drain; the pane's fps and timestamp queries are unreliable). Slice 3:
  `src/sea/Shells.js`, three additive patchy gas shells 0.6 / 1.2 / 1.9 m above the swell (you ride
  through them), drifting at different speeds for parallax, faded near the camera and past ~500 m, on a
  256² grid (`sea.buildGeometry( segments )`). `?noShells` disables; the tweak panel's Gas folder toggles
  shells and motes and sets shell strength live. Whole scene ~2.3 ms at 1080p. The user likes the shells.
- **Milestone 3 slice 2 (2026-09-28):** a galaxy band in `Starfield` (great circle `GALAXY_NORMAL`,
  clumpy violet glow, dark dust lanes, denser stars); `src/sky/Moon.js`, a small icy moon at infinity
  with Worley craters and a crisp terminator; `src/post/SunFlare.js`, soft tinted ghost discs along the
  sun-to-centre line in the post pipeline (sun projected in JS each frame, fades toward the screen edge).
  Exposure checked by eye in several views and left at 1.0.
- **Milestone 3 so far (2026-09-28):** sun disc, corona and warm glow in the backdrop (`Starfield`'s `sun`
  option, same direction as the sea's `uSunDir`). `src/sky/GasGiant.js`: a sphere at a fixed direction
  and 9 km from the camera (follows it, so no parallax; `fog: false`), banded TSL clouds with
  differential rotation and a storm, soft terminator, atmospheric rim; rings with noise bands, a Cassini
  gap and the planet's shadow (ray-sphere test in the ring shader). Bloom via `THREE.RenderPipeline` +
  `bloom()` from `three/addons/tsl/display/BloomNode.js` (0.55, 0.45, threshold 0.85); `?noBloom` skips
  it. App now renders with `this.pipeline.render()`.
- **Milestone 2 summary (2026-09-28):** `src/player/Surfer.js` rides `sea.heightAt`/`normalAt` at 120 Hz
  substeps; all numbers in `src/game/Gear.js` (`BOARD`, also in the tweak panel's Board folder).
  - Riding: asymmetric slope pull (`slope` 1.3 down a face, `slopeUp` 0.55 climbing, so momentum carries
    you to the lip), sail thrust from the solar wind (`src/world/Wind.js`: `WIND` table and the
    `sailPower( yaw )` polar: ~80% running, ~110% beam reach, 0 within 30° of dead upwind) plus a
    wind-free `pump`, grip on sideways slip, drag, speed-scaled carving. ~20 m/s running (outruns the
    ~11 m/s swells), ~24 m/s on a beam reach, ~10 m/s crawling upwind.
  - Air: Space jump plus crest pop (part of the rising face's lift), `maxLaunch` 15 m/s, `airGravity` 9.
    Timed pops: upwind into the swells ~3.9 s / 14 m, beam ~2.9 s, running ~2 s; untimed ~1.4 s.
    `airTurn` 4.5 rad/s (a 360 in ~1.4 s).
  - Landing (`land()` / `alignment()`): heading vs travel within 30° clean, to 65° sketchy (keeps 75%
    speed), beyond is a gentle wipeout (board rolls, rider topples, back up after 1.6 s). Landing
    backwards is a revert (smoothed `visualYaw` swings the model round). Toasts: "360 · 2.6s air ·
    clean", "180 · revert · clean", "Wipeout!".
  - Cues and feedback: in the air a ring on the sea below you (stretched along your heading) and the
    board's rim glow green / amber / red for clean / sketchy / wipeout. A red pennant at the mast top
    streams downwind. Glowing wake ribbon (`Wake.js`), carve spray and landing bursts (`Spray.js`,
    instanced droplets). HUD: controls, speed, point of sail and power.
  - Camera and controls: `src/core/ChaseCamera.js` (spring-damped, follows travel, dips on landing, stays
    above the sea). `F` toggles fly/surf (`?fly` starts in fly), `R` resets. `Input.wasPressed` / `tap`.
    `App.time` is a game clock (sum of capped dt) so tab switches don't jump the sea.
  - **Testing:** with the pane hidden, drive frames with a fake clock: `t += 1000 / 60; __ew.frame( t )`
    in a loop (don't mix with live rAF timestamps). Wait on a rising face with
    `s.grounded && s.velocity.y > 2` before `input.tap( 'Space' )` for a timed pop.
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
Milestone 4 is functionally there. Ask the user to try docking, walking and talking. Possible polish: a
proper board-rack / slip visual, motes hidden over the deck, footstep bob for the camera, more NPC
variety. Then **milestone 5 (the loop)**: job board (courier and race), stardust collectibles, trick
scoring, the shipwright's upgrade shop (credits modify the `BOARD` / `WIND` numbers via `game/Gear.js`
tiers), HUD, and saving to localStorage.

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

### 2. Solar surfer (the core feel) ✅
- `src/player/Surfer.js`: board physics against `Etherium.heightAt` and `normalAt`: gravity along the
  slope, drag, grip (lateral friction), sail thrust from the wind direction times the trim, jumping off
  crests, air control, and landing alignment.
- Chase camera (spring-damped, looks ahead, dips on landing). `F` toggles the fly camera for debugging.
- A placeholder board and rider (primitives) with lean and crouch.
- **Done when:** carving down a swell and launching off a crest feels good. Tune until it does. This is
  the make-or-break milestone.

### 3. Sky ✅
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
