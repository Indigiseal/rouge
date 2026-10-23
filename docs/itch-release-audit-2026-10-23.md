# itch.io playtest release audit — 2026-10-23

Scope: local code/package inspection, all registered checks, desktop browser startup with real audio, viewport resizing, and a simulated failed save. No upload or publication was performed. A full three-act player-driven playthrough and an actual hosted itch.io iframe remain to be tested.

## Fix before uploading

| Priority | Finding | Evidence | Recommended change |
|---|---|---|---|
| High | Release ZIP exceeds itch.io's default file limit | `make_itch_zip.py.iter_files()` currently includes 1,171 files, 21.2 MiB extracted. Default limit: 1,000 files. | Exclude review-only candidate/prototype folders, prompt JSON, previews and nested art ZIPs. 266 candidate/prototype files are currently included; excluding them would leave 905 files. Keep source art on disk. Validate runtime references against the archive and assert upload limits during packaging. |
| High | Fresh players get Developer mode | `src/config/DevTools.js` defaults to true; confirmed in a clean browser without URL/storage overrides. | Make the release packer emit a Player-mode build while leaving the working checkout's team settings available. Confirm no WIN, test sites, free starting debug items or progression controls appear. |
| High | Smaller embeds cut off controls | Canvas stays 1280x720. At 960x600 its bounds are (-160,-60,1280,720); at 800x450 they are (-240,-135,1280,720). | Fit the canvas to the available viewport while preserving the 640x360 world and input mapping. Verify fullscreen, resize, pointer-to-card alignment, inventory dragging and tooltips. |
| High | Save & Quit silently leaves after a failed save | Fault injection made `safeSet()` fail; Pause still returned to Main Menu with no feedback. | Propagate a success/failure result and keep the pause menu open with Retry/Cancel when saving fails. Checkpoint failures should also be visible without interrupting an enemy exchange. |

## Finish the validation

- Run the actual ZIP under a case-sensitive static host/subdirectory, then preview it in an unpublished itch.io project. Local literal asset-path inspection found no missing or case-mismatched references; that does not cover every generated path.
- Complete one fresh-profile tutorial and one full three-act run in Player mode. Check first-run comprehension: attack, pip wear, merging, armor, food/AP, sigil stamping and leaving cleared rooms.
- Exercise Save & Quit / Continue in ordinary fights, boss fights, rewards, shops and events. Existing automated save/resume checks pass; hosted browser persistence still needs verification.
- Check audio starts after the first user interaction, volume settings survive reload, and hidden tabs / pauses do not accumulate turns or sounds. Local real-audio startup succeeded.
- Reconcile the extra background-art check: `tools/test-fight-backgrounds.mjs` expects 512x288 for Silkdeep, but its current image is 546x314. Its earlier background-flow checks pass. Decide the intended art dimensions/placement and update the assertion accordingly.

## Optional presentation polish

- Give the playtest a visible build identifier and short known-issues/controls text on the itch page. The menu currently shows a fixed `v1.0.0`, which will not identify different uploaded test builds.
- Include a simple feedback destination and ask testers for the build number, location and a screenshot when reporting a bug.
- Review descriptions in a fresh discovery profile, including long localized item names and Codex entries.
- The new sanctuary/statues can be staged as a separate visual update; changing the progression presentation is not required to test combat and saves.
- Package a representative cover image, a short gameplay GIF and several screenshots showing combat, a boss and sigil stamping.

## Results

- Registered checks: **39/39 passed**.
- Separate background-art check: **fails one image-dimension assertion** (Silkdeep 546x314 vs expected 512x288).
- Fresh local browser boot: approximately 1.1 seconds on this machine, with real audio enabled; not a prediction of internet loading time.
- Browser errors / failed requests / HTTP errors during startup and combat: **none observed**.
- Viewports: 1280x720 and 1366x768 fit; 960x600 and 800x450 clip.
- Default developer mode: enabled, confirmed in a fresh browser.
- Simulated save failure: returned to menu without warning, confirmed.
- Findings and raw logs: `output/release-audit/package.json`, `tests.json`, `browser.json`, and screenshots.

Official hosting requirements: https://itch.io/docs/creators/html5
