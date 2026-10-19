# Visual ideas from Studio Igor

Research notes, 18 Oct 2026. No game code was changed.

## Sources

- Channel: [Студия Игор / Studio Igor](https://www.youtube.com/@studioigor). It's in Russian, run by Igor, and covers AI tools in game dev. Most videos compare AI models. Only one is about 2D graphics in code.
- The main video: [2D Graphics in Code – Is It Real? Making 5 Games with Claude and GPT](https://www.youtube.com/watch?v=YQ01D9xGAnk) (7 Oct 2026). Useful parts:
  - [1:18](https://www.youtube.com/watch?v=YQ01D9xGAnk&t=78s): line boil and pixel art drawn by code
  - [6:52](https://www.youtube.com/watch?v=YQ01D9xGAnk&t=412s): what drawing everything in code costs
  - [7:48](https://www.youtube.com/watch?v=YQ01D9xGAnk&t=468s): switching to generated pieces
  - [18:50](https://www.youtube.com/watch?v=YQ01D9xGAnk&t=1130s): how the graphics are built
- The free skill from that video: [github.com/studioigor/ref2game](https://github.com/studioigor/ref2game). The techniques are written up in its reference files, which is where most of this report comes from:
  - [effects.md](https://github.com/studioigor/ref2game/blob/main/claude/references/effects.md): light, wind, particles, post
  - [styles.md](https://github.com/studioigor/ref2game/blob/main/claude/references/styles.md): rules per art style, including a pixel-art section
  - [gamefeel.md](https://github.com/studioigor/ref2game/blob/main/claude/references/gamefeel.md): juice, shake, springs, ambient life
  - [genres.md](https://github.com/studioigor/ref2game/blob/main/claude/references/genres.md): §8 covers card and board games
  - [art.md](https://github.com/studioigor/ref2game/blob/main/claude/references/art.md): what to draw and what to leave to code, plus readability
- Playable results: [studioigor.itch.io/ref2game-demo](https://studioigor.itch.io/ref2game-demo)
- Also looked at, but not useful for this game: [AI Created My Entire Game Character with ANIMATIONS](https://www.youtube.com/watch?v=-oszgKDLiwU) and its tool [3d-to-2d](https://github.com/studioigor/3d-to-2d). That pipeline goes image → 3D model (Meshy) → auto-rig → rendered sprite sheets. It doesn't fit hand-drawn pixel cards.

## The main finding

Igor first tried having Claude draw everything in code. Cartoons came out fine. For a game it was slow and weak: one platformer took 37 minutes of iterations, used 12% of a weekly $200 limit, and scored 2/10 from his own critic agents. He then switched to a different split:

- **Images are drawn or generated piece by piece.** That means each character part, each prop and each background layer separately, all from one written style description.
- **Code does everything that moves or glows**: light, fog, particles, text, water, wind, sway and animation. His rule is that glow, shadows, particles, text and water are never baked into a picture.

Taya already works this way: she draws the art, and the game adds light (`OverlayLightPipeline`), dissolves (`CardDissolve`), smoke (`SmokeBurst`) and shines (`GemShine`). So the useful part is the list of code-side tricks, plus the rules for keeping them pixel-correct.

## The pixel-art rules from styles.md

These rules decide which ideas below fit the game:

- **No free rotation and no fractional scaling of sprites.** Mixed pixel sizes look amateur. The game already renders at 640×360 ×2 with `pixelArt` and `roundPixels`, which is the right setup.
  - Two places break this today. EventScene hovers a card with `scale: 1.06` (EventScene.js, around line 2778), and the fire hit effect uses `setScale(0.6)` (BoardCardFx.js `playEnemyHitEffect`). Both give uneven pixels. Small, but it's the kind of thing this rule is about.
- **Particles are whole-pixel squares.**
- **Light uses drawn shapes with stepped falloff**, not smooth gradients.
- **Water and fire use colour cycling.**
- **No bloom, no colour grade, no dither** unless the art itself already has them. Exact-palette styles switch all post effects off.
- **Outlines are one texel wide.**

## Ideas, ranked

Payoff is how much better the game would look. Effort is roughly how much code it takes. Pixel fit is whether it can be done without breaking the pixel grid.

| # | Idea | Payoff | Effort | Pixel fit |
|---|---|---|---|---|
| 1 | Flicker on the existing light sheets | Medium | Tiny | Yes |
| 2 | Hit stack: flash, hit-stop, knockback, trauma shake | High | Low | Yes |
| 3 | Springs and overshoot on lifts, landings and counters | Medium | Low | Yes, if positions stay whole |
| 4 | Ambient life by the "anti-wallpaper" rules | High | Low–medium | Yes, with 1–2 px particles |
| 5 | Colour cycling for water, fire, crystals, portals | High | Medium | Yes, the classic pixel trick |
| 6 | One-texel outline shader for selected or target cards | Medium | Medium | Yes |
| 7 | Clean-up script for PixelLab output (grid snap, palette lock) | High for consistency | Medium | Yes |
| 8 | One wind field driving sway on map, village and menu props | Medium | Medium–high | Only with pixel-snapped sway |
| 9 | Rim light from alpha | Low–medium | Medium | Only if one texel wide |
| 10 | Readability checks: squint test and silhouette test | Medium | None, or a small script | Yes |

Not recommended: bloom and colour grading, 3D card tilt, line boil, soft-bone bending, part rigs and the 3D→2D pipeline. Reasons are at the end.

---

### 1. Flicker on the existing light sheets

**What it is.** Light sources that breathe a little. The flicker comes from a few sines with unrelated periods, so it never visibly repeats. effects.md says to use sines, never `Math.random`, because random flicker looks like a bug.

**In code.** `applyOverlayLight()` already returns the pipeline, and the pipeline already sends `intensity` to the shader every frame. So all it needs is this in the scene's `update`:

```js
// t in seconds; the periods are deliberately unrelated so nothing visibly loops
const t = time / 1000;
this._light.intensity = 1
    + 0.035 * Math.sin(t * 7.3)
    + 0.025 * Math.sin(t * 11.9 + 1.7)
    + 0.015 * Math.sin(t * 23.1 + 0.4);
```

Keep the swing small (±5–8%) so it reads as a flame, not a fault.

**Where.**
- MainMenuScene, VillageScene and LocationPickScene, which all use `applyOverlayLight`.
- GameScene during a fight. A slightly stronger flicker could mark the boss floor.
- If a scene's light should show a torch on one side, a second sheet with only that torch's pool could flicker on its own while the base sheet stays still.

### 2. Hit stack

**What it is.** From gamefeel.md, after the GDC talk "Juice it or lose it": every action gets several responses at different time scales.

- **Instant, within 1–3 frames:** a white flash of the hit card, plus a hit-stop. Hit-stop is a freeze of a few frames on the attacker and target only, longer for bigger hits.
- **Short, under a second:** a knockback of 2–3 whole pixels with a return, the hit animation and the damage number.
- **Long, seconds:** the enemy settles back, HP pips empty, the counter bumps.

**Shake, the "trauma" model.** Each event adds trauma between 0 and 1, and trauma decays linearly. The offset is `max × trauma² × noise(t)`, so shakes from several hits add up and then fade smoothly. Event weights are ordered: a crit shakes more than a normal hit, which shakes more than a trap.

Today the game calls `cameras.main.shake(...)` with fixed numbers in three places: BoardCombat crit, CardSystem and AnvilScene. A small shared `addTrauma(scene, amount)` helper could replace them. It would move the camera by whole pixels in `update`, using smooth noise or a couple of fast sines.

**In code.**
- Flash: `sprite.setTintFill(0xffffff)` for 1–2 frames, then `clearTint()`. This is pixel-safe. StatusOverlay and AnvilScene already use `setTintFill`.
- Hit-stop: pause the sequencer's next step, and the card tweens on the two cards, for about 40–100 ms scaled by damage. Leave everything else running.
- Knockback: a tween on `x` by ±2–3 world px away from the attacker, `ease: 'Back.easeOut'`, rounded.

**Where.** Board combat (BoardCombat / CombatSequencer), the player taking trap damage, and boss hits. Kills already get the dissolve; a flash and a short hit-stop right before it would make kills land harder.

### 3. Springs and overshoot

**What it is.** Things arrive past their target and settle back, instead of stopping dead. gamefeel.md gives a spring as a frequency `f` (how fast it answers) and a damping `ζ` (1 means no bounce, lower bounces):

```js
// k = (2πf)², c = 2ζ·2πf
v += (k * (target - x) - c * v) * dt;  x += v * dt;
// draw at Math.round(x) so the pixels stay on the grid
```

For most UI, Phaser's built-in `ease: 'Back.easeOut'` is close enough and needs no new code.

**Where.**
- Board card hover. FloorSpawner lifts by 5 px in 150 ms with the default ease. `Back.easeOut` with a 6 px overshoot settling at 5 would feel more physical.
- A card landing on the board after a reveal or a merge: a 1–2 px drop past its spot, then back.
- Gold and crystal counters: a bump when a `CurrencyFlight` coin arrives. That's the "counter bumps when it arrives" step from the collect row in effects.md.
- Map node selection brackets.

genres.md lists four things that make a card game feel alive:
1. A physical board that reacts to clicks.
2. Hovered cards rise and tilt.
3. Cards sway idly in the hand and snap into place with an overshoot.
4. Layered scoring: shake, particles, counting numbers and rising pitch.

For pixel art, skip the tilt (see the end). Rising pitch is cheap and fits combos. One example is raising `ui_card_hover` or the coin sound a semitone for each kill in the same turn.

### 4. Ambient life by the anti-wallpaper rules

**What it is.** Small background motion that doesn't read as a looping GIF. The rules are from gamefeel.md §5 and effects.md §7:

1. Use periods that don't divide into each other (primes, the golden ratio), and never reuse a period.
2. Give each instance its own amplitude and phase.
3. Time events in jittered windows with skips, never on a fixed timer.
4. Every ambient system reacts to the player somehow, by fleeing, lighting up or bending. Otherwise it reads as wallpaper.
5. Add rare events, spaced far beyond anything a viewer would read as a cycle.
6. Keep quiet for a moment after the player's own big events.

**In code.** Phaser `add.particles` with a 1×1 or 2×2 white texture and tinted particles. Round positions, and give each particle its own slow wobble. Rare events are a `delayedCall` with a random delay inside a window, sometimes skipped.

**Where.**
- **Event screens:** dust motes drifting through the light, and embers over a camp fire (abandoned_camp, soup_stand).
- **Map:** occasionally a bird or bat crossing far behind the paths, and fireflies near the current node that drift away from the cursor.
- **Crystal Lair:** a glint now and then on a crystal, at irregular times.
- **Village:** smoke from a chimney, bending with the wind from idea 8.

The current-node ring on the map pulses on a fixed 1100 ms yoyo. That's fine for a UI marker. Background motion is what should avoid fixed loops.

### 5. Colour cycling

**What it is.** The 90s pixel-art trick for water, fire, lava, magic and crystals. Some pixels are painted in a small set of reserved colours, and those colours rotate over time. The art itself never moves, but it looks alive. In the video, the pixel-art whale cartoon's sea "runs by palette cycling" ([3:13](https://www.youtube.com/watch?v=YQ01D9xGAnk&t=193s)), and styles.md lists it as the way to do water and fire in pixel art.

**In code.** A small Phaser `PostFXPipeline`, or a per-sprite pipeline, built like OverlayLightPipeline:
- The shader gets a list of N reserved colours (a uniform array or a 1×N texture) and a `uTime`.
- For each pixel that exactly matches reserved colour *i*, it outputs reserved colour *(i + step) mod N*. All other pixels pass through unchanged.

Taya then paints the moving areas with those N colours, in bands or ripples. Order matters: neighbouring bands should use neighbouring indices, so the cycle reads as flow. Step at 6–10 fps and hold, not smooth.

**Where.**
- Water and fire in event and village art.
- The glow inside crystals: crystal spiders, crystal shards, Crystal Lair.
- Portals and exits (ExitDoor), magic gems, the boss reward room.

It's one shader for all of these. After that, every new animated surface is just painting.

### 6. One-texel outline shader

**What it is.** A clean outline around a sprite's opaque pixels, exactly one art pixel wide, in a chosen colour. In ref2game it's called `L.inked`: offset copies of the silhouette drawn behind the sprite. The pixel version samples the four neighbours at one texel and colours a transparent pixel if any neighbour is opaque.

Phaser's built-in `preFX.addGlow` is soft and blurry, so it doesn't fit pixel art.

**In code.** A small `PreFXPipeline`, roughly:

```glsl
if (c.a < 0.5 && (a(+1,0) > 0.5 || a(-1,0) > 0.5 || a(0,+1) > 0.5 || a(0,-1) > 0.5)) c = vec4(uColor, 1.0);
```

Two cautions:
- The sprite needs one pixel of transparent padding on its frame, or the outline gets clipped.
- On a spritesheet, sample inside the frame's UV bounds only.

**Where.**
- Valid drop targets while dragging a gem or item.
- Enemies a spell can target.
- The card under the cursor on event choice screens, which could then drop the 1.06 scale.
- Elite or boss cards, in a colour of their own.

### 7. Clean-up script for PixelLab output

**What it is.** ref2game's post-processing chain for generated pixel art. It's what keeps generated pieces from looking different from hand-drawn ones (styles.md §1):

1. Detect the real pixel grid (run lengths or FFT). Take the dominant colour of each cell, not the average, because averaging invents in-between colours.
2. Snap every colour to a locked palette, measured in OKLab. Use the game's own palette.
3. Make alpha fully on or fully off.
4. Remove orphan pixels and doubled-line jaggies, and enforce one outline width.
5. Use one palette for everything.

They also write a **style bible**: a short fixed text with the palette, outline type and colour, light direction, the shading ramps and their hue shift, and the exclusions (no gradients, no soft light, no "HD"). It goes verbatim into every prompt, along with the reference image. Avoid "glow", "volumetric", "4K", "realistic" and "gradient" in pixel prompts, because those pull the model toward fake pixels.

**In code.** A Python script (Pillow + NumPy) run on PixelLab output before it goes into `assets/art/`. ref2game's `gen.py pixel IN OUT --grid auto --colors 16` does this and could be read for reference (MIT licence).

**Where.** Any PixelLab asset, such as the new crystal spider art and enemy icons, so it sits next to Taya's own drawings without a mismatch in palette or pixel size.

### 8. One wind field

**What it is.** One function `windAt(t, x)` that everything samples. It has a slow base of a few waves moving across the screen, plus gusts that travel across with a sharp front and a long tail, arriving at irregular times.

When a gust passes, things react one after another in the gust's direction: grass leans, then the banner, then the hanging sign swings, then a leaf comes loose. effects.md says this shared cause is what turns separate loops into one world. Their rule: if the grass leans, the sign has to swing too.

**In code, pixel-safe.**
- Separate layers are needed for anything that sways: banners, lamps, grass tufts and signs.
- Sway goes in a small shader that shifts each row of the sprite sideways by `amp × weight(y) × wind`. The weight is 0 at the root and grows toward the free end. **The shift is rounded to whole texels** (`floor(offset * texW + 0.5) / texW`), so the rows step instead of smearing.
- Pendulum props (hanging lamps, signs) can swap between 3–5 hand-drawn lean frames picked by the wind value, instead of rotating.

**Where.** VillageScene, the main menu background, the map (trees and banners at nodes), and event backgrounds with cloth or plants.

Effort is mostly in the art: splitting backgrounds into layers. Worth it for the main menu and village, which players see often. Less so elsewhere.

### 9. Rim light from alpha

**What it is.** A thin lit edge on the side facing the light, worked out from the sprite's own alpha. Sample the alpha one step toward the light; if it's transparent there, this pixel is on the lit edge, so add the rim colour. ref2game uses it to make separately generated pieces share one light.

**For this game.** Only at exactly one texel, in a colour from the palette. It could show a boss card being lit from the side during `playBossEntrance`, or tie enemy art to a scene's light direction. It doesn't do much on its own; it's more of a finish for idea 6, using the same shader structure.

### 10. Readability checks

From art.md §5. No game code needed.

- **Squint test.** Take a screenshot, convert to grey, blur it and posterise to 4–5 values. Cards, enemies and the text on choices should still separate from the background. This is a quick way to check new event backgrounds and the board background. It's a five-line Pillow script.
- **Silhouette test.** Fill each enemy's sprite with black and shrink it. It should still be recognisable at board size.
- **Three planes.** The play plane (cards, choices) gets the strongest contrast and the outlines. Backgrounds are compressed in value and saturation. Event backgrounds that are as contrasty as the choice cards compete with them.
- **Colour roles.** Keep one hue family for danger (enemies, traps), one for "you can use this", and one for secrets. Backgrounds never use those hues at full strength. This fits HiddenPaths and secret rooms.

---

## Not recommended for this game

- **Bloom, warm/cool grade, vignette, dither over the whole frame.** styles.md switches all of these off for exact-palette pixel art. The game's own Overlay/Lighten light sheets already do the "light in the room" job, and keep it under Taya's control.
- **3D card tilt toward the cursor** (Balatro style). It rotates and skews the art, which breaks the pixel grid. A vertical lift with overshoot (idea 3) gets most of the feel.
- **Line boil.** This is the shaky hand-drawn outline from the video: the drawing re-sampled with small noise at about 12 fps. It suits ink or sketch art. In pixel art the same effect is two or three hand-drawn variants alternated, which is ordinary frame animation.
- **Soft bones and weight maps.** A shader bends one painted sprite using an RGB weight map, which is how the video's horse turns its neck. It deforms the pixels smoothly, which breaks the grid. A bulge shader for breathing has the same problem.
- **Part rigs with IK legs.** This was the biggest part of the video ([19:27](https://www.youtube.com/watch?v=YQ01D9xGAnk&t=1167s)). It doesn't apply: there are no walking characters on cards. styles.md says pixel rigs only work if every frame is re-rasterised at native size, as Dead Cells does.
- **3D model → sprite sheet** ([3d-to-2d](https://github.com/studioigor/3d-to-2d)). Wrong look for hand-drawn cards.

## Suggested order

1. Flicker (1) and the hit stack (2): small changes with visible results, mostly in code that already exists.
2. Overshoot on hover and landing (3), and counter bumps. Also fix the two non-integer scales mentioned in the pixel-art rules.
3. Colour-cycling shader (5). One shader, then it's a painting job. Crystal Lair is the obvious first use.
4. Ambient particles on event screens and the map (4).
5. PixelLab clean-up script (7), before generating more art.
6. Outline shader (6), then wind (8) for the main menu and village if the layered art is worth drawing.
