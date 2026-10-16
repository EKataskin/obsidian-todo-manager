// Pure task-moving logic — no Obsidian imports, fully unit-testable.

import { MoveOptions, MoveResult } from "./types";
import {
	TASK_RE,
	calloutType,
	findCallout,
	isBlockFullyDone,
	parseLines,
	quote,
	splitLines,
	splitSections,
	topLevelBlocks,
} from "./taskParser";

/** Detects an already-present "✅ YYYY-MM-DD" completion date. */
const DATE_RE = /✅\s*\d{4}-\d{2}-\d{2}/;

/** Appends "✅ today" to checked checkbox lines that do not yet have a date. */
function appendDateToBlock(blockLines: string[], today: string): string[] {
	return blockLines.map((line) => {
		const m = line.match(TASK_RE);
		if (!m) return line;
		const checked = m[2] === "x" || m[2] === "X";
		if (!checked || DATE_RE.test(line)) return line;
		return line.replace(/\s*$/, "") + " ✅ " + today;
	});
}

/** Removes the first line's leading whitespace from every line of the block. */
function dedent(blockLines: string[]): string[] {
	const first = blockLines[0] ?? "";
	const rootIndent = (first.match(/^\s*/)?.[0] ?? "").length;
	if (rootIndent === 0) return blockLines.slice();
	return blockLines.map((line) => {
		let removed = 0;
		let k = 0;
		while (k < line.length && removed < rootIndent && /\s/.test(line[k])) {
			k++;
			removed++;
		}
		return line.slice(k);
	});
}

/** Index of the last non-blank line, or -1 when there is none. */
function lastNonBlank(lines: string[]): number {
	for (let i = lines.length - 1; i >= 0; i--) {
		if (lines[i].trim() !== "") return i;
	}
	return -1;
}

interface SectionResult {
	content: string[];
	moved: number;
	returned: number;
}

/**
 * Moves the fully completed top-level tasks of one section into the
 * section's callout. Returns null when the section stays unchanged.
 * `hasNextLine` tells whether a heading follows the section.
 */
function processSection(
	content: string[],
	hasNextLine: boolean,
	type: string,
	opts: MoveOptions
): SectionResult | null {
	const parsed = parseLines(content);
	const done = topLevelBlocks(content, parsed).filter((b) => isBlockFullyDone(parsed, b));
	if (done.length === 0) return null;

	const removed = new Set<number>();
	const moved: string[] = [];
	for (const b of done) {
		for (let i = b.start; i <= b.end; i++) removed.add(i);
		let blockLines = dedent(content.slice(b.start, b.end + 1));
		if (opts.appendDate) blockLines = appendDateToBlock(blockLines, opts.today);
		moved.push(...blockLines.map(quote));
	}

	const callout = findCallout(content, { contentStart: 0, contentEnd: content.length }, type);
	let out: string[] = [];
	if (callout) {
		content.forEach((line, i) => {
			if (removed.has(i)) return;
			out.push(line);
			if (i === callout.header) out.push(...moved);
		});
	} else {
		const kept = content.filter((_, i) => !removed.has(i));
		const at = lastNonBlank(kept) + 1;
		const block = ["", opts.calloutHeader, ...moved];
		const nextIsText = at < kept.length ? kept[at].trim() !== "" : hasNextLine;
		if (nextIsText) block.push("");
		out = [...kept.slice(0, at), ...block, ...kept.slice(at)];
	}
	return { content: out, moved: done.length, returned: 0 };
}

/**
 * Moves every fully completed top-level task into the callout at the end of
 * its own section (the lines under one heading). Pure: text in, text out.
 */
export function moveCompletedTasks(text: string, opts: MoveOptions): MoveResult {
	const unchanged = { text, movedCount: 0, returnedCount: 0 };
	const type = calloutType(opts.calloutHeader);
	if (type === null) return unchanged;

	const { lines, eol } = splitLines(text);
	let movedCount = 0;
	let returnedCount = 0;
	// Bottom-up, so splicing a section does not shift the ones above it.
	for (const s of splitSections(lines).reverse()) {
		const r = processSection(
			lines.slice(s.contentStart, s.contentEnd),
			s.contentEnd < lines.length,
			type,
			opts
		);
		if (!r) continue;
		lines.splice(s.contentStart, s.contentEnd - s.contentStart, ...r.content);
		movedCount += r.moved;
		returnedCount += r.returned;
	}
	if (movedCount + returnedCount === 0) return unchanged;
	return { text: lines.join(eol), movedCount, returnedCount };
}
