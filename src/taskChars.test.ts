import { describe, expect, it } from "vitest";
import { taskCharsFromCss } from "./taskChars";

describe("taskCharsFromCss", () => {
	it("starts with the given chars even without styles", () => {
		expect(taskCharsFromCss("", "xX-")).toBe("xX-");
	});

	it("does not repeat a given char found in the CSS", () => {
		expect(taskCharsFromCss('[data-task="-"]:checked {} [data-task="!"]:checked {}', "xX-")).toBe("xX-!");
	});

	it("takes only chars whose selector styles a checked checkbox", () => {
		const css =
			'.bubble [data-task="0"] {} .bubble [data-task="0"] .task-list-item-checkbox {} ' +
			'.a [data-task="1"] p, .a [data-task=p] > p > input:checked {} ' +
			"input[data-task='!']:checked:after {}";
		expect(taskCharsFromCss(css, "x")).toBe("xp!");
	});

	it("leaves out the space: the open status is always offered", () => {
		expect(taskCharsFromCss('[data-task=" "]:checked {} [data-task="!"]:checked {}', "x")).toBe("x!");
	});

	it("collects chars in order of appearance, without duplicates", () => {
		const css = 'li[data-task="!"] input:checked {} input[data-task="?"]:checked {} li[data-task="!"] input:checked {}';
		expect(taskCharsFromCss(css, "x")).toBe("x!?");
	});

	it("reads unquoted, single-quoted and escaped values", () => {
		const css = "[data-task=p]:checked {} [data-task='\"']:checked {} [data-task=\"\\\"\"]:checked {} [data-task=\"x\"]:checked {}";
		expect(taskCharsFromCss(css, "x")).toBe('xp"');
	});

	it("skips values longer than one char", () => {
		expect(taskCharsFromCss('[data-task="ab"]:checked {} [data-task=""]:checked {}', "x")).toBe("x");
	});
});
