export function normalizeVolumeSettings(value = {}) {
    const clamp01 = (next, fallback) => {
        const number = Number(next);
        return Number.isFinite(number)
            ? Math.max(0, Math.min(1, number))
            : fallback;
    };

    return {
        master: 1,
        sfx: clamp01(value.sfx, 1),
        music: clamp01(value.music, 0.5)
    };
}

export function loadVolumeSettings() {
    try {
        return normalizeVolumeSettings(JSON.parse(localStorage.getItem('gameVolume') || '{}'));
    } catch (_) {
        return normalizeVolumeSettings();
    }
}

export function saveVolumeSettings(settings) {
    localStorage.setItem('gameVolume', JSON.stringify(normalizeVolumeSettings(settings)));
}
