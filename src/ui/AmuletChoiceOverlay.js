// Full-screen "pick 1 of up to 3 amulets" overlay. Works on any Phaser scene
// that has access to an AmuletManager (GameScene, ShopScene, …).

import { showItemTooltip, hideItemTooltip } from './ItemTooltip.js';
import { SoundHelper } from '../audio/SoundHelper.js';

const RARITY_COLOR = {
  common: 0xb0b0b0,
  uncommon: 0x3fb950,
  rare: 0x58a6ff,
  legendary: 0xffd700,
  cursed: 0xff4444,
};

/**
 * @param {Phaser.Scene} scene
 * @param {{ rarity: string, options: object[], amuletManager: object, onPicked?: (id: string) => void, onCancel?: () => void, title?: string }} cfg
 * @returns {{ close: () => void } | null}
 */
export function openAmuletChoiceOverlay(scene, cfg) {
  if (!cfg?.amuletManager) return null;
  // Offers are rolled when the card spawns and redeemed whenever the player
  // gets to it, so anything acquired in between is dead on arrival. Drop it
  // here rather than rendering a card that can only refuse to be picked.
  const options = cfg.amuletManager.takeableOptions
    ? cfg.amuletManager.takeableOptions(cfg.options)
    : (cfg.options || []).filter((o) => o?.id);
  if (!options.length) return null;
  if (scene._amuletChoiceOpen) return null;
  scene._amuletChoiceOpen = true;

  const depth = 4000;
  const nodes = [];
  const push = (obj) => { nodes.push(obj); return obj; };

  const close = () => {
    hideItemTooltip(scene);
    for (const n of nodes) {
      try { n.destroy?.(); } catch (_) { /* already gone */ }
    }
    scene._amuletChoiceOpen = false;
  };

  const cam = scene.cameras?.main;
  const w = cam?.width || 640;
  const h = cam?.height || 360;

  // Dim the board so the choice reads as a modal event.
  const veil = push(scene.add.rectangle(w / 2, h / 2, w + 4, h + 4, 0x000000, 0.72));
  veil.setDepth(depth);
  veil.setInteractive(); // block clicks through

  const rarity = cfg.rarity || options[0].rarity || 'common';
  const titleText = cfg.title || `Choose a ${rarity} amulet`;
  const title = push(scene.add.text(w / 2, 48, titleText, {
    fontSize: '18px',
    fontFamily: 'monospace',
    color: '#e6edf3',
  }).setOrigin(0.5).setDepth(depth + 1));

  const subtitle = push(scene.add.text(w / 2, 72, 'Pick one', {
    fontSize: '12px',
    fontFamily: 'monospace',
    color: '#8b949e',
  }).setOrigin(0.5).setDepth(depth + 1));

  const accent = RARITY_COLOR[rarity] || 0x58a6ff;
  push(scene.add.rectangle(w / 2, 88, 120, 3, accent, 1).setDepth(depth + 1));

  const spacing = 110;
  const startX = w / 2 - ((options.length - 1) * spacing) / 2;
  const cardY = h / 2 + 10;

  options.forEach((item, i) => {
    const x = startX + i * spacing;
    const shadow = push(scene.add.rectangle(x, cardY + 28, 52, 15, 0x000000, 0.55));
    shadow.setDepth(depth + 1);

    const spriteKey = item.sprite || 'cardBack';
    const sprite = item.spriteFrame !== undefined
      ? scene.add.sprite(x, cardY, spriteKey, item.spriteFrame)
      : scene.add.sprite(x, cardY, spriteKey);
    push(sprite);
    sprite.setDepth(depth + 2);
    sprite.setInteractive({ useHandCursor: true });

    const name = push(scene.add.text(x, cardY + 48, item.name || item.id, {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#e6edf3',
      wordWrap: { width: 100 },
      align: 'center',
    }).setOrigin(0.5, 0).setDepth(depth + 2));

    sprite.on('pointerover', () => {
      scene.tweens.add({ targets: sprite, y: cardY - 6, duration: 120, ease: 'Power2' });
      // +10 keeps the tooltip clear of the overlay's own layers (veil, cards,
      // labels sit at depth..depth+2) instead of rendering behind them.
      showItemTooltip(scene, item, sprite.x, sprite.y - 10, depth + 10);
    });
    sprite.on('pointerout', () => {
      scene.tweens.add({ targets: sprite, y: cardY, duration: 120, ease: 'Power2' });
      hideItemTooltip(scene);
    });
    sprite.on('pointerdown', () => {
      const ok = cfg.amuletManager.addAmulet(item.id);
      if (!ok) {
        // addAmulet already floated its own reason. This overlay has no cancel
        // button, so leaving it open on a refused pick strands the player with
        // no way out — close instead of trapping them.
        scene.createFloatingText?.(x, cardY - 36, 'Already owned!', 0xff4444);
        close();
        cfg.onCancel?.();
        return;
      }
      SoundHelper.playSound(scene, 'shop_buy', 0.5);
      if (typeof scene.createFloatingText === 'function') {
        scene.createFloatingText(x, cardY - 36, `${item.name} equipped!`, 0x9932cc);
      } else if (typeof scene.showFeedback === 'function') {
        scene.showFeedback({ key: 'float.equippedItem', vars: { name: item.name } }, 0x9932cc);
      }
      close();
      cfg.onPicked?.(item.id, item);
    });

    // Drop-in
    sprite.y = cardY - 60;
    sprite.setAlpha(0);
    name.setAlpha(0);
    scene.tweens.add({
      targets: [sprite, name],
      y: cardY,
      alpha: 1,
      duration: 280,
      delay: i * 60,
      ease: 'Back.easeOut',
      onUpdate: () => { name.y = sprite.y + 48; },
      onComplete: () => { name.y = cardY + 48; },
    });
  });

  // Keep title/subtitle refs live for linters / future cancel button.
  void title;
  void subtitle;

  return { close };
}
