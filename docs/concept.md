# Etherwake: concept

A space-fantasy **solar-surfing** game for the browser. Tone and look are in the spirit of Treasure Planet:
age-of-sail in space, brass and canvas, warm nebula light, breathable "etherium" instead of vacuum.
Everything (names, ships, characters, creatures) is **original**, inspired by that film but not taken from it.

## The pitch
You're a young solar surfer working out of a floating port on the edge of a nebula. You ride the etherium's
swells and the wave-fronts thrown off by stellar flares, run courier jobs and races, collect stardust and
relics, and spend the earnings on board and sail upgrades. Better gear lets you reach wilder regions: a gas
giant's rings, a leviathan migration route, the rim of a black hole.

## Design north star (from studying Tidewater)
Tidewater (see `docs/research.md`) works because it has **one stunning centerpiece** (the ocean) with a
**simple, satisfying loop** on top. We copy that shape:

| Tidewater | Etherwake |
|---|---|
| FFT ocean and sky | **The etherium sea**: a glowing cloud-surface with rolling swells, crest foam and nebula fog below; later gas giant, rings, star fields, black-hole lensing |
| Island and village | A floating port (brass docks, lanterns, sails), later an asteroid monastery and a crystal moon |
| Fishing | **Solar surfing**: ride swells, trim the sail, catch flare wave-fronts, air and tricks |
| Selling fish, buying gear | Courier jobs, races and collectibles for coin; board, sail and ship upgrades |
| The boat | A small galleon you can board, walk and sail between regions |
| The humpback whale | Star-leviathans: pods you can surf alongside |

**The rule:** milestones 1 and 2 (the sea and the surfing) must *feel good* before anything else gets
built. If riding a swell isn't fun, fix that first.

## The world
- **The etherium**: a luminous, breathable medium. It pools into a vast "sea" layer with a surface you can
  ride. Above is open sky (stars, planets); below is thickening nebula fog that glows and gets dangerous.
- **Solar wind and flare-fronts**: the local star periodically flares, sending big wave-fronts rolling
  across the sea. These are the best surf and the main set-piece moments.
- **Port (working name "Brasslight Harbor")**: a floating dock-town anchored to a small moon. Vendors, a
  job board, the shipwright.
- **Later regions**: the gas giant's rings (ice-chunk slalom), the leviathan route, a flare-storm zone, and
  the black hole rim (gravitational lensing, time-slow).

## The surfer
- A **solar board** with a retractable **sail** (think windsurf and skiff). Sail trim gives speed from the
  solar wind; the swell slope gives speed from "gravity".
- Controls to aim for: steer by leaning; sail in/out for power; crouch to pump on down-slopes; jump off
  crests for air; simple tricks in the air (spin and flip) that pay coin and style.
- Crashing is gentle (tumble, respawn on the board), never punishing.

## The loop
1. Take a job or race from the board at the port.
2. Surf out, reading swells and the wind.
3. Collect (stardust, relics, courier parcels), pull off tricks, beat the clock.
4. Return, get paid, upgrade at the shipwright: board (grip, top speed), sail (power, trim range),
   stabilizers, a lantern for the dark fog, later the galleon.
5. Upgrades open new regions and harder jobs.

Progress saves in the browser (localStorage).

## Characters (placeholders)
- **The shipwright**: gruff, fixes boards, sells upgrades.
- **The dockmaster**: posts jobs and races.
- **A rival surfer**: races you, mouths off.
- Names are still to be decided.

## Tone guardrails
- Warm and adventurous, not grimdark. Wonder first.
- The palette: deep violet, teal and indigo sky; gold, amber and rose light on the etherium; brass and
  canvas on the craft.
- Audio (later): creaking rigging, sail snap, a soft whooshing sea, distant leviathan song.
