// Click-race arm wrestling overlay. Countdown, then tug-of-war meter:
// ogre drifts toward his side; each click nudges toward the player.
// Difficulty comes from `ogrePush` / `clickPower` (EventScene maps armWrestleChance).

import { SoundHelper } from '../audio/SoundHelper.js';
import { t } from '../i18n/i18n.js';
import { cameraWorldSize } from '../config/renderScale.js';

const DEPTH = 3500;
const COUNTDOWN_SECS = 3;
const METER_MIN = -1;
const METER_MAX = 1;

/**
 * @param {Phaser.Scene} scene
 * @param {{
 *   ogrePush?: number,
 *   clickPower?: number,
 *   onDone: (won: boolean) => void,
 * }} cfg
 * @returns {{ close: () => void } | null}
 */
export function openArmWrestlingMinigame(scene, cfg) {
  if (!scene || typeof cfg?.onDone !== 'function') return null;
  if (scene._armWrestlingMinigameOpen) return null;
  scene._armWrestlingMinigameOpen = true;

  const ogrePush = Math.max(0.18, cfg.ogrePush ?? 0.3);
  // Fallback: click sized for base drift; caller may pass a faster ogrePush.
  const clickPower = Math.max(0.04, cfg.clickPower ?? 0.075);

  const nodes = [];
  const push = (obj) => { nodes.push(obj); return obj; };
  let closed = false;
  let meter = 0;
  let phase = 'countdown'; // countdown | fight | done
  let countdownLeft = COUNTDOWN_SECS;
  let updateHandler = null;
  let baseArmScale = 1;

  const cam = scene.cameras?.main;
  // Viewport in world units, not device pixels — see cameraWorldSize.
  const { width: w, height: h } = cameraWorldSize(cam);
  const cx = w / 2;
  const cy = h / 2;

  const close = () => {
    if (closed) return;
    closed = true;
    if (updateHandler) scene.events?.off?.('update', updateHandler);
    for (const n of nodes) {
      try { n.destroy?.(); } catch (_) { /* already gone */ }
    }
    scene._armWrestlingMinigameOpen = false;
  };

  const finish = (won) => {
    if (phase === 'done') return;
    phase = 'done';
    statusText.setText(t(scene, won ? 'ui.armWrestling.win' : 'ui.armWrestling.lose'));
    statusText.setColor(won ? '#7ee787' : '#ff7b72');
    clickZone.disableInteractive();
    clickHint.setVisible(false);
    scene.time?.delayedCall?.(550, () => {
      close();
      cfg.onDone(won);
    });
  };

  // Dimmer blocks clicks falling through to the event panel.
  const veil = push(scene.add.rectangle(cx, cy, w + 4, h + 4, 0x000000, 0.78));
  veil.setDepth(DEPTH).setInteractive();

  const panelW = 420;
  const panelH = 268;
  const panel = push(scene.add.rectangle(cx, cy - 8, panelW, panelH, 0x1a1420, 0.96));
  panel.setStrokeStyle(2, 0xc9a227).setDepth(DEPTH + 1);

  push(scene.add.text(cx, cy - panelH / 2 + 16, t(scene, 'ui.armWrestling.title'), {
    fontSize: '16px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#f0e6d2',
  }).setOrigin(0.5).setDepth(DEPTH + 2));

  const artY = cy - 28;
  let arms = null;
  if (scene.textures?.exists?.('armWrestlingHands')) {
    arms = push(scene.add.image(cx, artY, 'armWrestlingHands'));
    arms.setDepth(DEPTH + 2);
    const maxW = panelW - 36;
    const maxH = 128;
    baseArmScale = Math.min(maxW / arms.width, maxH / arms.height);
    arms.setScale(baseArmScale);
  } else {
    arms = push(scene.add.rectangle(cx, artY, 220, 90, 0x3a2a1a, 1));
    arms.setStrokeStyle(2, 0x8b6914).setDepth(DEPTH + 2);
    push(scene.add.text(cx, artY, t(scene, 'ui.armWrestling.lockedHands'), {
      fontSize: '12px',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      color: '#c9a227',
    }).setOrigin(0.5).setDepth(DEPTH + 3));
  }

  const statusText = push(scene.add.text(cx, cy - panelH / 2 + 36, t(scene, 'ui.armWrestling.instructions'), {
    fontSize: '12px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ffe8b0',
  }).setOrigin(0.5).setDepth(DEPTH + 3));

  const countdownText = push(scene.add.text(cx, artY, String(COUNTDOWN_SECS), {
    fontSize: '42px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 4,
  }).setOrigin(0.5).setDepth(DEPTH + 5));

  const meterY = cy + 78;
  const meterW = 280;
  const meterH = 18;
  push(scene.add.rectangle(cx, meterY, meterW + 6, meterH + 6, 0x000000, 0.9).setDepth(DEPTH + 2));
  const meterTrack = push(scene.add.rectangle(cx, meterY, meterW, meterH, 0x2a2030, 1).setDepth(DEPTH + 3));
  meterTrack.setStrokeStyle(1, 0x6e5a3a);

  // Center-origin rope fills — setDisplaySize so Phaser actually redraws.
  const playerFill = push(scene.add.rectangle(cx, meterY, 2, meterH - 2, 0x58a6ff, 1).setDepth(DEPTH + 4));
  playerFill.setOrigin(0, 0.5);
  const ogreFill = push(scene.add.rectangle(cx, meterY, 2, meterH - 2, 0xff7b72, 1).setDepth(DEPTH + 4));
  ogreFill.setOrigin(1, 0.5);

  const marker = push(scene.add.rectangle(cx, meterY, 6, meterH + 12, 0xf0e6d2, 1).setDepth(DEPTH + 5));
  marker.setStrokeStyle(1, 0xffffff);

  push(scene.add.text(cx - meterW / 2 - 8, meterY, t(scene, 'ui.armWrestling.ogre'), {
    fontSize: '10px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#ff7b72',
  }).setOrigin(1, 0.5).setDepth(DEPTH + 3));

  push(scene.add.text(cx + meterW / 2 + 8, meterY, t(scene, 'ui.armWrestling.you'), {
    fontSize: '10px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#58a6ff',
  }).setOrigin(0, 0.5).setDepth(DEPTH + 3));

  // Whole panel is the strike zone — near-invisible hit rects often miss clicks.
  const clickZone = push(scene.add.rectangle(cx, cy - 8, panelW - 8, panelH - 8, 0x58a6ff, 0));
  clickZone.setDepth(DEPTH + 6);
  clickZone.setInteractive({ useHandCursor: true });
  if (clickZone.input) clickZone.input.alwaysEnabled = true;

  const clickHint = push(scene.add.text(cx, meterY + 30, t(scene, 'ui.armWrestling.clickHint'), {
    fontSize: '11px',
    fontFamily: '"HoMM Pixel", Arial, sans-serif',
    color: '#8b949e',
  }).setOrigin(0.5).setDepth(DEPTH + 7));
  clickHint.setVisible(false);

  const syncMeter = () => {
    const t = (meter - METER_MIN) / (METER_MAX - METER_MIN);
    const markerX = cx - meterW / 2 + t * meterW;
    marker.x = markerX;

    const half = meterW / 2;
    const fillH = meterH - 2;
    if (meter >= 0) {
      const pw = Math.max(2, meter * half);
      playerFill.setDisplaySize(pw, fillH);
      playerFill.x = cx;
      ogreFill.setDisplaySize(2, fillH);
      ogreFill.x = cx;
    } else {
      const ow = Math.max(2, -meter * half);
      ogreFill.setDisplaySize(ow, fillH);
      ogreFill.x = cx;
      playerFill.setDisplaySize(2, fillH);
      playerFill.x = cx;
    }

    if (arms?.setRotation) {
      arms.setRotation(-meter * 0.22);
    }
  };
  syncMeter();

  const pulseCountdown = () => {
    countdownText.setScale(1.25);
    scene.tweens?.add?.({
      targets: countdownText,
      scale: 1,
      duration: 220,
      ease: 'Back.easeOut',
    });
  };
  pulseCountdown();

  const punchClickFeedback = () => {
    // Flash the panel rim so every click reads immediately.
    panel.setStrokeStyle(3, 0x58a6ff);
    scene.time?.delayedCall?.(70, () => {
      if (!closed) panel.setStrokeStyle(2, 0xc9a227);
    });

    const pop = push(scene.add.text(cx + Phaser.Math.Between(-40, 40), meterY - 18, '>', {
      fontSize: '18px',
      fontFamily: '"HoMM Pixel", Arial, sans-serif',
      color: '#58a6ff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(DEPTH + 8));
    scene.tweens?.add?.({
      targets: pop,
      y: pop.y - 22,
      alpha: 0,
      duration: 280,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        try { pop.destroy(); } catch (_) { /* gone */ }
      },
    });

    scene.tweens?.add?.({
      targets: marker,
      scaleX: 1.6,
      scaleY: 1.35,
      duration: 50,
      yoyo: true,
    });

    if (arms?.setScale) {
      arms.setScale(baseArmScale * 1.06);
      scene.tweens?.add?.({
        targets: arms,
        scaleX: baseArmScale,
        scaleY: baseArmScale,
        duration: 70,
      });
    }
  };

  let countdownAcc = 0;
  updateHandler = (_time, delta) => {
    if (closed || phase === 'done') return;
    const dt = Math.min(0.05, (delta || 16) / 1000);

    if (phase === 'countdown') {
      countdownAcc += dt;
      const left = Math.ceil(COUNTDOWN_SECS - countdownAcc);
      if (left !== countdownLeft && left > 0) {
        countdownLeft = left;
        countdownText.setText(String(left));
        pulseCountdown();
      }
      if (countdownAcc >= COUNTDOWN_SECS) {
        phase = 'fight';
        countdownText.setVisible(false);
        statusText.setText(t(scene, 'ui.armWrestling.push'));
        statusText.setColor('#ffe8b0');
        clickHint.setVisible(true);
        // Slight tint so the hit area is obvious without blocking the art.
        clickZone.setFillStyle(0x58a6ff, 0.06);
        SoundHelper.playSound(scene, 'hover_button', 0.35);
      }
      return;
    }

    if (phase === 'fight') {
      meter = Math.max(METER_MIN, meter - ogrePush * dt);
      syncMeter();
      if (meter <= METER_MIN) finish(false);
    }
  };
  scene.events.on('update', updateHandler);

  clickZone.on('pointerdown', () => {
    if (closed) return;
    if (phase === 'countdown') {
      statusText.setText(t(scene, 'ui.armWrestling.wait'));
      statusText.setColor('#ff7b72');
      return;
    }
    if (phase !== 'fight') return;

    meter = Math.min(METER_MAX, meter + clickPower);
    syncMeter();
    punchClickFeedback();
    SoundHelper.playVariant(scene, 'button_click', 0.45);

    if (meter >= METER_MAX) finish(true);
  });

  return { close };
}
