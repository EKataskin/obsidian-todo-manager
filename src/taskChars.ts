// Task status chars styled by the theme. No Obsidian imports, unit-testable.

/** `[data-task=…]` with a double-quoted, single-quoted or bare value. */
const DATA_TASK_RE = /\[data-task=(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|([^\]\s"']+))\]/g;

/**
 * `first` (e.g. the closed chars), then the status chars for which the CSS
 * draws a checked checkbox (`[data-task=…]` and `:checked` in one selector),
 * in order of appearance. Other `[data-task]` styles, e.g. a whole line
 * restyled as a speech bubble, are skipped. Spaces are left out: the menu
 * always offers the open status.
 */
export function taskCharsFromCss(css: string, first: string): string {
	const chars = new Set(Array.from(first.replace(/\s/g, "")));
	// Text before "{" is a selector list.
	for (const [, list] of css.matchAll(/([^{}]+)\{/g)) {
		for (const selector of list.split(",")) {
			if (!selector.includes(":checked")) continue;
			for (const m of selector.matchAll(DATA_TASK_RE)) {
				const value = (m[1] ?? m[2] ?? m[3]).replace(/\\(.)/g, "$1");
				if (Array.from(value).length === 1 && value.trim() !== "") chars.add(value);
			}
		}
	}
	return [...chars].join("");
}
