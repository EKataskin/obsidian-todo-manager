import { describe, expect, it } from "vitest";
import { applyCompleteTemplate } from "./completeTemplate";
import { CompleteTemplate, MoveOptions } from "./types";

const OPTS: MoveOptions = {
	calloutHeader: "> [!done]- Done",
	appendDate: true,
	datePosition: "end",
	dateTemplate: "✅ {YYYY-MM-DD}",
	otherDateTemplates: [],
	closedChars: "xX-",
	returnUnchecked: true,
	today: new Date(2026, 9, 17),
};

const TEMPLATE: CompleteTemplate = { name: "Done", char: "x", dateTemplate: "[{MM.YYYY}]", datePosition: "end", move: true };

function apply(lines: string[], changed: number[], extra: Partial<CompleteTemplate> = {}) {
	return applyCompleteTemplate(lines.join("\n"), changed, { ...TEMPLATE, ...extra }, OPTS).split("\n");
}

describe("applyCompleteTemplate", () => {
	it("sets the status, adds the date and moves only the changed task", () => {
		expect(apply(["## A", "- [x] other", "- [ ] mine", "", "> [!done]- Done", "> - [ ] back"], [2])).toEqual([
			"## A", "- [x] other", "", "> [!done]- Done", "> - [x] mine [10.2026]", "> - [ ] back",
		]);
	});

	it("adds no date with an empty date template and moves an open status too", () => {
		expect(apply(["- [ ] a"], [0], { char: "/", dateTemplate: "" })).toEqual(["> [!done]- Done", "> - [/] a"]);
	});

	it("does not move without move", () => {
		expect(apply(["- [ ] a [09.2026]"], [0], { move: false, datePosition: "start" })).toEqual(["- [x] [10.2026] a [09.2026]"]);
	});

	it("changes tasks inside the done block in place", () => {
		expect(apply(["> [!done]- Done", "> - [x] a"], [1], { char: "-" })).toEqual(["> [!done]- Done", "> - [-] a [10.2026]"]);
	});
});
