```markdown
# TODO.md

## High-impact goals
- Implement melee front/back gating and initial reveal for enemies.
- Develop socket system and gem effects.
- Enable AoE reveals for closed cards based on damage.

## Tasks

### src/cardSystem.js
- [ ] Implement logic to restrict melee attacks to front row only.
  - **Acceptance criteria:**
    - Melee can only hit enemies in the front row.
    - Ranged attacks can hit back row with a damage penalty.
  - **How to test:** Verify melee and ranged interactions in combat scenarios.

- [ ] Update enemy reveal logic to ensure at least one front and one back enemy is revealed on new floors.
  - **Acceptance criteria:**
    - On entering a new floor, at least one front and one back enemy should be visible.
  - **How to test:** Test transitions to new floors and check revealed enemies.

### src/inventorySystem.js
- [ ] Create socket system for items.
  - **Acceptance criteria:**
    - Items can be equipped in sockets.
    - Sockets can hold different types of items (weapons, armor, etc.).
  - **How to test:** Equip items in sockets and verify functionality.

### src/cardDataGenerator.js
- [ ] Define gem effects and their interactions with cards.
  - **Acceptance criteria:**
    - Gems provide specific bonuses when equipped on cards.
  - **How to test:** Equip gems and check if bonuses apply correctly.

### src/gameScene.js
- [ ] Implement AoE reveal logic for closed cards.
  - **Acceptance criteria:**
    - Cards that deal AoE damage reveal closed cards in their range.
  - **How to test:** Use AoE cards in combat and verify revealed cards.

## Test plan
- Test melee and ranged interactions to ensure correct damage application.
- Verify enemy reveal logic on new floors.
- Check socket functionality by equipping items and observing effects.
- Test gem effects on cards and ensure they apply correctly.
- Use AoE cards in combat to confirm proper reveal of closed cards.

## Risks & rollbacks
- Potential bugs in combat mechanics may require reverting to previous versions of the card and enemy systems.
- Socket and gem systems may introduce complexity; rollback to simpler inventory management if necessary.
```