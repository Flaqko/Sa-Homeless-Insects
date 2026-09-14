// Homeless Insects v1.0
// GTA San Andreas Classic 1.0 US + CLEO Redux JavaScript
//
// Gives ordinary ambient homeless pedestrians a 70% chance to have GTA's
// built-in INSECTS particle effect attached to their body.
//
// v1.0 release:
// - Scans only every 2000 ms for very low overhead.
// - No hardcoded homeless model IDs.
// - Detects homeless peds through their actual CPedStats classification:
//     STAT_TRAMP_MALE   = 26
//     STAT_TRAMP_FEMALE = 27
// - Custom/replacement/add-on skins are therefore supported automatically as
//   long as their peds.ide entry uses STAT_TRAMP_MALE or STAT_TRAMP_FEMALE.
// - Each qualifying spawned ped gets only ONE 70% roll per lifetime.
// - Once INSECTS is attached, GTA's FX system handles the attachment; this
//   script does not track or reposition the FX every frame.
//
// IMPORTANT: Keep [mem] in the filename. The script reads GTA SA's ped pool
// and the ped's CPedStats pointer.

/// <reference path=".config/sa.d.ts" />

// -----------------------------------------------------------------------------
// Tuning
// -----------------------------------------------------------------------------

const INSECT_CHANCE = 0.70;
const SCAN_INTERVAL_MS = 2000;

// Character-local FX offset. +1.0 matches the older homeless life-situation
// script that uses INSECTS on a character.
const FX_OFFSET_X = 0.0;
const FX_OFFSET_Y = 0.0;
const FX_OFFSET_Z = 1.0;

// GTA SA ePedStats values.
const STAT_TRAMP_MALE = 26;
const STAT_TRAMP_FEMALE = 27;

// -----------------------------------------------------------------------------
// GTA SA 1.0 US pedestrian layout
// -----------------------------------------------------------------------------

const PED_POOL_PTR_ADDR = 0xB74490;
const CPED_SIZE = 0x7C4;
const CPED_CREATED_BY_OFFSET = 0x484;
const CPED_STATS_PTR_OFFSET = 0x59C;
const CPED_STATS_INDEX_OFFSET = 0x0;
const PED_CREATED_BY_GAME = 1;
const MAX_REASONABLE_PED_POOL_SIZE = 2048;

// One entry per qualifying ped already processed. GTA pool handles include the
// slot generation byte, so a reused pool slot normally receives a new handle.
// Stale entries are also removed on later scans.
const pedState = new Map();

let warnedPoolRead = false;
let warnedStatsRead = false;
let warnedFxCreate = false;

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function firstNumber(value, preferredKeys) {
    if (typeof value === "number" && Number.isFinite(value)) {
        return value;
    }

    if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
            if (typeof value[i] === "number" && Number.isFinite(value[i])) {
                return value[i];
            }
        }
    }

    if (value && typeof value === "object") {
        if (preferredKeys) {
            for (let i = 0; i < preferredKeys.length; i++) {
                const key = preferredKeys[i];

                if (
                    Object.prototype.hasOwnProperty.call(value, key) &&
                    typeof value[key] === "number" &&
                    Number.isFinite(value[key])
                ) {
                    return value[key];
                }
            }
        }

        for (const key in value) {
            if (typeof value[key] === "number" && Number.isFinite(value[key])) {
                return value[key];
            }
        }
    }

    return null;
}

function readPedPool() {
    try {
        const pool = Memory.ReadU32(PED_POOL_PTR_ADDR, false);

        if (!pool) {
            return null;
        }

        const objects = Memory.ReadU32(pool + 0x0, false);
        const byteMap = Memory.ReadU32(pool + 0x4, false);
        const size = Memory.ReadI32(pool + 0x8, false);

        if (
            !objects ||
            !byteMap ||
            size <= 0 ||
            size > MAX_REASONABLE_PED_POOL_SIZE
        ) {
            return null;
        }

        return {
            objects: objects,
            byteMap: byteMap,
            size: size
        };
    } catch (e) {
        if (!warnedPoolRead) {
            warnedPoolRead = true;
            log("[HomelessInsects] Ped-pool read failed for this scan: " + e);
        }

        return null;
    }
}

function getPedHandle(slot, poolByte) {
    return (slot << 8) + poolByte;
}

function getPedPointer(pool, slot) {
    return pool.objects + slot * CPED_SIZE;
}

function doesCharExist(ped) {
    try {
        return !!native("DOES_CHAR_EXIST", ped);
    } catch (e) {
        return false;
    }
}

