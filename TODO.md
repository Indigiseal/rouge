```markdown
# TODO.md

## High-impact goals
- Implement melee front/back gating mechanics.
- Ensure initial enemy reveal logic is functional.
- Develop socket/gem integration for cards.
- Create Area of Effect (AoE) reveal mechanics.
- Test and refine ranged attack penalties.

## Tasks

### src/cardSystem.js
- [ ] Implement front/back row mechanics for melee and ranged attacks.
  - Acceptance criteria:
    - Melee can only hit front row.
    - Ranged can hit back row with a damage penalty.
  - How to test: Verify damage calculations in combat scenarios.

### gameScene.js
- [ ] Integrate enemy reveal logic on new floors.
  - Acceptance criteria:
    - At least one front enemy and one back enemy are revealed.
  - How to test: Start a new game and check enemy reveals on the first floor.

### cardSystem.js
- [ ] Add AoE reveal mechanics for closed cards.
  - Acceptance criteria:
    - Closed cards are revealed if they would take damage from AoE.
  - How to test: Create a scenario with AoE damage and verify reveals.

### inventorySystem.js
- [ ] Implement socket/gem mechanics for cards.
  - Acceptance criteria:
    - Cards can have sockets for gems.
  - How to test: Create a card with a socket and attempt to add a gem.

## Test plan
1. Start a new game and navigate to the first floor.
   - Expected: At least one front and one back enemy should be revealed.
2. Engage in combat with melee and ranged attacks.
   - Expected: Melee attacks only hit front row; ranged attacks show reduced damage when hitting back row.
3. Test AoE damage scenarios.
   - Expected: Closed cards that would take damage are revealed.
4. Create a card with a socket and attempt to add a gem.
   - Expected: The gem should be added successfully.

## Risks & rollbacks
- **Risk**: Potential bugs in enemy reveal logic could affect gameplay.
  - **Rollback**: Revert to the previous version of the cardSystem.js and gameScene.js if issues arise.
  
- **Risk**: Socket/gem integration may introduce new bugs.
  - **Rollback**: Disable socket functionality and revert to the previous inventorySystem.js if necessary.

- **Risk**: AoE mechanics may not function as intended.
  - **Rollback**: Temporarily disable AoE mechanics and revert to the last stable version of cardSystem.js.
```