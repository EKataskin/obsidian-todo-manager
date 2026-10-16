import { describe, expect, it } from "vitest";
import { moveCompletedTasks } from "./mover";
import { MoveOptions } from "./types";

const OPTS: MoveOptions = {
	calloutHeader: "> [!done]- Выполнено",
	appendDate: false,
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
});