function isOrdinaryGamePed(ptr) {
    try {
        return (
            Memory.ReadU8(
                ptr + CPED_CREATED_BY_OFFSET,
                false
            ) === PED_CREATED_BY_GAME
        );
    } catch (e) {
        return false;
    }
}

function getPedStatsIndex(ptr) {
    try {
        const statsPtr = Memory.ReadU32(
            ptr + CPED_STATS_PTR_OFFSET,
            false
        );

        if (!statsPtr) {
            return null;
        }

        const index = Memory.ReadI32(
            statsPtr + CPED_STATS_INDEX_OFFSET,
            false
        );

        // Vanilla SA uses a small enum here. This guard simply rejects clearly
        // invalid pointers/reads without assuming only vanilla stat entries exist.
        if (index < 0 || index > 255) {
            return null;
        }

        return index;
    } catch (e) {
        if (!warnedStatsRead) {
            warnedStatsRead = true;
            log("[HomelessInsects] Could not read CPedStats for a ped: " + e);
        }

        return null;
    }
}

function isHomelessStatsIndex(statsIndex) {
    return (
        statsIndex === STAT_TRAMP_MALE ||
        statsIndex === STAT_TRAMP_FEMALE
    );
}

function attachInsectsToPed(ped) {
    try {
        const fx = firstNumber(
            native(
                "CREATE_FX_SYSTEM_ON_CHAR",
                "INSECTS",
                ped,
                FX_OFFSET_X,
                FX_OFFSET_Y,
                FX_OFFSET_Z,
                true
            ),
            ["handle", "fx", "particle", "system", "value"]
        );

        if (fx === null || fx === 0) {
            if (!warnedFxCreate) {
                warnedFxCreate = true;
                log("[HomelessInsects] CREATE_FX_SYSTEM_ON_CHAR returned no FX handle.");
            }

            return false;
        }

        native("PLAY_FX_SYSTEM", fx);
        return true;
    } catch (e) {
        if (!warnedFxCreate) {
            warnedFxCreate = true;
            log("[HomelessInsects] Could not attach INSECTS FX: " + e);
        }

        return false;
    }
}

// -----------------------------------------------------------------------------
// Main scan
// -----------------------------------------------------------------------------

function scanHomelessPeds() {
    const pool = readPedPool();

    if (!pool) {
        return;
    }

    const currentlyPresentHomeless = new Set();

    for (let slot = 0; slot < pool.size; slot++) {
        let poolByte;

        try {
            poolByte = Memory.ReadU8(
                pool.byteMap + slot,
                false
            );
        } catch (e) {
            continue;
        }

        // High bit set = unused ped-pool slot.
        if ((poolByte & 0x80) !== 0) {
            continue;
        }

        const ped = getPedHandle(slot, poolByte);

        if (!ped || !doesCharExist(ped)) {
            continue;
        }

        const ptr = getPedPointer(pool, slot);
        const statsIndex = getPedStatsIndex(ptr);

        // Future-proof detection: model ID/name does not matter. The ped's
        // actual peds.ide / CPedStats classification decides whether it qualifies.
        if (statsIndex === null || !isHomelessStatsIndex(statsIndex)) {
            continue;
        }

        currentlyPresentHomeless.add(ped);

        // One roll only for this ped's lifetime.
        if (pedState.has(ped)) {
            continue;
        }

        // Do not decorate mission/script-created actors that merely use tramp
        // stats. This keeps the feature focused on ordinary world population.
        if (!isOrdinaryGamePed(ptr)) {
            pedState.set(ped, {
                statsIndex: statsIndex,
                rolled: true,
                hasInsects: false,
                ignoredScriptPed: true
            });
            continue;
        }

        const wonRoll = Math.random() < INSECT_CHANCE;
        let attached = false;

        if (wonRoll) {
            attached = attachInsectsToPed(ped);
        }

        pedState.set(ped, {
            statsIndex: statsIndex,
            rolled: true,
            hasInsects: wonRoll && attached,
            ignoredScriptPed: false
        });
    }

    // Forget despawned homeless peds so state cannot grow forever. A newly
    // spawned ped later gets its own independent one-time roll.
    for (const ped of pedState.keys()) {
        if (!currentlyPresentHomeless.has(ped)) {
            pedState.delete(ped);
        }
    }
}

log(
    "[HomelessInsects] v1.0 loaded - " +
    Math.round(INSECT_CHANCE * 100) +
    "% chance for ambient STAT_TRAMP_MALE/FEMALE peds; 2s discovery scan."
);

while (true) {
    wait(SCAN_INTERVAL_MS);
    scanHomelessPeds();
}
