/** A task checkbox with `char` as its status, drawn by the theme's styles, and with `showChar` the char itself. */
export function createStatusIcon(parent: Node, char: string, showChar = true): HTMLElement {
	const item = parent.createSpan("todo-manager-status-item");
	const box = item.createEl("input", {
		type: "checkbox",
		cls: "task-list-item-checkbox",
		attr: { "data-task": char, tabindex: "-1" },
	});
	box.checked = char !== " ";
	if (showChar) item.createSpan({ text: char === " " ? "␣" : char });
	return item;
}

/** The open status, then each of `chars` once. */
export function statusChars(chars: string): string[] {
	return [...new Set(" " + chars.replace(/\s/g, ""))];
}
