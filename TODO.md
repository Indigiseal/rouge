# TODO.md

> Agent notes:
> - Work on the **first unchecked** task only.
> - Apply minimal edits.
> - **Only edit files listed under “Files”.**
> - Keep names as-is; do not rename classes/functions.
> - Do not change save format.

## High-impact goals
- Implement melee front/back gating for enemy reveals.
- Create initial reveal logic (2–3 enemies at start, front + back mix).
- Add AoE “reveal-before-damage”.
- Later: sockets & gems.

## Tasks


- [ ] Prompt 3.1 — AoE/chain reveal wrapper (no sockets yet)  
  **Files:** `cardSystem.js`  
  **Implement:**
  - `applyEffectToAxials(axials, { baseDamage, tags })`:
    1) If a card at axial is face-down, call `revealCard(i)` first and **log** `"[Hex] AoE revealed -> id"`.
    2) If now enemy/boss, apply damage per `tags.source` (`'fire'|'lightning'|'poison'`).
  - Use this wrapper wherever you do splashes/chain effects (e.g., mimic splash, trap effects).  
  **Acceptance:** AoE reveals closed cards it would hit, then damages enemies.

- [ ] Prompt 3 — Sockets & gems (scoped)  
  **Files:** `SaveManager.js`, `inventorySystem.js`, `CardDataGenerator.js`, `cardSystem.js`  
  **Implement (minimal, no combat effects yet):**
  - Weapons gain `sockets: Array<'empty'|'red'|'blue'|'green'>` by tier: T1–2:0, T3:1, T4:2, T5+:3.
  - New item `type: 'gem'`, `color: 'red'|'blue'|'green'`.
  - Simple attach: clicking a gem in inventory fills first empty socket of **equipped** weapon.
  - Persist sockets; tolerate save files without this field.  
  **Acceptance:** I can pick up a gem and see it occupy a socket on a T3+ weapon and survive save/load.

## Test Plan
1. Start a new floor → expect 2–3 enemies revealed with ≥1 frontliner.
2. Try melee on a revealed back enemy → **blocked** with `[Hex]` log.
3. Kill remaining front → exactly one back enemy flips (`[Hex] reveal behind -> id`).
4. Trigger a splash/chain effect → closed cards in the area flip before taking damage (`[Hex] AoE revealed -> id`).
