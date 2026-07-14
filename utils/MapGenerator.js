// utils/MapGenerator.js
export class MapGenerator {
  constructor({
    LANES = 7,
    FLOORS = 15,          // 0..13 normal, 14 boss
    PATHS = 6,
    LANE_GAP = 120,       // pixel spacing for x (so MapViewScene doesn't change)
    eliteMult = 1.0       // set 1.6 if you want more elites later
  } = {}) {
    this.LANES = LANES;
    this.FLOORS = FLOORS;
    this.PATHS = PATHS;
    this.LANE_GAP = LANE_GAP;
    this.eliteMult = eliteMult;

    this.acts = [
      { start: 1, end: 15, boss: 'Spider Queen' },
      { start: 16, end: 30, boss: 'Cerberus' },
      { start: 31, end: 45, boss: 'Ancient Cerberus' }
    ];
  }

  generateFullMap() {
    // Must match MapViewScene's MAP_VERSION. Otherwise the version-check there
    // fails on every load and the map regenerates after every floor.
    const full = { _version: 5 };
    for (let act = 1; act <= 3; act++) full[`act${act}`] = this.generateAct(act);
    return full;
  }

  generateAct(actNumber) {
    let attempts = 0;
    while (attempts++ < 100) {
      // ---- 1) Build lanes per floor (clean, contiguous blocks) ----
      const floors = [];
      const mid = Math.floor(this.LANES / 2);
      // floor 0: single start node at center lane
      floors.push([this._makeNode(actNumber, 0, 0, mid, 'COMBAT')]);
      // floors 1..13: 2-4 nodes, contiguous lanes, centered-ish
      for (let f = 1; f < this.FLOORS - 1; f++) {
        const count = this._nodeCountForFloor(f);
        const leftMost = Math.max(0, Math.min(this.LANES - count, mid - Math.floor(count / 2)));
        const lanes = Array.from({ length: count }, (_, i) => leftMost + i);
        floors.push(lanes.map((lane, i) => this._makeNode(actNumber, f, i, lane, null)));
      }
      // final act floor: single centered boss node
      floors.push([this._makeNode(actNumber, this.FLOORS - 1, 0, mid, 'BOSS')]);
      // ---- 2) Wire connections (adjacent lanes only, avoid crossing) ----
      for (let f = 0; f < this.FLOORS - 1; f++) {
        this._connectRowPair(floors[f], floors[f + 1]);
      }
      // Ensure every node is on a path from start to end
      this._ensureFullPathCoverage(floors);
      // Check if fully connected; if not, retry
      if (this._isFullyConnected(floors)) {
        // ---- 3) Assign room types with rules (+ ensure at least one REST & SHOP) ----
        this._assignTypes(floors);
        return {
          actNumber,
          floors,
          startFloor: this.acts[actNumber - 1].start,
          endFloor: this.acts[actNumber - 1].end
        };
      }
    }
    throw new Error(`Failed to generate fully connected map for act ${actNumber} after 100 attempts`);
  }

  // ---------- helpers ----------
  _makeNode(act, floorIndex, indexInFloor, lane, type) {
    const x = (lane - (this.LANES - 1) / 2) * this.LANE_GAP;
    return {
      id: `act${act}_floor${floorIndex}_${indexInFloor}`,
      type: type || null,
      x,                    // pixel x your scene already uses
      y: floorIndex,        // floor index (your scene uses this as-is)
      lane,                 // internal lane (not required by your scene)
      connections: [],      // indices into next floor
      visited: false
    };
  }

  _nodeCountForFloor(f) {
    // denser in the middle floors
    if (f >= 3 && f <= 6) return Math.random() < 0.5 ? 3 : 4;
    return Math.random() < 0.7 ? 2 : 3;
  }

