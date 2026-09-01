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
  Locations/                # PRIMARY
    Locations Index.md      # nine roads, three per act, true path marked
    Thornwake/              # one folder per road
      Thornwake.md
      Events/               # events owned by this road
    ...
    _Shared/                # not owned by any road
      Any-Location Events.md
      Event Sequences.md
      Music Box Chain.md
      Events/
    _Shelved/               # five retired month faces, kept for salvage
  Enemies/                  # one page per enemy
  Bosses/                   # one page per location boss
  Concepts/                 # Day/Floor, Run Structure, True Path, Enemy Power, …
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
| Macro lore / setting | `docs/narrative/` | Second Moon, Waystar, nine locations, events-by-location |
| In-game event copy | `docs/event-stories.md` + `src/content/events/` | Full vignette text / code |
| Mechanics / balance | `docs/MECHANICS.md`, `docs/BALANCE.md` | Not lore |

**Do not** duplicate long canon outside `docs/narrative/`. Point here instead.
