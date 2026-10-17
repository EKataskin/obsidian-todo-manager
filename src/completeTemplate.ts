// Complete templates: the status, a date and moving in one step. No Obsidian imports, unit-testable.

import { addDate, removeFirstDate } from "./dateTemplate";
import { moveCompletedTasks } from "./mover";
import { setTaskStatus } from "./taskChars";
import { splitLines } from "./taskParser";
import { CompleteTemplate, MoveOptions } from "./types";

/**
 * The text with the template applied to the task lines: the status char, then
 * the date, then, with `move`, the blocks of these lines go to the done block.
 */
export function applyCompleteTemplate(text: string, lines: number[], template: CompleteTemplate, opts: MoveOptions): string {
	const { lines: all, eol } = splitLines(text);
	for (const i of lines) {
		let line = setTaskStatus(all[i], template.char) ?? all[i];
		if (template.dateTemplate) line = addDate(line, template.dateTemplate, opts.today, template.datePosition) ?? line;
		all[i] = line;
	}
	const changed = all.join(eol);
	if (!template.move) return changed;
	// The template puts its own date, and only the changed tasks move.
	return moveCompletedTasks(changed, { ...opts, appendDate: false, returnUnchecked: false, moveLines: new Set(lines) }).text;
}

/**
 * The text with the completion of the task lines undone: the open status, no
 * date of the first of `dateTemplates` that matches, and the blocks of these
 * lines back from the done block.
 */
export function undoCompletion(text: string, lines: number[], dateTemplates: string[], opts: MoveOptions): string {
	const { lines: all, eol } = splitLines(text);
	for (const i of lines) all[i] = removeFirstDate(setTaskStatus(all[i], " ") ?? all[i], dateTemplates);
	// Nothing moves to the done block, only the blocks of these lines return.
	const back = { ...opts, returnUnchecked: true, moveLines: new Set<number>(), returnLines: new Set(lines) };
	return moveCompletedTasks(all.join(eol), back).text;
}
