// Date templates such as "[{MM.YYYY}]". No Obsidian imports, unit-testable.

import { STATUS_RE } from "./taskChars";
import { DatePosition } from "./types";

/** A date format in braces: "{date}" or text with YYYY, MM, DD, M or D in it. */
const FORMAT_RE = /\{(date|[^{}]*[YMD][^{}]*)\}/g;
const TOKEN_RE = /YYYY|MM|DD|M|D/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** "{date}" is the format of templates written before formats were added. */
function format(m: string): string {
	return m === "date" ? "YYYY-MM-DD" : m;
}

/** The non-empty lines of the date templates setting, trimmed. */
export function templateLines(text: string): string[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0);
}

/** True when the template has a date format in braces. */
export function isDateTemplate(template: string): boolean {
	return new RegExp(FORMAT_RE.source).test(template);
}

/** The template with each date format in braces filled from `day`. */
export function formatDate(template: string, day: Date): string {
	const pad = (n: number) => String(n).padStart(2, "0");
	const values: Record<string, string> = {
		YYYY: String(day.getFullYear()),
		MM: pad(day.getMonth() + 1),
		DD: pad(day.getDate()),
		M: String(day.getMonth() + 1),
		D: String(day.getDate()),
	};
	return template.replace(FORMAT_RE, (_, f: string) => format(f).replace(TOKEN_RE, (t) => values[t]));
}

/** Regex source that matches a date written with the template. */
export function dateRegexSource(template: string): string {
	const digits: Record<string, string> = { YYYY: "\\d{4}", MM: "\\d{2}", DD: "\\d{2}", M: "\\d{1,2}", D: "\\d{1,2}" };
	const formatRegex = (f: string) => format(f).split(/(YYYY|MM|DD|M|D)/).map((part, i) => (i % 2 ? digits[part] : escape(part))).join("");
	return template.split(FORMAT_RE).map((part, i) => (i % 2 ? formatRegex(part) : escape(part))).join("");
}

/** The task line without dates of any of the templates. Null when the line is not a task. */
export function removeDates(line: string, templates: string[]): string | null {
	if (!STATUS_RE.test(line)) return null;
	if (templates.length === 0) return line;
	const re = new RegExp(`\\s*(?:${templates.map(dateRegexSource).join("|")})`, "g");
	return line.replace(re, "");
}

/**
 * The task line with today's date by the template: in place of a date of the
 * same template, else after the checkbox or at the end. Null when the line is
 * not a task.
 */
export function setDateStamp(line: string, template: string, today: Date, position: DatePosition): string | null {
	const m = line.match(STATUS_RE);
	if (!m) return null;
	const stamp = formatDate(template, today);
	const re = new RegExp(dateRegexSource(template));
	if (re.test(line)) return line.replace(re, () => stamp);
	if (position === "end") return line.replace(/\s*$/, "") + " " + stamp;
	const at = m[0].length + 1; // after "]"
	const text = line.slice(at).trim();
	return `${line.slice(0, at)} ${stamp}${text ? " " + text : ""}`;
}
