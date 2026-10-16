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
- *Move completed tasks* moves every fully completed top-level task of each
  list into that list's callout. It runs from the command palette (can be
  bound to a hotkey), the editor's right-click menu, or the file menu (the
  note's *More options* menu or its tab). The command and
  the file menu work in Reading view too:

  ```markdown
  ## Home
  - [ ] Hang the shelf

  > [!done]- Done
  > - [x] Buy a lamp
  ```

- Newly moved tasks go to the **top** of the callout. If the list has no
  callout yet, one is created after the list, separated by a blank line.
- A task is **closed** when the character in its brackets is listed in the
  *Closed task characters* setting (`x`, `X` and `-` by default, so canceled
  `- [-]` tasks move too). Any other character, e.g. `- [ ]` or `- [/]`,
  means an **open** task.
- Tasks may use any list marker: `-`, `*`, `+`, `1.` or `1)`. Numbers of
  ordered tasks are kept as they are, the list is not renumbered.
- A task moves only when it **and all of its sub-tasks** are closed. A
  closed sub-task under an open parent stays in place, and an open sub-task
  keeps its parent in the list.
- **Moving back:** reopen a task inside the callout (e.g. uncheck it) and run
  the same command. Every block with an open task returns to the end of its
  list, and the completion date is removed from its open lines. A callout that becomes empty is removed. Unchecking
  alone changes nothing.
- The callout is found by its type (`[!done]` by default), so changing the
  header text later does not lose existing blocks.

- A completion date is recognized when it matches the current date template
  or one used before: when the template changes, the old one is remembered
  as the settings window closes. Such dates are not added twice and are
  removed on moving back.

## Status menu

- *Task status* in the editor's right-click menu sets the character in the
  brackets of the task in the cursor's line, or of every task in the
  selection, also inside a callout. It is shown only when there is a task
  to change.
- The submenu offers the open status (`- [ ]`) first, then the characters
  of the *Status characters* setting, each drawn with the theme's checkbox
  style. The current status is marked.
- *From theme* next to the setting fills it with the closed task
  characters, then every character the theme and CSS snippets draw as a
  checked checkbox. The field can then be edited.

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Auto mode | Move completed tasks automatically after checking (never moves them back) | off |
| Done block header | First line of the callout, must look like `> [!type]...` | `> [!done]- Done` |
| Closed task characters | Characters in the brackets that mark a task as closed; any other character means open | `xX-` |
| Append completion date | Add the completion date to moved, closed task lines | on |
| Date position | At the start (after the checkbox) or at the end of the line | end |
| Date template | Text of the date, `{date}` becomes `YYYY-MM-DD` | `<small>[{date}]</small>` |
| Excluded folders/files | Vault paths (one per line) where auto mode stays inactive | empty |
| Status characters | Characters offered in the *Task status* menu after the open status | `xX-><!/?*nliISpcb"udwkf` (AnuPpuccin) |

## Styling the completion date

The plugin ships no styles for the date. With the default template
(`<small>[{date}]</small>`) the date is already smaller, but Obsidian strikes
it through together with the rest of a checked task. To change that, save a
CSS snippet, e.g. `.obsidian/snippets/task-date.css`, and enable it under
*Settings → Appearance → CSS snippets*:

```css
/* Completion date in task lines: no strike-through, muted color */
.task-list-item small,
.HyperMD-task-line small {
	display: inline-block;
	margin: 0 0.5em;
	color: var(--text-muted);
}
```

- The first selector covers Reading view, the second covers Live Preview.
- It applies to task lines with any status character, so it does not depend
  on which statuses your theme strikes through. On a line that is not struck
  through, `display: inline-block` changes nothing visible.
- `display: inline-block` removes the strike-through: a line decoration does
  not carry over to inline-block elements, and `text-decoration: none` alone
  cannot undo it.
- `margin` adds a gap on both sides, because CSS cannot tell whether the date
  stands at the start or at the end of the line. The unneeded side lands next
  to the checkbox or after the end of the line, where it is barely visible.
- Drop the `color` line if the default dimming of checked tasks is enough.
- With another template, change `small` to whatever element the template
  uses, e.g. `<span class="task-date">` and `.task-date`.

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

Copy `main.js`, `manifest.json` and `styles.css` into
`<Vault>/.obsidian/plugins/todo-manager/`, then enable the plugin under
*Settings → Community plugins*.

## Project structure

| File | Purpose |
|------|---------|
| `main.ts` | Plugin class: command, context menus, auto mode |
| `src/taskParser.ts` | Markdown parsing: sections, task blocks, callouts |
| `src/mover.ts` | Pure move logic (`moveCompletedTasks`) |
| `src/settings.ts` | Settings UI |
| `src/taskChars.ts` | Status chars: reading them from CSS, changing them in a line |
| `src/statusIcon.ts` | Checkbox icon of a status, for the menu and the settings |
| `src/exclusions.ts` | Path-exclusion matching for auto mode |
| `src/i18n.ts` | UI strings (English / German / Russian) |
| `src/types.ts` | Shared types and defaults |
| `src/*.test.ts` | Unit tests |

`taskParser.ts`, `mover.ts`, `taskChars.ts` and `exclusions.ts` have no Obsidian dependencies,
so they are unit-testable without a running Obsidian instance.

## License

[MIT](LICENSE)
