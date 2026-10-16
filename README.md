# To-Do Manager

An [Obsidian](https://obsidian.md) plugin that moves completed checkbox tasks,
including their indented sub-tasks, into a collapsible callout at the end of
their own list, and back.

A fork of [To-Do to Done Mover](https://github.com/DonnervS/obsidian-todo-done-mover).
The original moves all tasks of a note into one `### Done` heading; this fork
gives every list its own block.

The plugin interface follows Obsidian's UI language: English by default,
German or Russian when Obsidian is set to one of them.

## How it works

- A **list** is everything under one heading, up to the next heading of any
  level. Lines before the first heading form a list too; frontmatter is
  skipped.
- *Move completed tasks* (right-click menu or command, can be bound to a
  hotkey) moves every fully completed top-level task of each list into that
  list's callout:

  ```markdown
  ## Home
  - [ ] Hang the shelf

  > [!done]- Done
  > - [x] Buy a lamp
  ```

- Newly moved tasks go to the **top** of the callout. If the list has no
  callout yet, one is created after the list, separated by a blank line.
- A task moves only when it **and all of its sub-tasks** are checked. A
  checked sub-task under an unchecked parent stays in place.
- **Moving back:** uncheck a task inside the callout and run the same command.
  Every block with an unchecked line returns to the end of its list, and the
  completion date is removed from its unchecked lines. A callout that becomes
  empty is removed. Unchecking alone changes nothing.
- The callout is found by its type (`[!done]` by default), so changing the
  header text later does not lose existing blocks.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Auto mode | Move completed tasks automatically after checking (never moves them back) | off |
| Done block header | First line of the callout, must look like `> [!type]...` | `> [!done]- Done` |
| Append completion date | Append `✅ YYYY-MM-DD` to moved, checked lines | on |
| Excluded folders/files | Vault paths (one per line) where auto mode stays inactive | empty |

## Disclosures

- The plugin works entirely offline and makes **no network requests**.
- It collects **no telemetry** and stores no data outside your vault.
- It only modifies the note in which a move action runs (manually or via
  auto mode) and never touches other files.
- Settings are stored in the plugin's `data.json` inside your vault's
  configuration folder.

## Build from source

```bash
npm install
npm test          # unit tests (Vitest)
npm run build     # produces main.js
```

## Install into a vault

Copy `main.js` and `manifest.json` into
`<Vault>/.obsidian/plugins/todo-manager/`, then enable the plugin under
*Settings → Community plugins*.

## Project structure

| File | Purpose |
|------|---------|
| `main.ts` | Plugin class: command, context menu, auto mode |
| `src/taskParser.ts` | Markdown parsing: sections, task blocks, callouts |
| `src/mover.ts` | Pure move logic (`moveCompletedTasks`) |
| `src/settings.ts` | Settings UI |
| `src/exclusions.ts` | Path-exclusion matching for auto mode |
| `src/i18n.ts` | UI strings (English / German / Russian) |
| `src/types.ts` | Shared types and defaults |
| `src/*.test.ts` | Unit tests |

`taskParser.ts`, `mover.ts` and `exclusions.ts` have no Obsidian dependencies,
so they are unit-testable without a running Obsidian instance.

## License

[MIT](LICENSE)
