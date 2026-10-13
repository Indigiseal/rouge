// ui/OverlayLightPipeline.js
// A full-screen light sheet laid over the finished frame in Aseprite's Overlay
// blend mode.
//
// Why a shader and not a blend mode: Phaser DOES have BlendModes.OVERLAY, but
// it only does anything in the Canvas renderer. This game runs on Phaser.AUTO,
// which picks WebGL on every machine that can manage it, and WebGL's
// fixed-function blending cannot express Overlay at all — the formula branches
// on the backdrop, and fixed-function blending never gets to look at it.
//
// A post-processing pipeline does get to look at it: it runs after the camera
// has drawn everything (board, cards, HUD, overlays) and hands the whole frame
// to the fragment shader as a texture. So this sits over the UI and every other
// layer by construction, without having to out-depth anything.
//
// The formula is Aseprite's, which is the Photoshop one:
//
//     overlay(b, s) = 2*b*s              when b < 0.5
//                     1 - 2*(1-b)*(1-s)  otherwise
//
// then mixed back by the light's own alpha, which is what Aseprite's layer
// opacity does. Dark parts of the frame get darker, light parts get lighter,
// and mid-grey is left almost alone — the reason Overlay reads as "light in
// the room" rather than as a wash of colour over the top.
//
// The same shader also does Aseprite's Lighten, for a sheet painted in that
// mode: per channel, whichever is brighter of the frame and the sheet,
// mixed back by the sheet's alpha the same way.
//
//     lighten(b, s) = max(b, s)

// Per-channel blend for each mode, in GLSL. Each takes the frame (b) and the
// sheet's painted colour (s).
const BLEND_GLSL = {
    overlay: 'b < 0.5 ? (2.0 * b * s) : (1.0 - 2.0 * (1.0 - b) * (1.0 - s))',
    lighten: 'max(b, s)',
};

const fragFor = (mode) => `
#define SHADER_NAME ${mode.toUpperCase()}_LIGHT_FS

precision mediump float;

uniform sampler2D uMainSampler;   // the frame the camera just drew
uniform sampler2D uLightSampler;  // the light sheet
uniform float uIntensity;         // 0 = off, 1 = the sheet at its authored alpha
uniform vec2 uLightOffset;        // where the sheet sits, as a fraction of its size; +y is down

varying vec2 outTexCoord;

// Per-channel blend, by the sheet's mode.
float blendChannel(float b, float s) {
    return ${BLEND_GLSL[mode]};
}

void main() {
    vec4 base = texture2D(uMainSampler, outTexCoord);

    // Flip Y for the light sheet, and ONLY for the light sheet.
    //
    // uMainSampler is a framebuffer, whose origin is bottom-left; the sheet is
    // an uploaded image, whose origin is top-left. Phaser's post-process vertex
    // shader lines outTexCoord up with the framebuffer, so the frame comes out
    // the right way round and anything else sampled with the same coordinate
    // comes out upside down. That is why the light read as flipped in game
    // while looking correct in Aseprite.
    vec2 lightUv = vec2(outTexCoord.x, 1.0 - outTexCoord.y) - uLightOffset;
    vec4 light = texture2D(uLightSampler, lightUv);
    // A moved sheet leaves a strip it no longer covers. Clamped sampling would
    // smear its edge row across that strip, so the strip gets no light.
    if (lightUv.x < 0.0 || lightUv.x > 1.0 || lightUv.y < 0.0 || lightUv.y > 1.0) {
        light = vec4(0.0);
    }

    // Phaser uploads textures with UNPACK_PREMULTIPLY_ALPHA_WEBGL enabled, so
    // the sampled rgb is already multiplied by alpha. Overlay needs the colour
    // the artist actually painted, so undo that before using it. Guard the
    // divide: the sheet is mostly fully transparent and 0/0 is a NaN that
    // shows up as a black hole rather than as nothing.
    vec3 src = light.a > 0.0001 ? light.rgb / light.a : vec3(0.0);

    vec3 blended = vec3(
        blendChannel(base.r, src.r),
        blendChannel(base.g, src.g),
        blendChannel(base.b, src.b)
    );

    // Aseprite applies the layer's alpha (and opacity) as the mix amount.
    float amount = clamp(light.a * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(mix(base.rgb, blended, amount), base.a);
}
`;

export const OVERLAY_LIGHT_KEY = 'overLight';
export const OVERLAY_LIGHT_PIPELINE = 'OverlayLight';
// One pipeline per blend mode, so a screen can hang an Overlay sheet and a
// Lighten sheet over the same camera at once.
const PIPELINE_BY_MODE = {
    overlay: OVERLAY_LIGHT_PIPELINE,
    lighten: 'LightenLight',
};

/**
 * Builds the pipeline class against the Phaser on `window`. It has to be a
 * factory rather than a top-level `class X extends Phaser...` because Phaser is
 * a UMD script tag, not a module — at import time it may not be on window yet.
 */
