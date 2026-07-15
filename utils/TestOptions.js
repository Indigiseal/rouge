// utils/TestOptions.js — debug / balance toggles persisted between sessions.

const STORAGE_KEY = 'testOptions';

export const TEST_OPTION_IDS = {
    disableAmulets: 'disableAmulets',
    disableMetaProgression: 'disableMetaProgression',
};

export const TEST_OPTION_DEFS = [
    {
        id: TEST_OPTION_IDS.disableAmulets,
        labelKey: 'ui.testOptions.disableAmulets',
        descriptionKey: 'ui.testOptions.disableAmuletsDesc',
    },
    {
        id: TEST_OPTION_IDS.disableMetaProgression,
        labelKey: 'ui.testOptions.disableMetaProgression',
        descriptionKey: 'ui.testOptions.disableMetaProgressionDesc',
    },
];

let cache = null;
let simOverride = null;

function defaultOptions() {
    return {
        [TEST_OPTION_IDS.disableAmulets]: false,
        [TEST_OPTION_IDS.disableMetaProgression]: false,
    };
}

export function loadTestOptions() {
    if (simOverride) return { ...defaultOptions(), ...simOverride };
    if (cache) return cache;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        cache = raw ? { ...defaultOptions(), ...JSON.parse(raw) } : defaultOptions();
    } catch {
        cache = defaultOptions();
    }
    return cache;
}

export function saveTestOptions(options) {
    cache = { ...defaultOptions(), ...options };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
}

export function invalidateTestOptionsCache() {
    cache = null;
}

/** Headless sim: force test options without touching browser localStorage. */
export function setSimTestOptionsOverride(options) {
    simOverride = options ? { ...defaultOptions(), ...options } : null;
    invalidateTestOptionsCache();
}

export function clearSimTestOptionsOverride() {
    setSimTestOptionsOverride(null);
}

export function isTestOptionEnabled(id) {
    return !!loadTestOptions()[id];
}

export function setTestOption(id, enabled) {
    const options = loadTestOptions();
    options[id] = !!enabled;
    saveTestOptions(options);
}

export function areAmuletsDisabled() {
    return isTestOptionEnabled(TEST_OPTION_IDS.disableAmulets);
}

export function isMetaProgressionDisabled() {
    return isTestOptionEnabled(TEST_OPTION_IDS.disableMetaProgression);
}

export function attachTestOptionsToGame(game) {
    if (!game) return;
    game.testOptions = {
        isEnabled: isTestOptionEnabled,
        setEnabled: setTestOption,
        areAmuletsDisabled,
        isMetaProgressionDisabled,
        reload: invalidateTestOptionsCache,
        defs: TEST_OPTION_DEFS,
    };
}
