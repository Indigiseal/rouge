# Lore — narrative

Макро-лор хранится **в git** в `docs/narrative/`.  
Obsidian редактирует ту же папку через symlink в vault.

## Paths

| What | Path |
|---|---|
| In repo (source of truth, tracked) | `docs/narrative/` |
| MOC | `docs/narrative/Narrative.md` |
| Obsidian vault entry | `~/Documents/Obsidian Vault/Narrative` → symlink to repo |

## Layout

```text
docs/narrative/
  Narrative.md              # map of content
  Lore/                     # Second Moon, Waystar, Calendar, City, ...
  Months/                   # PRIMARY breakdown
  Enemies/                  # one page per enemy
  Bosses/                   # one page per month boss
    Months Index.md
    _Shared/                # chains, any-month notes
    01 Thornwake/
      Thornwake.md          # features, event list, gaps
      Events/               # brief event cards
    ...
  Concepts/                 # Day/Floor, Run Structure, Enemy Power, …
  Meta/                     # Glossary, open questions
```

## Obsidian

Vault root remains `~/Documents/Obsidian Vault/`.  
`Narrative` inside it is a symlink:

```bash
ln -sfn "../../Projects/dungeon_rogue/rouge/docs/narrative" \
  "$HOME/Documents/Obsidian Vault/Narrative"
```

Edit notes in Obsidian under **Narrative/** — files land in the repo.

## Boundaries

| Layer | Where | Contents |
|---|---|---|
| Macro lore / setting | `docs/narrative/` | Second Moon, Waystar, months, events-by-month |
| In-game event copy | `docs/event-stories.md` + `src/content/events/` | Full vignette text / code |
| Mechanics / balance | `docs/MECHANICS.md`, `docs/BALANCE.md` | Not lore |

**Do not** duplicate long canon outside `docs/narrative/`. Point here instead.
