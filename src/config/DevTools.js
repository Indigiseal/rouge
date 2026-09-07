// Which controls exist only for the people making the game.
//
// A tester build must not show them: they either break the run's honesty (WIN
// clears a floor, the map jump skips to any room) or they are instrumentation
// nobody outside the team can use (the human-play recorder and its JSON
// export). None of them is a secret — they are simply not part of the game.
//
// DEV_TOOLS_DEFAULT is the one line to change when a build leaves the team.
// It is true while the game is ours to poke at, and flipping it to false takes
// the WIN button, the map jump, the two test screens and the run recorder out
// of every screen at once.
//
// Either way an explicit signal wins, so a public build can be checked without
// editing anything:
//
//   ?dev=0 in the URL                     — see exactly what a player sees
//   ?dev=1 in the URL                     — one session with the tools
//   localStorage 'rogueDevTools' = '1'/'0' — this browser, until cleared
//
// Anything that hides a control must ALSO refuse the action behind it. A hidden
// button is not a disabled one: the console can still call the method.

const DEV_TOOLS_DEFAULT = true;

function readFlag() {
    try {
        const params = new URLSearchParams(globalThis.location?.search || '');
        const param = params.get('dev');
        if (param === '1' || param === 'true') return true;
        if (param === '0' || param === 'false') return false;
    } catch (_) { /* no URL in this context — fall through */ }
    try {
        const stored = globalThis.localStorage?.getItem('rogueDevTools');
        if (stored === '1') return true;
        if (stored === '0') return false;
    } catch (_) { /* private windows and sandboxed frames throw — fall through */ }
    return DEV_TOOLS_DEFAULT;
}

// Read once at boot. A flag that changes mid-run would leave half a screen
// wearing controls the other half has already hidden.
let enabled = null;

/** True when developer-only controls should be built and allowed to act. */
export function devToolsEnabled() {
    if (enabled === null) enabled = readFlag();
    return enabled;
}

/** Test seam: force the flag without touching the URL or storage. */
export function setDevToolsEnabled(value) {
    enabled = Boolean(value);
}
