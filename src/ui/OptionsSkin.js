// Shared paper, buttons and volume controls for Options and Pause.
import { MusicManager } from '../audio/MusicManager.js';
import { SoundHelper } from '../audio/SoundHelper.js';
import { FONT_SIZE, fitLabel, serifStyle } from './uiFont.js';
// uiButtons.png stacks one 128x32 button per row.
export const UI_BUTTON = { language: 0, barEmpty: 1, barFill: 2, back: 3, reset: 4 };
export const UI_BUTTON_W = 128;
// The reset plate carries a warning badge on its left ~27px, so a label on it
// sits centred in what's left of the plate rather than on the plate's centre.
export const RESET_LABEL_OFFSET_X = 14;
// The bars' pointed end caps eat the first and last few pixels, so the stretch
// that actually reads as "filled" runs from x=5 to x=122 inside the 128px frame.
const BAR_TRACK_X = 5;
const BAR_TRACK_W = 117;
// Vertical nudge for the draggable diamond, relative to the bar's centre.
const KNOB_OFFSET_Y = -1;
// Panel size Taya specced. Exported because the screens lay their controls out
// against its edges, and they must measure the panel they are actually given.
export const OPTIONS_PANEL_W = 376;
export const OPTIONS_PANEL_H = 292;

// The screen's palette. Exported because both screens wearing this skin write
// headings and rules of their own, and a second copy of these numbers is how
// the two drift apart.
export const OPTIONS_INK = '#050505';        // headings and control labels
export const OPTIONS_RESET_INK = '#ffc2a2';  // label on the red plate
export const OPTIONS_BACKDROP = 0x4a433c;    // flat ground behind the paper
const OPTIONS_RULE = 0x8e7352;               // hairline between control groups
const OPTIONS_RULE_W = 156;