function definePipeline(Phaser, mode) {
    const Base = Phaser?.Renderer?.WebGL?.Pipelines?.PostFXPipeline;
    if (!Base) return null;

    return class OverlayLightPipeline extends Base {
        constructor(game) {
            super({ game, name: PIPELINE_BY_MODE[mode], fragShader: fragFor(mode) });
            // Scene-settable, so a scene can dim the sheet or turn it off
            // without tearing the pipeline down.
            this.intensity = 1;
            // Which light sheet to lay over the frame. Each camera gets its own
            // instance, so a screen can bring its own sheet (the road screen
            // has one) while the rest keep the shared one.
            this.lightKey = OVERLAY_LIGHT_KEY;
            // How far the sheet is moved from where it was painted, in screen
            // pixels; +y is down.
            this.offsetX = 0;
            this.offsetY = 0;
        }

        setOffsetUniform(source) {
            const w = source?.width || 640;
            const h = source?.height || 360;
            this.set2f('uLightOffset', (this.offsetX || 0) / w, (this.offsetY || 0) / h);
        }

        onPreRender() {
            this.set1f('uIntensity', this.intensity);
        }

        onDraw(renderTarget) {
            const source = this.game.textures.get(this.lightKey || OVERLAY_LIGHT_KEY)?.source?.[0];
            const glTexture = source?.glTexture;

            // No sheet loaded: pass the frame through untouched rather than
            // sampling a missing texture, which renders the game black.
            if (!glTexture) {
                this.bindAndDraw(renderTarget);
                return;
            }

            this.bindTexture(glTexture, 1);
            this.set1i('uMainSampler', 0);
            this.set1i('uLightSampler', 1);
            // Also set here, not only in onPreRender: this is the point where
            // the shader is certainly the bound one, so a scene that changes
            // intensity mid-frame cannot land it on the wrong program.
            this.set1f('uIntensity', this.intensity);
            this.setOffsetUniform(source);
            this.bindAndDraw(renderTarget);
        }
    };
}

/**
 * Registers the pipeline once per game. Safe to call from every scene.
 * Returns false when the renderer cannot take it (Canvas, or an older Phaser),
 * so callers can fall back.
 */
export function ensureOverlayLightPipeline(scene, mode = 'overlay') {
    const name = PIPELINE_BY_MODE[mode];
    if (!name) return false;
    const game = scene?.game;
    const renderer = game?.renderer;
    const pipelines = renderer?.pipelines;
    // Canvas renderer has no pipelines at all. Nothing to register, and
    // nothing broken — the caller just does without.
    if (!pipelines?.addPostPipeline) return false;

    if (pipelines.getPostPipeline?.(name)) return true;
    if (pipelines.postPipelineClasses?.has?.(name)) return true;

    const Pipeline = definePipeline(globalThis.Phaser, mode);
    if (!Pipeline) return false;

    try {
        pipelines.addPostPipeline(name, Pipeline);
        return true;
    } catch (error) {
        console.warn('Overlay light pipeline:', error);
        return false;
    }
}

/**
 * Hangs the light sheet over `scene`'s main camera. `opts.key` picks a
 * screen's own sheet (any 640x360 image); it defaults to the shared one.
 * `opts.offsetX` / `opts.offsetY` move the sheet by that many pixels (+y down),
 * for when what it lights has moved since it was painted. `opts.mode` is the
 * blend the sheet was painted in, 'overlay' (default) or 'lighten'; a screen
 * can have one of each.
 *
 * Returns the pipeline instance, or null when it could not be applied — the
 * scene simply renders as it always did. Never throws: a light effect is not
 * worth taking a scene down for.
 */
export function applyOverlayLight(scene, opts = {}) {
    const { intensity = 1, key = OVERLAY_LIGHT_KEY, offsetX = 0, offsetY = 0, mode = 'overlay' } = opts;
    const name = PIPELINE_BY_MODE[mode];
    if (!name) return null;
    const camera = scene?.cameras?.main;
    if (!camera?.setPostPipeline) return null;
    if (!scene.textures?.exists?.(key)) return null;
    if (!ensureOverlayLightPipeline(scene, mode)) return null;

    try {
        camera.setPostPipeline(name);
        const instance = camera.getPostPipeline?.(name);
        const pipeline = Array.isArray(instance) ? instance[0] : instance;
        if (pipeline) {
            pipeline.intensity = intensity;
            pipeline.lightKey = key;
            pipeline.offsetX = offsetX;
            pipeline.offsetY = offsetY;
        }
        return pipeline || null;
    } catch (error) {
        console.warn('Overlay light:', error);
        return null;
    }
}

/** Takes the sheets back off, for a scene that wants them only some of the time. */
export function removeOverlayLight(scene) {
    const camera = scene?.cameras?.main;
    Object.values(PIPELINE_BY_MODE).forEach((name) => {
        try { camera?.removePostPipeline?.(name); }
        catch (_) { /* never loaded */ }
    });
}
