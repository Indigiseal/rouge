// The glow around a secret room on the map: the fire reach's swirl (ui/FireReach.js) in the
// hidden path's own colours. Soft blobs of purple, violet, a reddish magenta and a bluish
// indigo orbit the node in opposite directions and blend; motes float up and cool through
// lilac to blue; the edge line stays the boundary. Stepped, with motes in whole pixels.
//
// Drawn into a Graphics the caller adds to its container. It is its own timer, which stops
// when the Graphics is destroyed, so a rebuilt map leaves nothing running.

const PURPLE = 0xc58cff;
const VIOLET = 0x7a4bd6;
const MAGENTA = 0xd63a7a;
const INDIGO = 0x4b7bd6;
const EDGE = 0xc58cff;
// Motes walk this list as they cool.
const MOTE_PALETTE = [0xf3e6ff, 0xd9b8ff, 0xc58cff, 0x9a6bd8, 0x4b7bd6];

const STEP_MS = 90;
// Each blob: colour, orbit and size (shares of the radius), angular speed per step, start angle.
const BLOBS = [
  { color: PURPLE, orbit: 0.38, size: 0.56, speed: 0.07, phase: 0 },
  { color: MAGENTA, orbit: 0.36, size: 0.5, speed: -0.06, phase: 1.1 },
  { color: INDIGO, orbit: 0.24, size: 0.5, speed: -0.09, phase: 2.6 },
  { color: VIOLET, orbit: 0.42, size: 0.5, speed: 0.08, phase: 3.7 },
  { color: MAGENTA, orbit: 0.16, size: 0.42, speed: 0.11, phase: 5.0 },
  { color: INDIGO, orbit: 0.3, size: 0.4, speed: 0.1, phase: 4.2 },
];
const BLOB_ALPHA = 0.3;
const MOTES = 12;
const MOTE_LIFE = 9; // steps

/** The aura at (x, y), in the container's own space. Returns the Graphics. */
export function createSecretAura(scene, x, y, radius, depth = 0) {
  const g = scene.add.graphics().setDepth(depth);
  const motes = [];
  let step = Math.floor(Math.random() * 40);

  const spawn = (mote = {}) => {
    const angle = Math.random() * Math.PI * 2;
    const dist = Math.sqrt(Math.random()) * Math.max(3, radius - 3);
    mote.dx = Math.round(Math.cos(angle) * dist);
    mote.dy = Math.round(Math.sin(angle) * dist);
    mote.age = Math.floor(Math.random() * MOTE_LIFE);
    mote.color = Math.floor(Math.random() * 2);
    return mote;
  };
  for (let i = 0; i < MOTES; i++) motes.push(spawn());

  const draw = () => {
    g.clear();
    g.fillStyle(VIOLET, 0.16);
    g.fillCircle(x, y, radius);
    for (const blob of BLOBS) {
      const angle = blob.phase + step * blob.speed;
      const bx = Math.round(x + Math.cos(angle) * radius * blob.orbit);
      const by = Math.round(y + Math.sin(angle) * radius * blob.orbit);
      const r = Math.round(radius * blob.size);
      g.fillStyle(blob.color, BLOB_ALPHA * 0.6);
      g.fillCircle(bx, by, r);
      g.fillStyle(blob.color, BLOB_ALPHA);
      g.fillCircle(bx, by, Math.round(r * 0.65));
    }
    for (const mote of motes) {
      const life = mote.age / MOTE_LIFE;
      const color = MOTE_PALETTE[Math.min(MOTE_PALETTE.length - 1, mote.color + Math.floor(mote.age / 3))];
      g.fillStyle(color, 0.9 * (1 - life));
      g.fillRect(Math.round(x + mote.dx), Math.round(y + mote.dy - mote.age), 1, 1);
    }
    g.lineStyle(2, EDGE, 0.7);
    g.strokeCircle(x, y, radius);
  };

  const timer = scene.time.addEvent({
    delay: STEP_MS,
    loop: true,
    callback: () => {
      if (!g.scene) { timer.remove(false); return; }
      step++;
      for (const mote of motes) {
        mote.age++;
        if (mote.age >= MOTE_LIFE) spawn(mote);
      }
      draw();
    },
  });
  g.once('destroy', () => timer.remove(false));
  draw();
  return g;
}
