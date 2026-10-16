import { describe, expect, it } from "vitest";
import { moveCompletedTasks } from "./mover";
import { MoveOptions } from "./types";

const OPTS: MoveOptions = {
	calloutHeader: "> [!done]- Выполнено",
	appendDate: false,
	datePosition: "end",
	dateTemplate: "✅ {date}",
	closedChars: "xX-",
	returnUnchecked: false,
	today: "2026-10-17",
};

function run(lines: string[], extra: Partial<MoveOptions> = {}) {
	return moveCompletedTasks(lines.join("\n"), { ...OPTS, ...extra });
}

describe("moveCompletedTasks", () => {
	it("gives each section its own callout and keeps a done sub-task under an open parent", () => {
		const r = run(["## A", "- [x] a1", "- [ ] a2", "", "## B", "- [ ] b1", "\t- [x] b1.1", "- [x] b2"]);
		expect(r.movedCount).toBe(2);
		expect(r.text).toBe(
			[
				"## A", "- [ ] a2", "", "> [!done]- Выполнено", "> - [x] a1", "",
				"## B", "- [ ] b1", "\t- [x] b1.1", "", "> [!done]- Выполнено", "> - [x] b2",
			].join("\n")
		);
	});

	it("puts new tasks at the top of an existing callout, in document order", () => {
		const r = run(["## A", "- [x] n1", "- [x] n2", "", "> [!done]- Выполнено", "> - [x] old"]);
		expect(r.text).toBe(
			["## A", "", "> [!done]- Выполнено", "> - [x] n1", "> - [x] n2", "> - [x] old"].join("\n")
		);
	});

	it("keeps sub-task indentation inside the callout", () => {
		const r = run(["## A", "- [x] p", "\t- [x] c"]);
		expect(r.text).toBe(["## A", "", "> [!done]- Выполнено", "> - [x] p", "> \t- [x] c"].join("\n"));
	});

	it("appends the completion date when enabled", () => {
		const r = run(["## A", "- [x] a"], { appendDate: true });
		expect(r.text).toContain("> - [x] a ✅ 2026-10-17");
	});

	it("puts the date from the template at the start of the task text", () => {
		const r = run(["## A", "- [x] a"], { appendDate: true, datePosition: "start", dateTemplate: "[done:: {date}]" });
		expect(r.text).toContain("> - [x] [done:: 2026-10-17] a");
	});

	it("puts the date from the template at the end of the line", () => {
		const r = run(["## A", "- [x] a"], { appendDate: true, dateTemplate: "({date})" });
		expect(r.text).toContain("> - [x] a (2026-10-17)");
	});

	it("does not add a second date when the template date is already there", () => {
		const r = run(["## A", "- [x] [done:: 2026-10-01] a"], { appendDate: true, datePosition: "start", dateTemplate: "[done:: {date}]" });
		expect(r.text).toContain("> - [x] [done:: 2026-10-01] a");
		expect(r.text).not.toContain("2026-10-17");
	});

	it("finds an existing callout by type and keeps its header", () => {
		const r = run(["## A", "- [x] a", "", "> [!done]- Done"]);
		expect(r.text).toBe(["## A", "", "> [!done]- Done", "> - [x] a"].join("\n"));
	});

	it("ignores unchecked tasks in the callout when returnUnchecked is off", () => {
		const text = ["## A", "- [ ] a", "", "> [!done]- Выполнено", "> - [ ] back"];
		expect(run(text)).toEqual({ text: text.join("\n"), movedCount: 0, returnedCount: 0 });
	});

	it("is idempotent", () => {
		const first = run(["## A", "- [x] a", "- [ ] b", "## B", "- [x] c"]);
		const second = moveCompletedTasks(first.text, OPTS);
		expect(second).toEqual({ text: first.text, movedCount: 0, returnedCount: 0 });
	});

	it("extends a callout in place when text follows it", () => {
		const r = run(["## A", "- [ ] keep", "- [x] a", "", "> [!done]- X", "> - [x] old", "", "Some text"]);
		expect(r.text).toBe(
			["## A", "- [ ] keep", "", "> [!done]- X", "> - [x] a", "> - [x] old", "", "Some text"].join("\n")
		);
	});

	it("separates a new callout from the next heading", () => {
		const r = run(["## A", "- [x] a", "## B"]);
		expect(r.text).toBe(["## A", "", "> [!done]- Выполнено", "> - [x] a", "", "## B"].join("\n"));
	});

	it("keeps CRLF line endings", () => {
		const r = moveCompletedTasks("## A\r\n- [x] a\r\n", OPTS);
		expect(r.text).toBe("## A\r\n\r\n> [!done]- Выполнено\r\n> - [x] a\r\n");
	});

	it("ignores headings, tasks and callouts inside code fences", () => {
		const r = run(["## Setup", "- [x] install", "- [ ] configure", "```bash", "# install deps", "- [x] sample", "> [!done]- Done", "```"]);
		expect(r.movedCount).toBe(1);
		expect(r.text).toBe(
			[
				"## Setup", "- [ ] configure", "```bash", "# install deps", "- [x] sample", "> [!done]- Done", "```",
				"", "> [!done]- Выполнено", "> - [x] install",
			].join("\n")
		);
	});

	it("moves a canceled task", () => {
		const r = run(["## A", "- [-] c", "- [ ] o"]);
		expect(r.text).toBe(["## A", "- [ ] o", "", "> [!done]- Выполнено", "> - [-] c"].join("\n"));
	});

	it("keeps a done parent with an in-progress sub-task in the list", () => {
		const text = ["## A", "- [x] p", "\t- [/] c"];
		expect(run(text)).toEqual({ text: text.join("\n"), movedCount: 0, returnedCount: 0 });
	});

	it("dates every closed status", () => {
		const r = run(["## A", "- [-] c"], { appendDate: true });
		expect(r.text).toContain("> - [-] c ✅ 2026-10-17");
	});

	it("treats a status missing from closedChars as open", () => {
		const text = ["## A", "- [-] c"];
		expect(run(text, { closedChars: "xX" })).toEqual({ text: text.join("\n"), movedCount: 0, returnedCount: 0 });
	});

	it("moves a parent whose sub-items use an extra closed status", () => {
		const r = run(["## A", "- [x] p", "\t- [i] note"], { closedChars: "xX-i" });
		expect(r.movedCount).toBe(1);
	});

	it("keeps a done task under a plain bullet in place", () => {
		const text = ["## A", "- Groceries", "\t- [x] milk", "\t- [ ] bread"];
		expect(run(text)).toEqual({ text: text.join("\n"), movedCount: 0, returnedCount: 0 });
	});
});

