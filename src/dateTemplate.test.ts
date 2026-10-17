import { describe, expect, it } from "vitest";
import { dateRegexSource, formatDate, isDateTemplate, removeDates, setDateStamp } from "./dateTemplate";

const DAY = new Date(2026, 9, 7);

describe("formatDate", () => {
	it("fills the format in braces", () => {
		expect(formatDate("<small>[{YYYY-MM-DD}]</small>", DAY)).toBe("<small>[2026-10-07]</small>");
		expect(formatDate("[{MM.YYYY}]", DAY)).toBe("[10.2026]");
		expect(formatDate("{D.M.YYYY}", DAY)).toBe("7.10.2026");
	});

	it('reads "{date}" as YYYY-MM-DD', () => {
		expect(formatDate("✅ {date}", DAY)).toBe("✅ 2026-10-07");
	});

	it("leaves letters outside braces and braces without a format as they are", () => {
		expect(formatDate("Done {DD} {note}", DAY)).toBe("Done 07 {note}");
	});
});

describe("isDateTemplate", () => {
	it("needs a format in braces", () => {
		expect(isDateTemplate("[{MM.YYYY}]")).toBe(true);
		expect(isDateTemplate("✅ {date}")).toBe(true);
		expect(isDateTemplate("[MM.YYYY]")).toBe(false);
		expect(isDateTemplate("{note}")).toBe(false);
	});
});

describe("dateRegexSource", () => {
	it("matches a date written with the template", () => {
		const re = new RegExp(dateRegexSource("[{M.YYYY}]"));
		expect(re.test("a [6.2025]")).toBe(true);
		expect(re.test("a [06.2025]")).toBe(true);
		expect(re.test("a [6-2025]")).toBe(false);
		expect(new RegExp(dateRegexSource("({date})")).test("(2026-10-07)")).toBe(true);
	});
});

describe("removeDates", () => {
	const templates = ["[{MM.YYYY}]", "✅ {date}"];

	it("removes dates of every template with the space before them", () => {
		expect(removeDates("- [+] Тачки [06.2025]", templates)).toBe("- [+] Тачки");
		expect(removeDates("- [x] [06.2025] a ✅ 2025-06-01", templates)).toBe("- [x] a");
		expect(removeDates("> - [x] [06.2025]", templates)).toBe("> - [x]");
	});

	it("leaves a line without a date as it is", () => {
		expect(removeDates("- [x] a [6-2025]", templates)).toBe("- [x] a [6-2025]");
		expect(removeDates("- [x] a b", [])).toBe("- [x] a b");
	});

	it("returns null for a line that is not a task", () => {
		expect(removeDates("a [06.2025]", templates)).toBeNull();
	});
});

describe("setDateStamp", () => {
	it("adds the date at the end or after the checkbox", () => {
		expect(setDateStamp("- [+] Тачки ", "[{MM.YYYY}]", DAY, "end")).toBe("- [+] Тачки [10.2026]");
		expect(setDateStamp("- [x] a", "[{MM.YYYY}]", DAY, "start")).toBe("- [x] [10.2026] a");
		expect(setDateStamp("- [x]", "[{MM.YYYY}]", DAY, "start")).toBe("- [x] [10.2026]");
	});

	it("works inside a callout", () => {
		expect(setDateStamp("> 1. [ ] a", "[{MM.YYYY}]", DAY, "start")).toBe("> 1. [ ] [10.2026] a");
	});

	it("replaces a date of the same template where it stands", () => {
		expect(setDateStamp("- [+] [06.2025] Тачки", "[{MM.YYYY}]", DAY, "end")).toBe("- [+] [10.2026] Тачки");
	});

	it("keeps a date of another template", () => {
		expect(setDateStamp("- [x] a ✅ 2025-06-01", "[{MM.YYYY}]", DAY, "end")).toBe("- [x] a ✅ 2025-06-01 [10.2026]");
	});

	it("takes the template literally", () => {
		expect(setDateStamp("- [x] a", "$& {DD}", DAY, "end")).toBe("- [x] a $& 07");
		expect(setDateStamp("- [x] a $& 01", "$& {DD}", DAY, "end")).toBe("- [x] a $& 07");
	});

	it("returns null for a line that is not a task", () => {
		expect(setDateStamp("text", "[{MM.YYYY}]", DAY, "end")).toBeNull();
	});
});
