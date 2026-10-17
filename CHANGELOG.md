# Changelog

## Unreleased

To-Do Manager is a fork of
[To-Do to Done Mover](https://github.com/DonnervS/obsidian-todo-done-mover)
1.0.4. This section lists the changes since the fork.

### Added

- Russian interface.
- Every list, i.e. the lines under one heading, gets its own collapsible
  callout for completed tasks at its end, instead of one `### Done` heading
  for the whole note. Newly moved tasks go to the top of the callout.
- Moving back: a task reopened inside the callout returns to the end of its
  list on the next *Move completed tasks*, and its completion date is
  removed. A callout that becomes empty is removed.
- *Done block header* setting: the first line of the callout. Existing
  callouts are found by their type, so changing the header text keeps them.
- *Closed task characters* setting: the status characters that mark a task
  as closed, `xX-` by default, so canceled `- [-]` tasks move too.
- Task markers `*`, `+`, `1.` and `1)` besides `-`.
- *Move completed tasks* works in Reading view and from the note's *More
  options* menu and its tab.
- *Date position* setting: the date goes after the checkbox or at the end of
  the line.
- *Date templates* setting, one template per line. The date format goes in
  braces and is made of `YYYY`, `MM`, `DD`, `M` and `D`, e.g. `[{MM.YYYY}]`.
  The first template is used for moved tasks. A date of any template is not
  added twice and is removed on moving back.
- *Completion date* submenu in the editor menu: puts today's date by any of
  the date templates into the selected tasks, rendered as in the note.
  *Remove date* removes the dates of every template.
- *Task status* submenu in the editor menu: sets the status character of the
  selected tasks. Each status is drawn with the theme's checkbox style, the
  submenu is laid out in columns, and the current status is highlighted.
- *Status characters* setting for that submenu. *From theme* fills it with
  the characters that the theme and CSS snippets style.
- *Complete by template* submenu in the editor menu: sets the status
  character, adds a date and moves the task to the done block in one step.
  *Done* always comes first and is made of the general settings; your own
  templates are set up under *Complete templates* in the settings.
- A settings field whose input is not saved is highlighted.

### Changed

- Renamed to To-Do Manager, version 0.1.0.
- Moving replaces only the changed part of the note, so the cursor, scroll
  position and folds elsewhere stay put.
- The default completion date is `<small>[{YYYY-MM-DD}]</small>` instead of
  `✅ YYYY-MM-DD`.
- Requires Obsidian 1.1.0.

### Removed

- *Move selection to Done* command and menu item.

### Fixed

- Auto mode works on the note being edited, even when another note becomes
  active before it runs.
- Headings, tasks and callouts inside code fences are ignored.
- A completed task nested under a plain bullet stays in place.
- A list item that starts with a one-letter link, e.g. `- [a](url)`, is no
  longer read as a task.