const SERIF_BODY_PX = FONT_SIZE.body;
export const OptionsSkin = {
    createOptionsPanel(x, y) {
        if (this.textures.exists('eventPaper9Slice')) {
            const addNineSlice = this.add.nineslice || this.add.nineSlice;
            if (addNineSlice) {
                try {
                    return addNineSlice.call(this.add, x, y, 'eventPaper9Slice', null,
                        OPTIONS_PANEL_W, OPTIONS_PANEL_H, 32, 32, 32, 32);
                } catch {
                    // fall through to the flat plate
                }
            }
        }
        return this.add.rectangle(x, y, OPTIONS_PANEL_W, OPTIONS_PANEL_H, 0xd8b98c)
            .setStrokeStyle(2, 0x5a3a24);
    },
    // Hairline rule separating one group of controls from the next.
    createDivider(x, y, width = OPTIONS_RULE_W) {
        return this.add.rectangle(x, y, width, 1, OPTIONS_RULE, 0.48);
    },
    createUiButton(x, y, frame, label, { color = '#ffffff', labelOffsetX = 0, labelOffsetY = 0,
        labelSize = SERIF_BODY_PX, labelWidth = UI_BUTTON_W - 12, callback } = {}) {
        const hasSprite = this.textures.exists('uiButtons');
        const labelY = y + labelOffsetY;

        const shadow = hasSprite
            ? this.add.image(x, y + 4, 'uiButtons', frame).setOrigin(0.5).setTint(0x000000).setAlpha(0.5)
            : this.add.rectangle(x, y + 4, UI_BUTTON_W, 26, 0x000000, 0.5).setOrigin(0.5);

        const btn = hasSprite
            ? this.add.image(x, y, 'uiButtons', frame).setOrigin(0.5)
            : this.add.rectangle(x, y, UI_BUTTON_W, 26, 0x8a5a32).setStrokeStyle(1, 0x2a1a10).setOrigin(0.5);

        const txt = this.add
            .text(x + labelOffsetX, labelY, label, serifStyle(labelSize, color))
            .setOrigin(0.5);
        fitLabel(txt, labelWidth, labelSize);

        let pressedPointer = null;
        btn.setInteractive({ useHandCursor: true })
            .on('pointerover', () => {
                SoundHelper.playVariant(this, 'hover_button', 0.4);
                if (hasSprite) btn.setTint(0xdddddd);
            })
            .on('pointerout', () => {
                pressedPointer = null;
                if (hasSprite) btn.clearTint();
                txt.setY(labelY);
            })
            .on('pointerdown', (pointer) => {
                pressedPointer = pointer;
                SoundHelper.playVariant(this, 'button_click', 0.5);
                if (hasSprite) btn.setTint(0x999999);
                txt.setY(labelY + 1);
            })
            .on('pointerup', (pointer) => {
                const activated = pressedPointer !== null && pressedPointer === pointer;
                pressedPointer = null;
                if (hasSprite) btn.clearTint();
                txt.setY(labelY);
                if (activated) callback?.();
            });

        return { button: btn, shadow, text: txt };
    },
    createVolumeControl(label, y, volumeType, layout = {}) {
        if (!this.volumeControls) this.volumeControls = [];

        // Labels are right-aligned against the bar, the way Taya's mockup has
        // them. At 16px the serif is far wider than the bitmap font it replaced
        // ("Volumen de música" is 125px against the old 77px), so a left-aligned
        // label ran straight into the bar.
        const { labelRightX = 282, barX = 320, showReading = true } = layout;
        const barY = y;
        const readingY = barY + 14;
        const trackX = barX - UI_BUTTON_W / 2 + BAR_TRACK_X;
        const hasSprite = this.textures.exists('uiButtons');

        const labelText = this.add
            .text(labelRightX, y, label, serifStyle(SERIF_BODY_PX, OPTIONS_INK))
            .setOrigin(1, 0.5);

        const currentVolume = this.game.globalVolume[volumeType];

        const sliderBg = hasSprite
            ? this.add.image(barX, barY, 'uiButtons', UI_BUTTON.barEmpty).setOrigin(0.5)
            : this.add.rectangle(barX, barY, BAR_TRACK_W, 12, 0x4a3526).setStrokeStyle(1, 0x2a1a10);

        const sliderFill = hasSprite
            ? this.add.image(barX, barY, 'uiButtons', UI_BUTTON.barFill).setOrigin(0.5)
            : this.add.rectangle(trackX, barY, BAR_TRACK_W * currentVolume, 12, 0x8a9a7a).setOrigin(0, 0.5);

        // The diamond sits a pixel above the bar's centre line: the bar art is
        // drawn slightly low in its 32px cell, and centring the knob on the cell
        // left it reading as hung below the track.
        const knobY = barY + KNOB_OFFSET_Y;
        const handle = (this.textures.exists('volumeKnob')
            ? this.add.image(trackX, knobY, 'volumeKnob').setOrigin(0.5)
            : this.add.circle(trackX, knobY, 6, 0xffc2a2).setStrokeStyle(1, 0x050505))
            .setInteractive({ draggable: true, useHandCursor: true });

        const volumeText = this.add.text(barX, readingY, '', {
            fontSize: '12px',
            fill: OPTIONS_INK,
            fontFamily: '"HoMM Pixel", Arial, sans-serif'
        }).setOrigin(0.5).setVisible(showReading);

        // Dragging fires on every pointer move, so the tick is rung per notch of
        // the bar rather than per pixel — twenty across the track, which reads as
        // a ratchet under the thumb instead of a rattle.
        const TICK_STEPS = 20;
        let lastTickStep = null;

        // Move the slider to a target volume (0..1) and apply it. Shared by both
        // dragging the handle and clicking anywhere on the track.
        const applyVolume = (newVolume, { silent = false } = {}) => {
            newVolume = Phaser.Math.Clamp(newVolume, 0, 1);
            const filled = BAR_TRACK_W * newVolume;
            handle.x = trackX + filled;
            this.game.globalVolume[volumeType] = newVolume;

            if (hasSprite) {
                // Crop from the frame's left edge through the filled stretch, so
                // the bar's pointed left cap stays drawn while it has any level.
                sliderFill.setVisible(newVolume > 0);
                sliderFill.setCrop(0, 0, BAR_TRACK_X + filled, 32);
            } else {
                sliderFill.width = filled;
            }
            volumeText.setText(Math.round(newVolume * 100) + '%');

            if (silent) {
                lastTickStep = Math.round(newVolume * TICK_STEPS);
                return;
            }

            this.saveSettings();
            if (volumeType === 'music') MusicManager.updateCurrentVolume(this);

            // The sfx bar demonstrates the level it is setting. A coin pickup
            // used to stand in for that; this is the bar's own tick, and being
            // an sfx it is heard at exactly the volume being dialled in.
            const step = Math.round(newVolume * TICK_STEPS);
            if (volumeType === 'sfx' && newVolume > 0 && step !== lastTickStep) {
                SoundHelper.playSound(this, 'ui_slider_tick', 0.6);
            }
            lastTickStep = step;
        };

        applyVolume(currentVolume, { silent: true });

        // Click (or drag) anywhere on the track to jump the slider there — not
        // just a slow drag of the handle. The zone spans the full track.
        const sliderZone = this.add.zone(barX, barY, BAR_TRACK_W, 24)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', (pointer) => applyVolume((pointer.worldX - trackX) / BAR_TRACK_W));
        // Keep the handle above the zone so grabbing it still starts a drag.
        this.children.bringToTop(handle);

        // Handle dragging
        handle.on('drag', (pointer, dragX) => applyVolume((dragX - trackX) / BAR_TRACK_W));

        // Store controls for cleanup
        this.volumeControls.push({
            type: volumeType,
            label: labelText,
            bg: sliderBg,
            fill: sliderFill,
            handle: handle,
            text: volumeText,
            zone: sliderZone
        });
    }
};
