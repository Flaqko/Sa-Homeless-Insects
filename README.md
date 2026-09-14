# Homeless Insects v1.0

A lightweight CLEO Redux immersion mod for **Grand Theft Auto: San Andreas Classic**.

Ambient homeless pedestrians have a **70% chance** to spawn with GTA San Andreas' built-in `INSECTS` particle effect attached to them.

## Features

- 70% chance per qualifying homeless ped.
- Each ped is rolled only once during that ped's lifetime.
- Scans for new qualifying peds only once every 2 seconds.
- Uses GTA's built-in character-attached `INSECTS` FX.
- No per-frame movement tracking or FX repositioning.
- Detects homeless pedestrians by their actual `CPedStats` classification instead of model ID:
  - `STAT_TRAMP_MALE = 26`
  - `STAT_TRAMP_FEMALE = 27`
- Supports replacement and add-on skins automatically when their `peds.ide` entry uses one of the tramp stats above.
- Ignores mission/script-created actors so the effect stays focused on ordinary world population.

## Requirements

- GTA San Andreas Classic 1.0 US
- CLEO Redux with JavaScript support

This script reads GTA SA memory directly, so **keep `[mem]` in the filename**.

## Installation

1. Install CLEO Redux.
2. Copy `HomelessInsects_v1.0[mem].js` into your GTA San Andreas `CLEO` folder.
3. Start the game.

## Uninstall

Delete `HomelessInsects_v1.0[mem].js` from the `CLEO` folder.

## Notes

The FX emitter is attached to the pedestrian and follows them through GTA's own FX system. Individual insect particles can briefly trail behind a moving ped before expiring; this is normal behavior for the built-in effect.

## Version History

### v1.0

- First public release.
- 70% insect chance.
- 2-second discovery scan for low overhead.
- CPedStats-based homeless detection instead of hardcoded model IDs.
- Replacement/add-on skin support through `STAT_TRAMP_MALE` / `STAT_TRAMP_FEMALE`.
- One roll per ped lifetime.
- Ambient game-created peds only.
