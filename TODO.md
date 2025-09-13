```markdown
# TODO.md

## High-impact goals
- Implement melee front/back gating for combat mechanics.
- Ensure proper enemy reveal logic for front and back rows.
- Integrate socket and gem mechanics into the card system.
- Develop AoE reveal functionality for closed cards.
- Test and refine ranged damage penalties.

## Tasks

### src/cardSystem.js
- [ ] **Implement front/back gating**  
  - Acceptance: Melee can only hit front row; ranged can hit back with penalty.  
  - Test: Verify melee and ranged interactions with enemies.

- [ ] **Add AoE reveal logic**  
  - Acceptance: AoE attacks reveal closed cards that would be damaged.  
  - Test: Execute AoE attacks and check for proper reveals.

### gameScene.js
- [ ] **Update combat logic**  
  - Acceptance: Ensure combat interactions respect front/back rules.  
  - Test: Engage in combat with various enemy setups.

### gameState.js
- [ ] **Track player actions**  
  - Acceptance: Actions left should reflect combat interactions accurately.  
  - Test: Monitor action count during combat.

### cardDataGenerator.js
- [ ] **Integrate socket and gem mechanics**  
  - Acceptance: Sockets and gems should be functional and interact with cards.  
  - Test: Create cards with sockets and apply gem effects.

## Test plan
1. **Verify melee/ranged interactions**  
   - Expected: Melee only hits front row; ranged hits back with 0.8x damage.
  
2. **Test AoE reveals**  
   - Expected: Closed cards are revealed if they would take damage.

3. **Check action tracking**  
   - Expected: Actions left decrease correctly after combat.

4. **Validate socket/gem functionality**  
   - Expected: Gems enhance card abilities as intended.

## Risks & rollbacks
- **Risk:** Incorrect implementation of front/back gating could lead to gameplay imbalance.  
  - **Rollback:** Revert to previous combat logic and re-evaluate gating rules.

- **Risk:** AoE mechanics may introduce bugs in enemy reveal logic.  
  - **Rollback:** Disable AoE functionality until confirmed stable.

- **Risk:** Socket and gem integration may complicate card mechanics.  
  - **Rollback:** Temporarily remove socket/gem features to stabilize gameplay.
```