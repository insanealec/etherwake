# Etherwake: roadmap

**Read this first each session.** Update the status and "Next up" sections at the end of every session.

## Status
- **Current milestone:** 8, regions and polish (slices 1-3 done: the Flare Reach, the Ring Reach, the Rim). Milestone 7 done.
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
- **Milestone 4 slice 3 (2026-09-28), from user feedback** ("the dock is so large, walking to the people and
  back sucks"): dock and launch anywhere. `port.dockPoint(x, z)` finds the nearest deck spot within 6 m
  of a slow board; `port.launchEdge(x, z)` returns a sea spot just off any outer deck edge (pier ends and
  sides, the ring's outer edge; not the moonlet side or pier roots) and the heading out: "picking up the
  board". Pier-end slips are gone. Talk from the board: each character stands at the ring's outer edge
  with a glowing mooring buoy on the water in front (`Npcs.nearestMooring`, 7 m); E talks without
  docking, and the board is held still during dialogue. Walking remains optional.
- **Milestone 5 slice 1 (2026-09-28):** credits (✦, HUD top-right with a pop) saved in localStorage
  (`src/game/Save.js`, key `etherwake.save.v1`, every access wrapped; stats: stardust, tricks, bestAir;
  "reset saved progress" in the tweak panel). `src/game/Rewards.js`: `REWARDS` payouts and
  `trickPayout( landing )` (per 180 of spin, revert, air past 1.5 s; sketchy pays half; wipeouts nothing),
  plus the `STARDUST` table. `src/world/Stardust.js`: 48 seeded trails of 10 motes (220 to 1100 m from
  the harbour, mostly along the crests; 35% arc 7 m high over a crest so you have to jump), instanced
  spinning gold octahedra riding the swell, a faint light pillar per trail for finding it from afar
  (fades up close), trails respawn after 90 s. +1 per mote, +5 per whole trail.
- **Milestone 5 slice 2 (2026-09-28):** courier jobs. The user had noticed NPCs "still say the
  placeholder" (true: jobs and shop weren't built yet). `src/game/Jobs.js` (`COURIER` tuning) and
  `src/game/Courier.js` (offer, accept, parcel buoy with a teal beacon, crate carried on the board,
  delivery at the dockmaster's mooring, timeout, abandon; `update()` returns 'picked' / 'delivered' /
  'failed'). The dockmaster's conversation is built in `App.talkTo()`: an offer with distance, compass
  heading, time and pay, then E accept / Q not now (`Dialogue` now supports `choices` on the last line);
  mid-job it offers "abandon". Pay: 25 + 0.09/m, +50% if delivered with over half the time left.
  `#objective` HUD: an arrow relative to the camera, the distance and a countdown (red under 20 s).
  **Gotcha:** apostrophes in JS strings written through python edit scripts lost their escaping and
  broke the page (a SyntaxError left `__ew` undefined); use double-quoted JS strings for such text.
- **Milestone 5 slice 3 (2026-09-28):** the user asked to remove the piers ("they just get in the way,
  docking around the boardwalk is fine"): the port is now just the ring (lantern posts and 4 point
  lights around its outer edge; `dockPoint` / `launchEdge` / `walkable` / `collide` are ring-only);
  spawn moved to (70, 6). The shipwright's shop: `UPGRADES` in `src/game/Gear.js` (sail canvas: thrust;
  hull polish: dragQuad; grip rails: grip + turnRate; pop springs: jump + maxLaunch; 3 tiers each,
  60 to 500 credits), `BASE_BOARD` and `applyUpgrades( levels )` (reset BOARD then apply owned tiers;
  called on load and after each purchase). `Save` gained `upgrades`, `spend()`, `level()`,
  `setLevel()`. `App.openShop()` / `buy()`: talk at the shipwright's mooring, 1-4 buys the next tier,
  Q leaves; the shop reopens with the shipwright's reply. `Dialogue` choices are generic keys now and
  list one per line when there are more than two.
- **Milestone 5 slice 4 (2026-09-28):** races. `src/game/Races.js` (`COURSES` as polar gate lists around
  the harbour with gold/silver times; `RACE` pay and gate size) and `src/game/Race.js` (brass ring gates
  riding the swell 4 m up, facing along the course; the next gate glows gold with a beacon, the one
  after is dimly lit; the clock starts at gate 1; `update()` returns 'start' / 'gate' / 'finish').
  A fourth character, the **Race marshal** (shack 6), offers the courses with your best time and the
  medal times; mid-race, talking offers to abandon. Finish pays 20, silver 40, gold 90, +15 for a new
  best; best times saved in `save.data.races`. The objective HUD shows the race (gate n/N, distance,
  running time) ahead of any courier job; starting a race abandons a courier job. Medal times set from a
  straight-line autopilot run.
- **Races, round 2 (2026-09-28),** user: races "kinda meh", the triangle arrow was ambiguous. The
  objective arrow is now a notched SVG arrow (no rotation transition, which spun the long way round).
  Gate types in `COURSES` (`[ angle, distance, type ]`): **boost** gates (teal, centred at rider height
  with a glowing sweet-spot disc: cross within 2.5 m of the centre for +9 m/s along your heading, a spray
  burst and a field-of-view kick) and **air** gates (rose, ring bottom 1.5 m above the swell: any
  ordinary jump clears it; the user asked not to need big waves). Gates now count when you cross their
  plane going forward inside the ring (offset from the centre decides the boost). Per-type lifts in
  `RACE.lift`. Medal times re-set from an autopilot that hits every boost and jumps every air gate
  (loop ~68 s, crest ~125 s): gold 62 / 115, silver 76 / 140.
  Then the user found jump gates unfun: gate types were removed. **Every gate** now sits at rider height
  with the teal sweet-spot disc and boosts you if you cross its centre (`RACE.lift`, `boostRadius`,
  `boostSpeed`). Autopilot hitting every centre: loop ~65 s, crest ~117 s; gold 60 / 108, silver 72 / 130.
- **Milestone 6 slice 1 (2026-09-28):** the user likes the whale-leviathans of Death Stranding and the
  space whale of Beyond Good & Evil (ours is original). `src/world/Leviathans.js`: a procedural unit-length
  whale (lofted body with a blunt head and long taper, swept wing-like pectoral fins, notched flukes;
  merged, with `along` and `fin` attributes), `MeshStandardNodeMaterial` with a TSL swim wave travelling
  to the tail and slow fin beats; emissive skin: patches that are windows onto the cosmos (nebula and
  `starLayer` from `Starfield`, now exported, sampled along the view direction), glowing freckles, cyan
  flank stripes with pulses running nose to tail, gold eyes, a cyan rim aura. A pod (`POD`: 64 m, 52 m and
  a 26 m calf) swims `MIGRATION` (an ellipse 560 x 460 m around the harbour, 11 m/s in `WorldLayout`)
  with backs breaking the gas, gently bobbing, and each breaches every 35 to 70 s (9 s arc, a third of a
  body length up, pitched to match). **Testing note:** the pane often hides; screenshots are stale then.
  Let the real loop run, place the fly camera, wait, then screenshot.
- **Milestone 6 slice 2 (2026-09-28):** bow waves. `BOW` table and `setBowWave()` in `Etherium.js`: per
  whale a smooth mound over and ahead of the head (0.1 body lengths high, so ~6.4 m for the lead) plus a
  V-shaped wake (~19.5 degree arms, fading over 3 lengths), added to both `sampleGrid` (JS) and
  `etheriumWaves` (TSL) with a finite-difference slope for the normal, so physics, sea, motes and shells
  all ride them. `Leviathans.update` sets each whale's bow wave (fading while it breaches);
  `Leviathans.collide` keeps the board out of the bodies (a capsule per spine, only at body height).
  `App.rideBowWave`: on the board, grounded, over 6 m/s, on a surface lifted more than 1.5 m by a bow
  wave: +5 credits every 4 s (`REWARDS.bow*`). Test: a board placed on the lead's bow face going 13 m/s
  stayed with the whale for 12 s and earned the bonus. **Test gotcha:** `import()`-ing a module from the
  console can load a second copy with separate state (e.g. `bowHeightAt` read 0); go through `__ew`.
- **Milestone 6 slice 3 (2026-09-29):** the first audio. `src/audio/Audio.js`: disabled by `?noAudio`
  **or** localStorage `etherwake.noAudio` = '1' (set in the test pane; the preview port changes, so the
  flag is the reliable way); the AudioContext only starts on a trusted key press or click (scripted
  `__ew.input` can't start it); master volume 0.35 through a limiter; M mutes (remembered); a generated
  5 s hall reverb; the listener follows the camera. `src/audio/WhaleSong.js`: synthesised calls (sine +
  soft triangle harmonic gliding through 4 pitches, vibrato, lowpass, reverb send), one PannerNode per
  whale (inverse distance, ref 150 m), a call every 7-18 s, 50% chance another whale answers; the calf
  sings higher. Levels checked by silent `OfflineAudioContext` renders: peak ~0.14 full scale at 60 m,
  ~0.04 at 500 m. Tweak panel: Audio folder (volume, mute). "A leviathan pod!" toast within 300 m (at
  most every 3 minutes). **Audio testing rule:** set `localStorage['etherwake.noAudio'] = '1'` in the test
  pane before anything; verify sound only with offline renders.
- **Milestone 7 slice 1 (2026-09-29):** the user wanted the galleon further out than the whales; agreed:
  `GALLEON` in `WorldLayout` at (-120, -1150), north of the harbour beyond the whale loop and the
  stardust (a beam reach both ways). `src/world/Galleon.js`: procedural 36 m ship (`SHIP` table): a
  lofted hull with a rising sheer, rails 0.9 m above the deck, plank lines and a brass rail stripe; a deck;
  a stern castle with lit windows; a bowsprit; two masts with bellied gold solar sails (ribbed, glowing
  in the middle); fan-shaped solar wings off each side; lanterns and masthead lights; a rose-gold beacon
  beam (fades up close). Lights, sails and beam have `fog: false` so it reads from the harbour. It rides
  the full swell at anchor (height, pitch and roll from sampling bow, stern and both sides, smoothed).
  An oriented-box collider stops the board (skipped above deck height). "The solar galleon!" toast on
  first approach (saved as `foundGalleon`).
- **Milestone 7 slice 2 (2026-09-29):** boarding. `Walker` now stands on a **platform**
  (`{ deckY, yaw, walkable( lx, lz ), toWorld( local, out ), launchEdge( lx, lz ) }`), keeps `local`
  coordinates and refreshes world `position` in `sync()` every frame (App calls it after the galleon
  floats), so a moving deck carries you. `port.platform` (local = world) and `galleon.platform` (ship
  coordinates via `group.matrixWorld`). Galleon: `walkable` (between the rails, not the stern castle or
  the masts), `toLocal`, `dockPoint` (alongside the hull, slow: "E · climb aboard"), `launchEdge` (either
  rail: over the side, heading away), `cameraObstacles` (hull, castle, masts; the walk camera uses port +
  ship obstacles). The **Quartermaster** (`QUARTERMASTER` in `game/Characters.js`) stands by the stern
  castle: the helm stays lashed "till the shipwright signs her over" (the hook for slice 3).
- **Milestone 7 slice 3 (2026-09-29):** the helm. The user chose a big credit purchase: `DEEDS.galleon`
  (500 credits, "for now") in `game/Gear.js`, option 5 in the shipwright's shop, saved as `ownsGalleon`;
  the quartermaster's `ownedLines` then explain the helm. A ship's wheel just forward of the stern castle
  (`HELM_SPOT`); E there takes the helm (mode `helm`, on foot at the wheel): A/D rudder (needs way on),
  W/S raise/lower the sails (a setting, 0 to 100%), the solar wind drives her via `sailPower` like the
  board (`SHIP` tuning: ~14 m/s at full sail on a beam reach; a keel kills drift; a little slope push);
  she can't enter the harbour ring. A second `ChaseCamera` (now configurable) follows the ship from 42 m.
  E leaves the helm: sails furl, she coasts to a stop; her pose is saved (`save.data.galleon`, every 5 s at
  the helm too) and restored on load. Docking onto her needs matched speed (relative < 8 m/s); dropping in
  under way keeps her velocity. HUD at the helm: speed, sails %, point of sail.
  User feedback: "drives like the little sailboat", raising/lowering sails "doesn't do anything", "real
  slow". Now: `SHIP` thrust 3.0 / drag 0.02 / dragQuad 0.003: ~30 m/s on a beam reach, ~25 running, ~9 s
  to 20 m/s (heavy but fast, for crossing distance). The sails visibly reef: hung from yards, they drop
  as you raise them and pull up to a strip when furled, the wings fold in, and the glow scales with the
  canvas out (`sailShown`, `uSailGlow`). HUD sail gauge (5 blocks + %).
  Wording then changed to "W more sail / S less sail" (the user found "raise" backwards).
- **Milestone 8 slice 1 (2026-09-29): the Flare Reach.** `REGIONS.flare` in `WorldLayout` (~4 km out
  toward the sun, radius 750 m, fronts travel along `dir` away from the sun); tuning in
  `src/game/Flares.js` (`FLARES`: every 95 s an 8 s warning then a 12 m front at 22 m/s; `FLARE_TINT`).
  `Etherium.js`: `setFlareRegion` / `setFlare` and a sech² flare-front in both wave functions via
  `extraHeight` (bow waves + flare, JS and TSL, finite-difference normals); the sea tints hotter by
  `uFlareMix` and the front's face glows; the fog blends to ember inside (`regionMix`). `Starfield`
  exports `uSunBoost` (the sun pulses during warnings and launches). `src/world/Regions.js`: the flare
  cycle, atmosphere blend by distance, enter/leave/warning/launch events, a flickering ember column
  (900 m, fog-free, fades up close) that sits under the sun seen from the harbour. App: toasts, and
  riding a front pays +15 every 3 s (`REWARDS.flare*`). Holding W on the board you slowly outrun the
  front (~23 vs 22 m/s), so holding its face means easing off.
  User: the galleon stalled sailing into the wind toward the Reach ("weak for such a huge ship"). Added a
  **solar drive** (`SHIP.solar` 0.6): starlight in the sails gives that share of full push on any heading;
  the wind adds more on good points of sail (`push = thrust * max( solar, windEfficiency ) * sail`).
  Dead upwind ~21 m/s (HUD says "solar drive"), beam ~30; anchorage to the Reach in ~94 s at ~26 m/s.
- **Flare Reach, round 2 (2026-09-29),** user: "kinda small", waves "not any more wild", "nothing to do or
  stop there", "not worth the distance for the points since there's no nearby shop"; no danger wanted.
  Now: radius 1400 m; the Reach's ordinary swell is 1.8x taller (`REGIONS.flare.swell`, a regional
  height factor in both wave functions: ~33 m crest-to-trough vs ~17 outside); fronts every 50 s, 15 m,
  up to `FRONTS` = 3 at once (`setFlare( i, s, H )`, uniforms `uFlareS` / `uFlareH`); **sunstones**:
  10 rose-gold gems along each front's crest, placed around the player's line (+20, `REACH.sunstone`);
  **credits x2** inside the Reach (`App.earn()`, `REACH.multiplier`; tricks, bow waves, flare riding,
  sunstones; HUD tag); the **Ember Outpost** (`src/world/Outpost.js`, `OUTPOST` in WorldLayout): a
  floating raft at the Reach's heart riding the swell, lantern mast, awnings, a mooring buoy, and the
  **Outpost trader** (`TRADER` in Characters) who opens the same shop as the shipwright (upgrades and
  the galleon deed).
- **Save safety (2026-09-29):** the user saw upgrades "reset sometimes". Cause: my automated tests called
  `save.reset()` in the shared browser pane (the user plays there too), and tabs overwrote each other.
  Fixes: `__ew.testMode()` (a throwaway `etherwake.save.v1.test` slot and audio off, for that page session
  only; call it first in every test script; see CLAUDE.md); `Save` listens for the `storage` event and
  adopts another tab's newer save (`onExternal` re-applies upgrades). The stored `etherwake.noAudio` flag
  is no longer used in the pane (it muted the user's game too); navigate with `?noAudio` instead.
  Second cause found: the preview got a new port every session (5190 is held by an old orphaned Vite,
  PID 46888), and localStorage is per origin, so each new port meant an empty save. The preview is now
  pinned to 5191 (`.claude/launch.json`: `--port 5191 --strictPort`, autoPort off). Granted the user
  500 credits there to make up for lost progress.
- **Milestone 8 slice 2 (2026-09-30): the Ring Reach.** `REGIONS.rings` (~4.2 km toward the gas giant,
  radius 1300; tuning in `src/game/Rings.js`). `Regions` now handles several regions: each blends its
  fog and sea tint in with distance, the strongest one sets `sea.regionFog`, `uRegionSea` and
  `uRegionRecolor` (0 = multiply, 1 = repaint by brightness: the Rings use 0.85 to read as frost), and
  the one you're inside sets the pay multiplier (`regions.multiplier`, used by `App.earn`); events are
  `{ type, name }`. `src/world/Rings.js`: a 45 x 120 m glowing ice spire (fog-free landmark), 220 seeded
  floating shards (instanced, icy rim-glow material) that stop the board, clear of the station and the
  slalom gates; close shaves (within 2.5 m at > 12 m/s) pay 4, rime crystals 10 (respawn 120 s), all x2
  inside. `Outpost` is now parameterized (`{ at, npc, colours }`): the Ember Outpost (trader) and
  **Frostwater Station** (`FROSTWATER`, the **Ice pilot** `PILOT`: the shop plus R for the **Shard
  Slalom**, an 11-gate course weaving round the spire; courses can have a region `center`; the harbour
  marshal lists only harbour courses; `App.raceChoice`). Slalom medals from an autopilot (~117 s):
  gold 108, silver 130.
- **Milestone 8 slice 3 (2026-09-30): the Rim.** `REGIONS.rim` (4.6 km south, radius 1400; tuning in
  `src/game/Rim.js`). **Infalling ring waves** (concentric sin swells moving inward at 13 m/s, 5 m, fading
  at the core and edge) in both wave functions (`extraHeight( p, t )` now takes time). `src/world/Rim.js`:
  the black hole 1100 m up and 900 m south of the centre (black horizon, fresnel photon ring, additive
  accretion disk with orbit-speed streaks and Doppler-ish beaming, all fog-free), `uLens` (screen
  position and horizon radius) feeding a **lensing post pass** in `App.buildPipeline` (samples the scene
  toward the hole, ~rs²/r; the horizon mask is applied after bloom so no glow bleeds over it); a
  **swirling current** (`Rim.current`, up to 3.5 m/s²) and **low air gravity** (`Surfer.gravityScale`,
  0.65 inside); 45 **void pearls** 7-13 m above the swell (+15, respawn 120 s); x2 pay; **Horizon Station**
  (`HORIZON`, the **Stargazer** `STARGAZER`: the shop). Measured: jumps 6.2 s of air at 0.55 gravity
  (too floaty), now 0.65.
- **Navigation (2026-09-30):** `src/ui/Compass.js`: a bearing strip across the top (cardinals, ticks,
  markers for the harbour, the galleon once found or owned, and the three regions, with distances; the
  name shows when a marker is near the centre; off-strip markers pin to the edge, dimmed). `src/ui/SeaMap.js`:
  Tab opens a round chart (north up, range rings every 2 km, region circles and names, harbour, galleon,
  whale pod, your arrow). `App.places` / `App.updateNavigation`. The objective line moved down to 50 px;
  `Input` swallows Tab's default focus change.
- **Graphics and performance pass 1 (2026-10-01),** user: hosting later (Cloudflare Pages when ready, like
  their other site); "graphics aren't as impressive" as Tidewater. Sea: per-pixel ripple normals (two
  scrolling `mx_noise_vec3` layers, faded by distance), a brightness ripple, a sun sheen and a grazing sky
  reflection. Post (`src/post/Cinematic.js`): god rays (radial blur of bright pixels toward the sun),
  +15% saturation, split toning, vignette, light grain; `?noCinematic` to compare. AgX was tried and
  rejected (washed the nebula colours grey); ACES stays. CPU: `sampleGrid` modes ('shift' for the
  refinement steps, 'height', 'full'), so height lookups skip the extra lifts and normals (4.5 -> 1.4 us,
  identical heights), and stardust / shards / crystals / pearls only bob within 700 m of the camera:
  game logic 5.1 -> 0.85 ms per frame. **Measurement gotcha:** with the Claude window behind others the
  pane is throttled and `benchmark()` reports ~18 ms regardless of resolution; trust CPU timings
  (`frame()` with `pipeline.render` stubbed) or ask the user for an fps reading.
- **Gas sea (2026-10-02),** user: waves should be "less like water waves, more like a gas nebula... not
  the balls we ride through, but more gassy". The sea's colour shader now ray-marches a short way into
  the gas (`GAS` in `Etherium.js`: 9 m in 8 steps along the view ray, bent downward so grazing views sink
  in), gathering glowing density from domain-warped 3D noise (patchy near the surface, fuller deeper;
  hot crest colours near the top, teal/violet deeper) with absorption, so layers parallax like a volume.
  The water cues from pass 1 are gone (ripple normals, sun sheen, sky reflection); the back-lit glow
  stays. Gas shells are thicker and taller (0.7 / 1.6 / 2.7 / 4.0 m, strength 0.3) so crests fray into
  mist; motes are dimmer and the near layer sparser (accents, not the main event). Swell shapes and
  physics unchanged.
- **Cloud sea (2026-10-02),** user: the gas sea still read as "water covered by haze"; wanted "surfing
  through/on a cloud". The volume march is gone. The sea is now lit as cumulus cloud tops: billow-noise
  lumps (two sizes, `CLOUD` + `billow()` in `Etherium.js`) lift the mesh near the camera and bump the
  normals, shaded by `cloudColor()` (sun-wrapped diffuse, sky light, violet creases, glowing crest colours,
  silver lining); new palette entries `cloudLit*` / `cloudShade*`. New `sea/Puffs.js`: 64x64 instanced
  sprite billows heaped on the crests, shaded with the same `cloudColor` as lumpy spheres, soft depth fade
  into the sea, parted by the board, thinned with distance (they form the cloud bank on the horizon).
  The haze shells are off by default (`?shells` brings them back; `?noPuffs` hides the puffs). Billows
  are visual only: the board rides the smooth swell and sinks a little into the lumps.
  Feedback round: the puff bank hid the destination (puffs smaller, fainter, gone by 90 m); the rolling
  clouds were liked but should be more transparent, so the sea is now see-through near you (`CLOUD.clear`,
  thin in the creases, dense on lump tops and beyond ~220 m) with a dimmer deep cloud layer
  `CLOUD.deep` = 9 m below (`buildDeepMaterial`, a child of the sea mesh) to look into.
  Colour round (user ref: JWST "Cosmic Cliffs"): cloud palette moved from purple to blue-violet (then back a step toward purple at the user's request) and
  lavender with deep blue/indigo creases (`cloudLit*` / `cloudShade*`); crest gold/rose and fog unchanged.
- **Graphics pass 2, slice 1: nebula cliffs (2026-10-02).** In the sky backdrop (`sky/Starfield.js`,
  `NEBULA` table): banks of gas rise from the horizon all round, after the JWST "Cosmic Cliffs" photo the
  user shared. Domain-warped fbm billows under a per-azimuth height profile; fake volume lighting compares
  the density with the density a step toward the sun (lit amber edges, rust bodies, dark folds); blue gas
  glows just above the tops; the low parts fade into the horizon colour (aerial perspective); the sun dims
  behind them. Also: `WhaleSong` no longer throws every frame if audio started before it was built (seen
  after a hot reload).
- **Graphics pass 2, slice 2: the surfer (2026-10-02).** New `player/SurferModel.js` (Surfer.buildModel
  delegates to it; `rimMat`, `sail`, `rider` kept). Board: extruded hull with bevelled rails, nose/tail
  rocker, wood-grain deck over a dark hull, brass rail tube (still the landing cue), gold inlay, twin tail
  thrusters whose nozzles glow with the throttle. Sail: cambered grid with a roach, seams, glowing gold
  battens, fluttering leech (TSL vertex), a little glow when backlit; wishbone boom. Rider: two-bone IK
  legs (knees bend with crouch) and arms (hands on the wishbone grips), sideways stance on the windward
  side that turns round when the sail crosses sides, goggles, hair, belt; a scarf streaming from the neck.
  Test camera trick: fly mode plus a rAF loop that pins the surfer and places the camera round it.
- **Graphics pass 2, slice 3: figures and galleon (2026-10-02).** `player/Figure.js` rebuilt in the rider's
  style (tapered coat with skirts, belt, buckle, collar, hair, hats with brass bands, goggles for the
  player; hip/knee/shoulder pivots, knees bend in the walk cycle). `Galleon.dress()`: topsails (in
  `sailMeshes`, so they reef), rope rigging (LineSegments shrouds and stays), brass cap rails, glowing
  portholes, verdigris copper sheathing and a brass wale stripe in the hull shader, a brass star
  figurehead, a stern balcony, a castle cornice and a fluttering mainmast pennant. Decoration only:
  collisions (`solid`) unchanged.
- **Motion feel (2026-10-02).** `MOTION` in `core/ChaseCamera.js`: landings add camera trauma
  (impact x 0.055, decays ~1/s; toned down once at the user's request) shown as roll and pitch shake (trauma squared); a faint rumble at speed.
  Speed 12..34 m/s maps to `app.speedFx` 0..1: up to +9 degrees of field of view and speed lines
  (`speedLines()` in `post/Cinematic.js`, `SPEED_LINES`: thin dashes streaming out at the screen edges).
- **Per-region look (2026-10-02).** `LOOK` in `post/Cinematic.js` (open sea: exposure 1.0, bloom 0.55,
  saturation 1.15); each region's `tint.look` overrides it (Flare Reach hotter and glowier, Ring Reach
  crisp with less bloom, the Rim darker), blended by `Regions.look` and applied in App (tone-mapping
  exposure, `bloom.strength`, `uSaturation` in the grade). The region sea tint now goes through
  `Etherium.regionTint()`, shared by the sea, its deep layer and the puffs (before, the see-through
  layers stayed violet everywhere). The Flare Reach repaints the clouds molten amber (`recolor: 0.8`).
- **Summon the galleon (2026-10-06).** G while surfing, once you own her: `App.summonGalleon()` moves her
  (`Galleon.moveTo`) alongside you, parallel to your heading, at the first spot (45..150 m, beside you
  first, then ahead or behind) whose whole hull line clears the harbour ring, the outposts, the ice spire
  and every ice shard (`galleonSpot`); the pose is saved. The surf hint shows "G galleon" when owned.
- **Galleon shares the board upgrades (2026-10-06).** `SHIP_FROM_BOARD` / `boardRatio()` in
  `game/Gear.js`: the galleon's thrust, dragQuad and turnRate scale by the board's ratio to its starter
  numbers (sail canvas, hull polish, grip rails). Full canvas, 60 s run: 26 m/s base, 32 with tier I of
  each, 43 fully upgraded; turning up to 1.35x. Shop blurbs mention it.
- **Title screen (2026-10-06).** `ui/Title.js` (+ `#title` CSS in `index.html`): the name over the live
  scene while App circles the camera round the harbour (`TITLE.orbit`, `App.titleOrbit`), "set sail" or
  "continue your voyage" with credits and the galleon, the controls. Input is ignored while it's up;
  any trusted click or key closes it (the same gesture starts the audio). The HUD hides under
  `body.on-title`. Skipped with `?noTitle` / `?fly`, and closed by `__ew.testMode()`.
- **Graphics pass 3, slice 1: temporal AA (2026-10-06).** The scene pass writes an MRT (`output`,
  `velocity`); `traa()` (three/addons TRAANode) jitters the camera and blends the reprojected history;
  its texture feeds the lens warp, bloom and god rays as before. MSAA is off (TRAA needs it off);
  `?noTAA` restores MSAA. Cost: a wash, ~3.3 ms/frame at 651x700 either way (`__ew.benchmarkFrame()`,
  which now waits for the GPU each frame; a queued batch returned before the work was done).
- **Graphics pass 3, slice 2: the volumetric etherium (2026-10-06, default; `?noVolume` for the mesh sea).**
  `sea/SeaHeight.js`: each frame the swell height (fixed-point solved, plus all the lifts) and the sea
  mesh's own cloud lumps (`billow()`, both sizes, and their crease occlusion) go into a 512 m / 512 px
  half-float texture round the camera, heights stored +100 (the render target clamps negatives: troughs
  read as 0 before). `sea/CloudNoise.js`: tileable 64^3 Perlin-Worley (R) and Worley fbm (G) at startup.
  `sea/Volume.js`: full-res raymarch (rtt) composited over the scene before TRAA (the composite gets its
  own explicitly sized rtt: TRAA reads its size before an auto-sized one is ready = 1x1 history = flat
  screen). Density: solid below the cloud top = swell + the mesh's lumps (x1.8) + 3D noise fringe and
  fraying; sparse loose puffs drifting above (kept off the camera); the board parts the gas and a 2.6 m
  tunnel keeps the camera's view of the rider clear. Steps grow with distance; empty space above is
  skipped conservatively (a cloud top rising at most 0.7). Shading: `cloudColor` with a normal from the
  density gradient (tilted 2x like the mesh's bumps), dimmed by 3 sun-shadow samples and the lump
  creases. The mesh drops its near part through a dithered band; the chase camera rides 4.8 m above the
  swell. **Gotcha:** inside a full-screen pass, three's `cameraPosition` / `cameraWorldMatrix` /
  `cameraProjectionMatrixInverse` are the quad's camera: bind the game camera's matrices as uniforms.
  Cost: ~3.3-3.5 ms/frame at 651x700 with or without it on this GPU. Debug views: `?volDebug`, `=n`,
  `=t`, `=e`, `=d` (see Volume.js). Hidden-pane testing: rAF stops, so step `__ew.frame( t )`.
  Follow-up (user: "looks really bad in the air / from a distance", not TAA): (1) the cloud tops were
  terraced: fixed ray steps landed on the top at step-sized intervals. Now steps are surface-aware
  (distance to the cloud top over the ray's descent plus a 0.7 max slope; fine steps inside the soft
  edge). (2) `lumps()` in Etherium clamped |noise| into flat plateaus with hard rims (shared by the mesh):
  now a smoothstep. (3) Distance LOD: the 3D fraying fades 25..90 m, the edge softens and the normal
  exaggeration goes away with distance. (4) The height texture is 32-bit float (half floats at +100 m
  snap to ~6 cm). ~3.7-3.9 ms/frame at 651x700.
  Second follow-up ("some cloud peaks are glitchy"): the march slab was sized for plain swell, so taller
  crests (regions, flare-fronts) were sliced flat: now +-3.5x uMaxAmp + 15 m (empty space is skipped).
  The hand-off disagreed: the volume drew both lump sizes x1.8 while the mesh's lumps faded out by 220 m.
  Now SeaHeight's alpha holds the big lumps alone; the volume blends to exactly those beyond its detail
  range, the mesh keeps its lumps out to 300..450 m, and the dithered hand-off is narrower (0.85..0.95
  of the range).
  Third follow-up ("bare from a distance"): the LOD was too aggressive once terracing was fixed. The
  fraying now fades 60..180 m and the full lumps stay until 0.65..0.9 of the range (then the mesh's).
  Camera "jolt on turning" (user): the volume was composited before TRAA, but its pixels had no motion
  vectors (the near sea mesh is cut away there, so the background's zero velocity was used): on fast
  turns TRAA reprojected the clouds as if static, they lagged and snapped back. Now the volume is
  composited after TRAA (its jitter pattern is fixed per pixel, no temporal shimmer). Galleon sails and
  wings are opaque so they write depth (the volume drew over them). **Testing gotcha:** with the render
  loop stopped (manual `frame()` stepping), screenshots can time out and return a stale frame: restart
  `renderer.setAnimationLoop` before taking the proof screenshot.
  Black boxes on screen for a frame (user, at 1920x953; the left 655 px = 512 x a 1.28 display scale
  drawn, the rest black): SeaHeight was rendered by hand before the pipeline (setRenderTarget + a
  QuadMesh) without saving/restoring the renderer's state, so its 512 px viewport could leak into the
  frame. Now it's an `rtt()` node inside the pipeline (RTTNode resets and restores renderer state).
  Rule: render nothing outside the pipeline by hand; use rtt() nodes.
  The black boxes kept happening (user, Chrome, 60 fps, nvidia): the real cause was NaN pixels, which
  bloom's blur spreads into big black blocks for a frame. A scan of every stage caught NaN in the volume
  output once in ~150 frames. Sources: `pow()` with a base a hair below 0 (GPU pow of a negative is
  NaN): `pow( 1 - dot( N, V ), k )` when dot rounds above 1 (cloudColor's silver lining: the volume's
  normals face the camera far more often than the mesh's did), and the wake's `pow( sin( uv.x * pi ),
  2 )` (sin( pi ) is -9e-8). Fixed everywhere (clamp the dot, square by multiplying), and the scene colour
  is clamped (max 0, min 60000, which also drops NaN on GPUs) before bloom and the god rays.
  **Rule: never pow() a base that can dip below 0; clamp it first.**
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
**Graphics pass 3: stretch the limits** (user, 2026-10-06: back to the original goal of pushing how good
it can look, Tidewater-level; the foundation is in place, now upgrade). three 0.186 ships most of the
tools as TSL nodes in `three/addons/tsl/display/` (TRAANode, TAAUNode, GTAONode, MotionBlur,
TemporalReprojectNode, LensflareNode, SSRNode...). Slices, in order:
1. ✅ **Temporal foundation:** a velocity MRT on the scene pass and TRAA (temporal AA). Kills shimmer on
   rigging, rails and cloud edges; later slices accumulate over frames on top of it.
2. ✅ **The hero: a volumetric etherium.** Raymarch the cloud sea as real 3D gas near the camera (density
   from the swell height plus 3D noise, a few light steps toward the sun for self-shadowing, emission in
   the palette), at reduced resolution with blue-noise jitter and temporal accumulation, composited by
   depth. Replaces the see-through layers and the puffs; the board and the ship carve channels in it.
3. **Shadows and AO:** the rider, board and galleon shadow the clouds (shadow map read in the volume and
   the sea shader); GTAO on the ship and port.
4. **Volumetric sky nebulae** and light shafts through the cloud volume.
5. **Motion blur** (from the velocity MRT) and auto exposure.
6. **Hero materials:** CC0 PBR textures (Poly Haven / ambientCG) for wood, brass and canvas.
Each slice: measure the frame cost (ms) before and after, keep a URL flag to turn it off.

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
