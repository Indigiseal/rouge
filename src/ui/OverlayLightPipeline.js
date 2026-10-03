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

const FRAG = `
#define SHADER_NAME OVERLAY_LIGHT_FS

precision mediump float;

uniform sampler2D uMainSampler;   // the frame the camera just drew
uniform sampler2D uLightSampler;  // the light sheet
uniform float uIntensity;         // 0 = off, 1 = the sheet at its authored alpha

varying vec2 outTexCoord;

// Per-channel Overlay.
float overlayChannel(float b, float s) {
    return b < 0.5 ? (2.0 * b * s) : (1.0 - 2.0 * (1.0 - b) * (1.0 - s));
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
    vec2 lightUv = vec2(outTexCoord.x, 1.0 - outTexCoord.y);
    vec4 light = texture2D(uLightSampler, lightUv);

    // Phaser uploads textures with UNPACK_PREMULTIPLY_ALPHA_WEBGL enabled, so
    // the sampled rgb is already multiplied by alpha. Overlay needs the colour
    // the artist actually painted, so undo that before using it. Guard the
    // divide: the sheet is mostly fully transparent and 0/0 is a NaN that
    // shows up as a black hole rather than as nothing.
    vec3 src = light.a > 0.0001 ? light.rgb / light.a : vec3(0.0);

    vec3 blended = vec3(
        overlayChannel(base.r, src.r),
        overlayChannel(base.g, src.g),
        overlayChannel(base.b, src.b)
    );

    // Aseprite applies the layer's alpha (and opacity) as the mix amount.
    float amount = clamp(light.a * uIntensity, 0.0, 1.0);
    gl_FragColor = vec4(mix(base.rgb, blended, amount), base.a);
}
`;

export const OVERLAY_LIGHT_KEY = 'overLight';
export const OVERLAY_LIGHT_PIPELINE = 'OverlayLight';

/**
 * Builds the pipeline class against the Phaser on `window`. It has to be a
 * factory rather than a top-level `class X extends Phaser...` because Phaser is
 * a UMD script tag, not a module — at import time it may not be on window yet.
 */
function definePipeline(Phaser) {
    const Base = Phaser?.Renderer?.WebGL?.Pipelines?.PostFXPipeline;
    if (!Base) return null;

    return class OverlayLightPipeline extends Base {
        constructor(game) {
            super({ game, name: OVERLAY_LIGHT_PIPELINE, fragShader: FRAG });
            // Scene-settable, so a scene can dim the sheet or turn it off
            // without tearing the pipeline down.
            this.intensity = 1;
        }

        onPreRender() {
            this.set1f('uIntensity', this.intensity);
        }

        onDraw(renderTarget) {
            const source = this.game.textures.get(OVERLAY_LIGHT_KEY)?.source?.[0];
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
            this.bindAndDraw(renderTarget);
        }
    };
}

/**
 * Registers the pipeline once per game. Safe to call from every scene.
 * Returns false when the renderer cannot take it (Canvas, or an older Phaser),
 * so callers can fall back.
 */
export function ensureOverlayLightPipeline(scene) {
    const game = scene?.game;
    const renderer = game?.renderer;
    const pipelines = renderer?.pipelines;
    // Canvas renderer has no pipelines at all. Nothing to register, and
    // nothing broken — the caller just does without.
    if (!pipelines?.addPostPipeline) return false;

    if (pipelines.getPostPipeline?.(OVERLAY_LIGHT_PIPELINE)) return true;
    if (pipelines.postPipelineClasses?.has?.(OVERLAY_LIGHT_PIPELINE)) return true;

    const Pipeline = definePipeline(globalThis.Phaser);
    if (!Pipeline) return false;

    try {
        pipelines.addPostPipeline(OVERLAY_LIGHT_PIPELINE, Pipeline);
        return true;
    } catch (error) {
        console.warn('Overlay light pipeline:', error);
        return false;
    }
}

/**
 * Hangs the light sheet over `scene`'s main camera.
 *
 * Returns the pipeline instance, or null when it could not be applied — the
 * scene simply renders as it always did. Never throws: a light effect is not
 * worth taking a scene down for.
 */
export function applyOverlayLight(scene, opts = {}) {
    const { intensity = 1 } = opts;
    const camera = scene?.cameras?.main;
    if (!camera?.setPostPipeline) return null;
    if (!scene.textures?.exists?.(OVERLAY_LIGHT_KEY)) return null;
    if (!ensureOverlayLightPipeline(scene)) return null;

    try {
        camera.setPostPipeline(OVERLAY_LIGHT_PIPELINE);
        const instance = camera.getPostPipeline?.(OVERLAY_LIGHT_PIPELINE);
        const pipeline = Array.isArray(instance) ? instance[0] : instance;
        if (pipeline) pipeline.intensity = intensity;
        return pipeline || null;
    } catch (error) {
        console.warn('Overlay light:', error);
        return null;
    }
}

/** Takes the sheet back off, for a scene that wants it only some of the time. */
export function removeOverlayLight(scene) {
    const camera = scene?.cameras?.main;
    try { camera?.removePostPipeline?.(OVERLAY_LIGHT_PIPELINE); }
    catch (_) { /* never loaded */ }
}