  _connectRowPair(cur, nxt) {
    // candidates: grid-adjacent only
    const reach = cur.map(c =>
      nxt.map((n, j) => ({ j, ok: Math.abs(n.lane - c.lane) <= 1 }))
          .filter(o => o.ok).map(o => o.j)
    );

    // no-cross constraint checker
    const edges = []; // [i,j]
    const crosses = (i, j) => edges.some(([a, b]) => (i < a && j > b) || (i > a && j < b));

    // Phase A: ensure every next node has at least one incoming
    for (let j = 0; j < nxt.length; j++) {
      // choose nearest source that can reach j
      let bestI = -1, bestD = 1e9;
      for (let i = 0; i < cur.length; i++) {
        if (!reach[i].includes(j)) continue;
        const d = Math.abs(cur[i].lane - nxt[j].lane);
        if (d < bestD && !crosses(i, j)) { bestD = d; bestI = i; }
      }
      if (bestI === -1) {
        // allow crossing if unavoidable; pick nearest
        for (let i = 0; i < cur.length; i++) {
          if (reach[i].includes(j)) {
            const d = Math.abs(cur[i].lane - nxt[j].lane);
            if (d < bestD) { bestD = d; bestI = i; }
          }
        }
      }
      if (bestI !== -1) { edges.push([bestI, j]); }
    }

    // Phase B: ensure every current node has at least one outgoing
    const outDeg = Array(cur.length).fill(0);
    edges.forEach(([i]) => outDeg[i]++);
    for (let i = 0; i < cur.length; i++) {
      if (outDeg[i] > 0) continue;
      // pick nearest reachable j that doesn't cross if possible
      let bestJ = -1, bestD = 1e9;
      for (const j of reach[i]) {
        const d = Math.abs(cur[i].lane - nxt[j].lane);
        if (!crosses(i, j) && d < bestD) { bestD = d; bestJ = j; }
      }
      if (bestJ === -1 && reach[i].length) {
        // accept crossing if needed
        for (const j of reach[i]) {
          const d = Math.abs(cur[i].lane - nxt[j].lane);
          if (d < bestD) { bestD = d; bestJ = j; }
        }
      }
      if (bestJ !== -1) { edges.push([i, bestJ]); outDeg[i]++; }
    }

    // Phase C: optional second connections (non-crossing)
    for (let i = 0; i < cur.length; i++) {
      if (reach[i].length <= 1) continue;
      if (Math.random() < 0.35) {
        const used = new Set(edges.filter(([a]) => a === i).map(([, j]) => j));
        const options = reach[i].filter(j => !used.has(j));
        // try to add one that doesn't cross
        for (const j of options) {
          if (!crosses(i, j)) { edges.push([i, j]); break; }
        }
      }
    }

    // write connections
    const byI = new Map();
    edges.forEach(([i, j]) => {
      if (!byI.has(i)) byI.set(i, []);
      byI.get(i).push(j);
    });
    cur.forEach((n, i) => {
      const arr = byI.get(i) || [];
      n.connections = [...new Set(arr)].sort((a, b) => a - b);
    });
  }

