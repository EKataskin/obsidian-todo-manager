/** A task checkbox with `char` as its status, drawn by the theme's styles, and the char itself. */
export function createStatusIcon(parent: Node, char: string): HTMLElement {
	const item = parent.createSpan("todo-manager-status-item");
	const box = item.createEl("input", {
		type: "checkbox",
		cls: "task-list-item-checkbox",
		attr: { "data-task": char, tabindex: "-1" },
	});
	box.checked = char !== " ";
	item.createSpan({ text: char === " " ? "␣" : char });
	return item;
}

/** The open status, then each of `chars` once. */
export function statusChars(chars: string): string[] {
	return [...new Set(" " + chars.replace(/\s/g, ""))];
}
