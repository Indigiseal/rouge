import { getMagic } from '../cards/magic.js';

// The room supplies the rare half of the trade (a magic card) and the player
// supplies the common half (a weapon). Magic cards are scarce enough that
// gating this on the player already owning one would hide the mechanic from
// most runs — the wall exists so the merge is always reachable.
//
// The three lit cases are rendered inline by EventScene (_setupReliquaryCases)
// and each is its own drop target, so there are no per-spell buttons here.
export default {
    id: 'reliquary',
    title: 'The Reliquary',
    description: (gs, scene) => {
      const lit = scene.getReliquaryOffer().length;
      const dragLine = scene.hasEnchantableWeapon()
        ? '(Drag a weapon onto a case.)'
        : '(You have no weapon to trade.)';
      return `The corridor ends at a wall of glass cases. Most are broken and empty. ${lit} are not.\n\nBRING IRON. LEAVE CHANGED — carved beneath them, and scratched under the empty cases in worse handwriting.\n\n${dragLine}`;
    },
    choices: (gs, scene) => [
      {
        id: 'reliquary_search',
        text: 'Search the broken cases',
        // Only worth offering when there is no weapon to trade.
        condition: (state, s) => !s.hasEnchantableWeapon(),
        action: (state, s) => s.searchReliquary(),
        outcome: 'You go along the wall, feeling through the broken cases.\n\nMost hold nothing but glass. One still has something wedged in the corner.'
      },
      {
        id: 'reliquary_break',
        text: 'Break the glass',
        action: (state, s) => s.breakReliquaryGlass(),
        outcome: (state, s) => s.reliquaryBreakOutcome
      },
      {
        id: 'reliquary_leave',
        text: 'Leave',
        action: (state, s) => {
          s.ensureStoryState();
          state.storyRun.reliquarySeen = true;
        },
        outcome: (state, s) => {
          const names = s.getReliquaryOffer()
            .map(magicType => getMagic(magicType)?.name)
            .filter(Boolean);
          const tail = names.length
            ? `\n\nBehind you, ${names.join(', ')} keep turning in their cases, waiting for iron that does not come.`
            : '';
          return `You leave the wall alone.${tail}`;
        }
      }
    ]
  };