  _assignTypes(floors) {
    const preBoss = this.FLOORS - 2;
    // First floor already COMBAT, last is BOSS.
    const supportTypes = new Set(['SHOP', 'RARE_SHOP', 'REST', 'ANVIL']);

    // We’ll fill floors 1..preBoss (inclusive) except boss
    const eligible = [];
    for (let f = 1; f <= preBoss; f++) {
      for (const n of floors[f]) if (n) eligible.push(n);
    }

    // Bucket-ish weights
    const baseWeights = {
      COMBAT: 48,
      ELITE: Math.round(8 * this.eliteMult),
      SHOP: 10,
      RARE_SHOP: 4,
      REST: 12,
      ANVIL: 8,
      EVENT: 21,
      TREASURE: 4,        // normal chest
      TREASURE_GOOD: 2    // better chest, rarer
    };

    // helpers
    const pickWeighted = (weights) => {
      const total = Object.values(weights).reduce((s, w) => s + w, 0);
      let r = Math.random() * total;
      for (const [k, w] of Object.entries(weights)) { r -= w; if (r <= 0) return k; }
      return 'COMBAT';
    };
    const parentsTypes = (floors, f, idx) => {
      if (f === 0) return [];
      const prev = floors[f - 1];
      const types = [];
      prev.forEach((p, pi) => {
        if (p.connections.includes(idx)) types.push(p.type);
      });
      return types;
    };
    const siblingTypes = (floors, f, idx) => {
      if (f === 0) return [];
      const prev = floors[f - 1];
      // any other child of the same parent is sibling
      const sibs = new Set();
      prev.forEach((p, pi) => {
        if (p.connections.includes(idx)) {
          p.connections.forEach(j => { if (j !== idx) sibs.add(j); });
        }
      });
      return [...sibs].map(j => floors[f][j].type);
    };
    const childTypes = (floors, f, idx) => {
      if (f >= this.FLOORS - 1) return [];
      const next = floors[f + 1];
      return floors[f][idx].connections.map(j => next[j]?.type).filter(Boolean);
    };
    const hasSupportNeighbor = (floors, f, idx) => {
      return [
        ...parentsTypes(floors, f, idx),
        ...siblingTypes(floors, f, idx),
        ...childTypes(floors, f, idx)
      ].some(type => supportTypes.has(type));
    };
    // Longest run of consecutive EVENT rooms along any path ENDING at (f, idx),
    // counting this node itself. Returns 0 if the node isn't an EVENT. Only reads
    // already-assigned upstream floors, so it's exact during the top-down pass.
    const eventChainEndingAt = (f, idx) => {
      const node = floors[f]?.[idx];
      if (!node || node.type !== 'EVENT') return 0;
      if (f === 0) return 1;
      let best = 0;
      floors[f - 1].forEach((p, pi) => {
        if (p.connections.includes(idx)) best = Math.max(best, eventChainEndingAt(f - 1, pi));
      });
      return 1 + best;
    };
    // True if making (f, idx) an EVENT would create three EVENTs in a row along
    // some path into it (a parent already ends a run of >= 2 EVENTs).
    const wouldMakeEventTriple = (f, idx) => {
      if (f === 0) return false;
      let maxParentChain = 0;
      floors[f - 1].forEach((p, pi) => {
        if (p.connections.includes(idx)) maxParentChain = Math.max(maxParentChain, eventChainEndingAt(f - 1, pi));
      });
      return maxParentChain >= 2;
    };

    // A "fight" room (COMBAT/ELITE/BOSS) resets the non-combat run; everything
    // else (EVENT, TREASURE, SHOP, REST, ANVIL, …) extends it.
    const isFightType = (type) => type === 'COMBAT' || type === 'ELITE' || type === 'BOSS';
    // Cap on how many non-combat rooms may appear back-to-back along any path.
    // Stops branches like EVENT -> TREASURE -> EVENT -> TREASURE (the "4 rooms
    // with no fight" complaint) while still allowing a fight -> reward -> reward
    // -> fight rhythm. Bump to 3 for looser pacing.
    const MAX_NONCOMBAT_RUN = 2;
    // Longest run of consecutive NON-COMBAT rooms along any path ending at
    // (f, idx), counting this node. 0 if this node is a fight room. Only reads
    // already-assigned upstream floors, so it's exact during the top-down pass.
    const nonCombatRunEndingAt = (f, idx) => {
      const node = floors[f]?.[idx];
      if (!node || !node.type || isFightType(node.type)) return 0;
      if (f === 0) return 1;
      let best = 0;
      floors[f - 1].forEach((p, pi) => {
        if (p.connections.includes(idx)) best = Math.max(best, nonCombatRunEndingAt(f - 1, pi));
      });
      return 1 + best;
    };
    // True if making (f, idx) a non-combat room would push some path past
    // MAX_NONCOMBAT_RUN back-to-back non-combat rooms.
    const wouldExceedNonCombatRun = (f, idx) => {
      if (f === 0) return false;
      let maxParent = 0;
      floors[f - 1].forEach((p, pi) => {
        if (p.connections.includes(idx)) maxParent = Math.max(maxParent, nonCombatRunEndingAt(f - 1, pi));
      });
      return maxParent >= MAX_NONCOMBAT_RUN;
    };

    // pass 1: assign respecting simple rules
    let rareShopCount = 0; // capped at 2 per act
    for (let f = 1; f <= preBoss; f++) {
      for (let i = 0; i < floors[f].length; i++) {
        const n = floors[f][i];
        if (n.type === 'BOSS' || n.type === 'COMBAT' && f === 0) continue;
        if (n.type) continue;

        let attempt = 0, chosen = null;
        while (attempt++ < 12) {
          let t = pickWeighted(baseWeights);

          // floor restrictions
          if (f <= 1 && (t === 'ELITE' || t === 'REST')) continue; // no early elite/rest
          if (f === preBoss && t === 'REST') continue;              // no rest before boss
          if ((t === 'TREASURE' || t === 'TREASURE_GOOD') && f <= 2) continue; // No early chests
          if (t === 'TREASURE_GOOD' && f <= 5) continue; // Good chests only in mid/late floors
          if (t === 'RARE_SHOP' && rareShopCount >= 2) continue; // at most two rare shops per act
          if (t === 'EVENT' && wouldMakeEventTriple(f, i)) continue; // no three EVENTs in a row
          // Cap consecutive non-combat rooms so branches always break for a fight.
          if (!isFightType(t) && wouldExceedNonCombatRun(f, i)) continue;

          const pTypes = parentsTypes(floors, f, i);
          const sTypes = siblingTypes(floors, f, i);

          // parent/sibling type clash rules for these categories
          const clashy = new Set(['ELITE', 'SHOP', 'RARE_SHOP', 'REST', 'ANVIL']);
          if (clashy.has(t) && (pTypes.includes(t) || sTypes.includes(t))) { continue; }
          if (supportTypes.has(t) && (pTypes.some(type => supportTypes.has(type)) || sTypes.some(type => supportTypes.has(type)))) { continue; }

          chosen = t; break;
        }
        n.type = chosen || 'COMBAT';
        if (n.type === 'RARE_SHOP') rareShopCount++;
      }
    }

    // pass 2: ensure at least one SHOP & REST in floors 2..7 (if present)
    const ensureOne = (type, fromF = 2, toF = 7) => {
      let found = false;
      for (let f = fromF; f <= Math.min(toF, preBoss); f++)
        for (const n of floors[f]) if (n.type === type) found = true;
      if (!found) {
        // choose a safe spot
        for (let f = toF; f >= fromF; f--) {
          const candidates = floors[f].filter(n =>
            n.type !== 'BOSS' &&
            !(f <= 1 && (type === 'ELITE' || type === 'REST')) &&
            !(f === preBoss && type === 'REST') &&
            !(supportTypes.has(type) && hasSupportNeighbor(floors, f, floors[f].indexOf(n)))
          );
          if (candidates.length) {
            candidates[Math.floor(Math.random() * candidates.length)].type = type;
            return;
          }
        }

        // A dense support-room layout can leave no perfectly spaced slot.
        // Guarantees must still be guarantees, so replace a non-support room
        // inside the requested range before touching another support room.
        const fallback = [];
        for (let f = fromF; f <= Math.min(toF, preBoss); f++) {
          floors[f].forEach(n => {
            if (n.type !== 'BOSS' && !supportTypes.has(n.type)) fallback.push(n);
          });
        }
        if (fallback.length > 0) {
          fallback[Math.floor(Math.random() * fallback.length)].type = type;
        }
      }
    };
    ensureOne('REST');
    ensureOne('SHOP');
    // Two blacksmiths per act: one early (never floor 1) so durability can be
    // topped up before the mid-act grind, and one near the boss for a final
    // repair. Disjoint zones, so each is guaranteed independently.
    ensureOne('ANVIL', 2, 5);                     // early-act blacksmith
    ensureOne('ANVIL', preBoss - 3, preBoss - 1); // late-act blacksmith (near boss)
    ensureOne('TREASURE', 4, 8);             // At least one normal chest mid-act
    ensureOne('TREASURE_GOOD', 6, preBoss);  // At least one good chest per act
    // Run this guarantee last so later support-room guarantees cannot replace
    // the sole Rare Shop they are supposed to coexist with.
    ensureOne('RARE_SHOP', 3, preBoss - 2);
  }

