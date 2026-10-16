// Pure markdown parsing helpers — no Obsidian imports, fully unit-testable.

import { TaskBlock } from "./types";

/**
 * Matches a checkbox task line: indent, list marker, status char, rest of the text.
 * The brackets must be followed by a space or the line end, so "- [a](url)" is a link.
 */
export const TASK_RE = /^(\s*)([-*+]|\d+[.)]) \[(.)\](?:\s(.*))?$/;

const HEADING_RE = /^#{1,6}\s+/;
/** Any list item: "-", "*", "+" or "1." / "1)" followed by a space. */
const LIST_ITEM_RE = /^\s*([-*+]|\d+[.)])\s/;
const FENCE_RE = /^\s*(`{3,}|~{3,})/;
/** A thematic break: a line of only -, * or _ (3 or more), optionally spaced. */
const THEMATIC_BREAK_RE = /^\s*([-*_])(\s*\1){2,}\s*$/;

export interface ParsedLine {
	raw: string;
	isTask: boolean;
	/** Number of leading whitespace characters. */
	indent: number;
	/** Whether a task line's status char is a closed one. False for non-task lines. */
	checked: boolean;
	/** Whether the line is a list item (task or plain bullet) outside code fences. */
	isListItem: boolean;
}

/** Splits text into lines and remembers the line ending so it can be restored. */
export function splitLines(text: string): { lines: string[]; eol: string } {
	const eol = text.includes("\r\n") ? "\r\n" : "\n";
	return { lines: text.split(/\r?\n/), eol };
}

function leadingWhitespace(line: string): number {
	const m = line.match(/^\s*/);
	return m ? m[0].length : 0;
}

export function isHeading(line: string): boolean {
	return HEADING_RE.test(line);
}

export function isThematicBreak(line: string): boolean {
	return THEMATIC_BREAK_RE.test(line);
}

/** Marks the lines of fenced code blocks (``` or ~~~), fence lines included. */
export function fenceMask(lines: string[]): boolean[] {
	let fence: string | null = null;
	return lines.map((line) => {
		const m = line.match(FENCE_RE);
		if (fence === null) {
			if (m) fence = m[1];
			return fence !== null;
		}
		if (m && m[1][0] === fence[0] && m[1].length >= fence.length) fence = null;
		return true;
	});
}

/**
 * Classifies every line; lines inside code fences are never tasks or list items.
 * `closedChars` lists the status chars of closed tasks, any other char is open.
 */
export function parseLines(lines: string[], closedChars = "xX"): ParsedLine[] {
	const inFence = fenceMask(lines);
	return lines.map((raw, i) => {
		const m = inFence[i] ? null : raw.match(TASK_RE);
		if (m) {
			return {
				raw,
				isTask: true,
				indent: m[1].length,
				checked: closedChars.includes(m[3]),
				isListItem: true,
			};
		}
		return {
			raw,
			isTask: false,
			indent: leadingWhitespace(raw),
			checked: false,
			isListItem: !inFence[i] && LIST_ITEM_RE.test(raw),
		};
	});
}

/**
 * Returns the index of the last line belonging to the task block that starts
 * at `startIndex`: the task line plus every following deeper-indented line.
 * Internal blank lines are kept; trailing blank lines, headings and thematic
 * breaks end the block.
 */
export function blockEnd(lines: string[], startIndex: number): number {
	const baseIndent = leadingWhitespace(lines[startIndex]);
	let end = startIndex;
	for (let i = startIndex + 1; i < lines.length; i++) {
		const line = lines[i];
		if (line.trim() === "") continue;
		if (isHeading(line) || isThematicBreak(line)) break;
		if (leadingWhitespace(line) > baseIndent) {
			end = i;
		} else {
			break;
		}
	}
	return end;
}

/**
 * Finds the outermost list-item blocks (tasks and plain bullets) in document
 * order. Nested items stay inside their parent's block, so a task under a
 * plain bullet is never returned on its own.
 */
export function topLevelBlocks(lines: string[], parsed: ParsedLine[]): TaskBlock[] {
	const blocks: TaskBlock[] = [];
	let i = 0;
	while (i < lines.length) {
		if (parsed[i].isListItem) {
			const end = blockEnd(lines, i);
			blocks.push({ start: i, end });
			i = end + 1;
		} else {
			i++;
		}
	}
	return blocks;
}

/**
 * A block is "fully done" when its root checkbox is checked AND every task
 * line inside the block is checked too.
 */
export function isBlockFullyDone(parsed: ParsedLine[], block: TaskBlock): boolean {
	if (!parsed[block.start].isTask || !parsed[block.start].checked) return false;
	for (let i = block.start; i <= block.end; i++) {
		if (parsed[i].isTask && !parsed[i].checked) return false;
	}
	return true;
}

/** A run of lines under one heading (or before the first heading). */
export interface Section {
	/** First content line; the heading, if any, is the line before it. */
	contentStart: number;
	/** Exclusive end: the next heading or the end of the file. */
	contentEnd: number;
}

/** Index of the first line after a leading YAML frontmatter block, or 0. */
function frontmatterEnd(lines: string[]): number {
	if (lines[0] !== "---") return 0;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === "---") return i + 1;
	}
	return 0;
}

/**
 * Splits the document into sections by headings of any level. The part
 * before the first heading is always returned as the first section (it may
 * be empty). Frontmatter belongs to no section; thematic breaks do not split.
 */
export function splitSections(lines: string[]): Section[] {
	const sections: Section[] = [];
	let start = frontmatterEnd(lines);
	const inFence = fenceMask(lines);
	for (let i = start; i < lines.length; i++) {
		if (!inFence[i] && isHeading(lines[i])) {
			sections.push({ contentStart: start, contentEnd: i });
			start = i + 1;
		}
	}
	sections.push({ contentStart: start, contentEnd: lines.length });
	return sections;
}

const CALLOUT_HEADER_RE = /^>\s*\[!([\w-]+)\]/;

/** Returns the lower-cased callout type of a header line like "> [!done]- X". */
export function calloutType(header: string): string | null {
	const m = header.match(CALLOUT_HEADER_RE);
	return m ? m[1].toLowerCase() : null;
}

/** A callout: its header line and the last line of its body (inclusive). */
export interface CalloutRange {
	header: number;
	end: number;
}

/** Finds the first callout of the given type inside a section. */
export function findCallout(lines: string[], section: Section, type: string): CalloutRange | null {
	const inFence = fenceMask(lines);
	for (let i = section.contentStart; i < section.contentEnd; i++) {
		if (inFence[i] || calloutType(lines[i]) !== type) continue;
		let end = i;
		while (end + 1 < section.contentEnd && lines[end + 1].startsWith(">")) end++;
		return { header: i, end };
	}
	return null;
}

/** Strips the blockquote prefix from a callout body line. */
export function unquote(line: string): string {
	return line.replace(/^> ?/, "");
}

/** Prefixes a line for a callout body; blank lines become a bare ">". */
export function quote(line: string): string {
	return line === "" ? ">" : "> " + line;
}
