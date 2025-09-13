```markdown
# TODO.md

## High-impact goals
- Implement melee front/back gating for enemy reveals.
- Create initial reveal logic for front and back row enemies.
- Develop socket and gem mechanics for card interactions.
- Implement area-of-effect (AoE) reveals for cards.
- Ensure acceptance criteria for enemy reveals are met.

## Tasks

### src/cardSystem.js
- [ ] Add socket and gem mechanics for cards.
  - Acceptance Criteria:
    - Cards can have sockets for gems.
    - Gems provide bonuses or effects when attached.
  - How to test: Create cards with sockets and attach gems to verify effects.

### src/cardSystem.js
- [ ] Implement AoE reveal mechanics.
  - Acceptance Criteria:
    - AoE effects reveal additional enemies based on damage dealt.
  - How to test: Use AoE cards and check if additional enemies are revealed.

## Test Plan
1. Start a new game and proceed to a new floor.
   - Expected: At least one front enemy and one back enemy should be revealed.
2. Clear the front row of enemies.
   - Expected: One enemy from the back row should be revealed.
3. Use melee and ranged attacks on enemies.
   - Expected: Melee should only hit front row, ranged should apply damage penalty.
4. Test socket and gem mechanics by attaching gems to cards.
   - Expected: Cards should reflect the effects of attached gems.
5. Use AoE cards and verify if additional enemies are revealed.
   - Expected: Additional enemies should be revealed based on AoE damage.

## Risks & Rollbacks
- **Risk:** Potential bugs in enemy reveal logic may disrupt gameplay.
  - **Rollback:** Revert to previous stable version of `cardSystem.js` and `gameScene.js`.
  
- **Risk:** Socket and gem mechanics may complicate card interactions.
  - **Rollback:** Disable socket features and revert to basic card functionality if issues arise.
  
- **Risk:** AoE mechanics may lead to performance issues with many enemies.
  - **Rollback:** Limit AoE effects to a smaller number of enemies or revert to single-target mechanics.
```