  _computeReachability(floors) {
    const LAST = this.FLOORS - 1;
    // forward reachability from row 0
    const from = Array.from({length: this.FLOORS}, (_, f) => Array(floors[f].length).fill(false));
    from[0].fill(true); // row 0 is the start set
    for (let f = 0; f < LAST; f++) {
      for (let i = 0; i < floors[f].length; i++) if (from[f][i]) {
        floors[f][i].connections.forEach(j => { if (floors[f+1][j]) from[f+1][j] = true; });
      }
    }
    // backward reachability to last row
    const to = Array.from({length: this.FLOORS}, (_, f) => Array(floors[f].length).fill(false));
    to[LAST].fill(true);
    for (let f = LAST - 1; f >= 0; f--) {
      for (let i = 0; i < floors[f].length; i++) {
        const ok = floors[f][i].connections.some(j => to[f+1][j]);
        if (ok) to[f][i] = true;
      }
    }
    return { from, to };
  }
  _isFullyConnected(floors) {
    const { from, to } = this._computeReachability(floors);
    for (let f = 0; f < this.FLOORS; f++) {
      for (let i = 0; i < floors[f].length; i++) {
        if (!from[f][i] || !to[f][i]) return false;
      }
    }
    return true;
  }
  // Ensure every node is on a path from row 0 to the last row.
  _ensureFullPathCoverage(floors) {
    const LAST = this.FLOORS - 1;
    const canAdj = (f, i, j) => {
      const a = floors[f][i], b = floors[f+1][j];
      return Math.abs(a.lane - b.lane) <= 1;
    };
    const crosses = (f, i, j) => {
      const rowEdges = [];
      floors[f].forEach((n, idx) => n.connections.forEach(t => rowEdges.push([idx, t])));
      return rowEdges.some(([a, b]) => (i < a && j > b) || (i > a && j < b));
    };
    const addEdge = (f, i, j, allowCross=false) => {
      const arr = floors[f][i].connections;
      if (arr.includes(j)) return true;
      if (!allowCross && crosses(f, i, j)) return false;
      arr.push(j); arr.sort((x,y) => x - y);
      return true;
    };
    let { from, to } = this._computeReachability(floors);
    // 1) fix forward reachability (make every node reachable from row 0)
    for (let f = 1; f < LAST; f++) {
      for (let i = 0; i < floors[f].length; i++) {
        if (from[f][i]) continue;
        // try to attach from a prev node that is already reachable
        const candidates = [];
        for (let p = 0; p < floors[f-1].length; p++) {
          if (from[f-1][p] && canAdj(f-1, p, i)) candidates.push(p);
        }
        // nearest-by-lane first
        candidates.sort((a, b) =>
          Math.abs(floors[f-1][a].lane - floors[f][i].lane) -
          Math.abs(floors[f-1][b].lane - floors[f][i].lane)
        );
        let linked = false;
        // prefer non-crossing, then allow crossing as last resort
        for (const allowCross of [false, true]) {
          for (const p of candidates) {
            if (addEdge(f-1, p, i, allowCross)) { linked = true; break; }
          }
          if (linked) break;
        }
      }
      ({ from, to } = this._computeReachability(floors));
    }
    // 2) fix backward reachability (make every node able to reach last row)
    for (let f = LAST - 2; f >= 0; f--) {
      for (let i = 0; i < floors[f].length; i++) {
        if (to[f][i]) continue;
        const candidates = [];
        for (let j = 0; j < floors[f+1].length; j++) {
          if (to[f+1][j] && canAdj(f, i, j)) candidates.push(j);
        }
        candidates.sort((a, b) =>
          Math.abs(floors[f][i].lane - floors[f+1][a].lane) -
          Math.abs(floors[f][i].lane - floors[f+1][b].lane)
        );
        let linked = false;
        for (const allowCross of [false, true]) {
          for (const j of candidates) {
            if (addEdge(f, i, j, allowCross)) { linked = true; break; }
          }
          if (linked) break;
        }
      }
      ({ from, to } = this._computeReachability(floors));
    }
  }
  // ---------- tiny util ----------
  _randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
}