describe("moveCompletedTasks with returnUnchecked", () => {
	const back = { returnUnchecked: true };

	it("returns an unchecked task to the end of the list", () => {
		const r = run(["## A", "- [ ] a", "", "> [!done]- X", "> - [ ] back", "> - [x] stay"], back);
		expect(r.returnedCount).toBe(1);
		expect(r.text).toBe(["## A", "- [ ] a", "- [ ] back", "", "> [!done]- X", "> - [x] stay"].join("\n"));
	});

	it("returns the whole block when only a sub-task was unchecked", () => {
		const r = run(["## A", "", "> [!done]- X", "> - [x] p", "> \t- [ ] c"], back);
		expect(r.text).toBe(["## A", "- [x] p", "\t- [ ] c"].join("\n"));
	});

	it("strips the date only from unchecked lines", () => {
		const r = run(["## A", "", "> [!done]- X", "> - [ ] p ✅ 2026-10-01", "> \t- [x] c ✅ 2026-10-01"], back);
		expect(r.text).toBe(["## A", "- [ ] p", "\t- [x] c ✅ 2026-10-01"].join("\n"));
	});

	it("strips a template date from the start of an unchecked line", () => {
		const r = run(["## A", "", "> [!done]- X", "> - [ ] [done:: 2026-10-01] p"], { ...back, dateTemplate: "[done:: {date}]" });
		expect(r.text).toBe(["## A", "- [ ] p"].join("\n"));
	});

	it("returns an in-progress task and strips its date", () => {
		const r = run(["## A", "", "> [!done]- X", "> - [/] p ✅ 2026-10-01"], back);
		expect(r.text).toBe(["## A", "- [/] p"].join("\n"));
	});

	it("keeps a blank line between a returned task and the callout", () => {
		const r = run(["## A", "> [!done]- X", "> - [ ] back", "> - [x] stay"], back);
		expect(r.text).toBe(["## A", "- [ ] back", "", "> [!done]- X", "> - [x] stay"].join("\n"));
	});

	it("leaves a plain bullet in the callout alone", () => {
		const text = ["## A", "", "> [!done]- X", "> - note", "> - [x] d"];
		expect(run(text, back)).toEqual({ text: text.join("\n"), movedCount: 0, returnedCount: 0 });
	});

	it("moves and returns in one run", () => {
		const r = run(["## A", "- [x] new", "", "> [!done]- X", "> - [ ] back"], back);
		expect(r).toMatchObject({ movedCount: 1, returnedCount: 1 });
		expect(r.text).toBe(["## A", "- [ ] back", "", "> [!done]- X", "> - [x] new"].join("\n"));
	});
});
