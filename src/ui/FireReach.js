// The fire gem's reach, drawn while a fire-gem weapon is carried over an
// enemy (InventoryView.updateFireReachIndicator): every card the circle
// touches burns.
//
// Inside it, soft blobs of the fire red and a reddish magenta orbit the
// centre in opposite directions, so the two colours swirl through each other
// and blend. Embers float up and cool. The orange edge line stays the
// boundary. Updated in steps, embers in whole pixels, to suit the pixel art.

const FIRE_RED = 0xb51f1e;
const FIRE_MAGENTA = 0xd63a7a;
const EDGE = 0xef7c4b;
// Embers walk this list as they cool.
const EMBER_PALETTE = [0xfff1c4, 0xffcf7f, 0xef7c4b, 0xd8487a, 0xb51f1e];

const STEP_MS = 90;
// Each blob: its colour, orbit (share of the radius), size (share of the
// radius), angular speed per step (sign = direction) and starting angle.
// Orbit + size stays under 1, so the colour never spills past the edge.
const BLOBS = [
  { color: FIRE_RED, orbit: 0.38, size: 0.56, speed: 0.07, phase: 0 },
  { color: FIRE_MAGENTA, orbit: 0.36, size: 0.56, speed: -0.06, phase: 1.1 },
  { color: FIRE_RED, orbit: 0.24, size: 0.5, speed: -0.09, phase: 2.6 },
  { color: FIRE_MAGENTA, orbit: 0.42, size: 0.5, speed: 0.08, phase: 3.7 },
  { color: FIRE_MAGENTA, orbit: 0.16, size: 0.42, speed: 0.11, phase: 5.0 },
];
const BLOB_ALPHA = 0.24;
const EMBERS = 26;
const EMBER_LIFE = 9; // steps

/** Draws the reach in `scene` at `depth`. Call setTarget as the aim moves. */
export function createFireReach(scene, depth = 1) {
  const g = scene.add.graphics().setDepth(depth);
  const state = { x: 0, y: 0, radius: 0, step: 0, embers: [] };

  const spawnEmber = (ember = {}) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * Math.max(4, state.radius - 4);
    ember.dx = Math.round(Math.cos(angle) * dist);
    ember.dy = Math.round(Math.sin(angle) * dist);
    ember.age = Math.floor(Math.random() * EMBER_LIFE);
    ember.color = Math.floor(Math.random() * 2);
    return ember;
  };

  const draw = () => {
    g.clear();
    const { x, y, radius, step } = state;
    if (radius <= 0) return;

    // The floor of the reach, then the swirl on top of it.
    g.fillStyle(FIRE_RED, 0.12);
    g.fillCircle(x, y, radius);
    for (const blob of BLOBS) {
      const angle = blob.phase + step * blob.speed;
      const bx = Math.round(x + Math.cos(angle) * radius * blob.orbit);
      const by = Math.round(y + Math.sin(angle) * radius * blob.orbit);
      const r = Math.round(radius * blob.size);
      // A soft edge: a wide faint disc under a smaller stronger one.
      g.fillStyle(blob.color, BLOB_ALPHA * 0.6);
      g.fillCircle(bx, by, r);
      g.fillStyle(blob.color, BLOB_ALPHA);
      g.fillCircle(bx, by, Math.round(r * 0.65));
    }

    // Embers: whole-pixel squares rising and cooling.
    for (const ember of state.embers) {
      const life = ember.age / EMBER_LIFE;
      const color = EMBER_PALETTE[Math.min(EMBER_PALETTE.length - 1, ember.color + Math.floor(ember.age / 3))];
      g.fillStyle(color, 0.9 * (1 - life));
      g.fillRect(Math.round(x + ember.dx), Math.round(y + ember.dy - ember.age), 2, 2);
    }

    // The boundary: any card this line touches burns.
    g.lineStyle(1, EDGE, 0.6);
    g.strokeCircle(x, y, radius);
  };

  const timer = scene.time.addEvent({
    delay: STEP_MS,
    loop: true,
    callback: () => {
      state.step++;
      for (const ember of state.embers) {
        ember.age++;
        if (ember.age >= EMBER_LIFE) spawnEmber(ember);
      }
      draw();
    },
  });

  return {
    graphics: g,
    setTarget(x, y, radius) {
      const resized = state.radius !== radius;
      state.x = Math.round(x);
      state.y = Math.round(y);
      state.radius = radius;
      if (resized || !state.embers.length) {
        state.embers = Array.from({ length: EMBERS }, () => spawnEmber());
      }
      draw();
    },
    get scene() {
      return g.scene;
    },
    destroy() {
      timer.remove(false);
      g.destroy();
    },
  };
}
