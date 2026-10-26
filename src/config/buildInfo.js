// The build name the main menu shows, so a tester's bug report says which upload they played.
// Raise BUILD_VERSION by hand for each playtest. make_itch_zip.py replaces BUILD_STAMP with
// the day the zip was built; a copy run from the repo shows "dev".
export const BUILD_VERSION = 'pre-alpha 0.2';
export const BUILD_STAMP = 'dev';

export function buildLabel() {
    // Plain ASCII: the pixel font may not have a middle dot.
    return `${BUILD_VERSION} (${BUILD_STAMP})`;
}
