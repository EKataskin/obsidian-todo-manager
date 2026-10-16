import { describe, expect, it } from "vitest";
import {
	blockEnd,
	calloutType,
	findCallout,
	isBlockFullyDone,
	parseLines,
	quote,
	splitLines,
	splitSections,
	topLevelBlocks,
	unquote,
} from "./taskParser";

const SAMPLE = [
	"### To-DO",
	"- [x] Task 1",
	"\t- [x] Untertask1",
	"\t- [x] Untertask 2",
	"- [ ] Task 2",
	"- [ ] Task 3",
	"",
	"---",
	"",
	"### Done",
	"",
	"- [x] Erledigt 1",
].join("\n");

describe("parseLines", () => {
	it("classifies task and non-task lines", () => {
		const { lines } = splitLines(SAMPLE);
		const parsed = parseLines(lines);
		expect(parsed[0].isTask).toBe(false);
		expect(parsed[1].isTask).toBe(true);
		expect(parsed[1].checked).toBe(true);
		expect(parsed[4].isTask).toBe(true);
		expect(parsed[4].checked).toBe(false);
		expect(parsed[2].indent).toBe(1);
	});
});

describe("blockEnd", () => {
	it("includes indented sub-tasks but stops at the next top-level task", () => {
		const { lines } = splitLines(SAMPLE);
		expect(blockEnd(lines, 1)).toBe(3);
	});

	it("stops at a thematic break", () => {
		const { lines } = splitLines(SAMPLE);
		expect(blockEnd(lines, 5)).toBe(5);
	});
});

describe("topLevelBlocks", () => {
	it("returns outermost task blocks only", () => {
		const { lines } = splitLines(SAMPLE);
		const blocks = topLevelBlocks(lines, parseLines(lines));
		expect(blocks).toEqual([
			{ start: 1, end: 3 },
			{ start: 4, end: 4 },
			{ start: 5, end: 5 },
			{ start: 11, end: 11 },
		]);
	});
});

describe("isBlockFullyDone", () => {
	it("is true when the task and all sub-tasks are checked", () => {
		const { lines } = splitLines(SAMPLE);
		const parsed = parseLines(lines);
		expect(isBlockFullyDone(parsed, { start: 1, end: 3 })).toBe(true);
	});

	it("is false when a sub-task is unchecked", () => {
		const text = ["- [x] Parent", "\t- [ ] Sub"].join("\n");
		const { lines } = splitLines(text);
		const parsed = parseLines(lines);
		expect(isBlockFullyDone(parsed, { start: 0, end: 1 })).toBe(false);
	});
});

describe("splitSections", () => {
	it("splits by headings of any level and keeps the pre-heading part", () => {
		const lines = ["- [ ] top", "## A", "- [ ] a", "### B", "- [ ] b"];
		expect(splitSections(lines)).toEqual([
			{ contentStart: 0, contentEnd: 1 },
			{ contentStart: 2, contentEnd: 3 },
			{ contentStart: 4, contentEnd: 5 },
		]);
	});

	it("does not split on a thematic break", () => {
		expect(splitSections(["## A", "- [ ] a", "---", "- [ ] b"])).toEqual([
			{ contentStart: 0, contentEnd: 0 },
			{ contentStart: 1, contentEnd: 4 },
		]);
	});

	it("skips frontmatter", () => {
		const lines = ["---", "tags: [x]", "---", "- [ ] a"];
		expect(splitSections(lines)).toEqual([{ contentStart: 3, contentEnd: 4 }]);
	});
});

describe("calloutType", () => {
	it("reads the type case-insensitively", () => {
		expect(calloutType("> [!Done]- Выполнено")).toBe("done");
		expect(calloutType("> [!done]")).toBe("done");
	});

	it("returns null for a non-callout line", () => {
		expect(calloutType("Выполнено")).toBeNull();
		expect(calloutType("> quote")).toBeNull();
	});
});

describe("findCallout", () => {
	it("finds the callout of the given type and its body", () => {
		const lines = [
			"## A",
			"- [ ] a",
			"",
			"> [!note] x",
			"> n",
			"",
			"> [!done]- X",
			"> - [x] d",
			">",
			"> - [x] e",
			"text",
		];
		const [, section] = splitSections(lines);
		expect(findCallout(lines, section, "done")).toEqual({ header: 6, end: 9 });
	});

	it("returns null when the section has none", () => {
		const lines = ["## A", "- [ ] a"];
		expect(findCallout(lines, splitSections(lines)[1], "done")).toBeNull();
	});
});

describe("quote / unquote", () => {
	it("round-trips task lines and blank lines", () => {
		expect(quote("	- [x] c")).toBe("> 	- [x] c");
		expect(quote("")).toBe(">");
		expect(unquote("> 	- [x] c")).toBe("	- [x] c");
		expect(unquote(">")).toBe("");
	});
});
