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
	unquote,
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

/** Removes the "✅ YYYY-MM-DD" completion date from unchecked task lines. */
function stripDateFromUnchecked(blockLines: string[]): string[] {
	return blockLines.map((line) => {
		const m = line.match(TASK_RE);
		if (!m || m[2] !== " ") return line;
		return line.replace(/\s*✅\s*\d{4}-\d{2}-\d{2}/, "");
	});
}

/**
 * Processes one section: fully completed top-level tasks go to the top of the
 * section's callout; with `returnUnchecked`, callout blocks that have an
 * unchecked line go back to the end of the list. Returns null when the
 * section stays unchanged. `hasNextLine` tells whether a heading follows.
 */
function processSection(
	content: string[],
	hasNextLine: boolean,
	type: string,
	opts: MoveOptions
): SectionResult | null {
	const parsed = parseLines(content);
	const blocks = topLevelBlocks(content, parsed);
	const done = blocks.filter((b) => isBlockFullyDone(parsed, b));
	const callout = findCallout(content, { contentStart: 0, contentEnd: content.length }, type);

	const removed = new Set<number>();
	const returnedLines: string[] = [];
	let returned = 0;
	if (opts.returnUnchecked && callout) {
		const bodyStart = callout.header + 1;
		const inner = content.slice(bodyStart, callout.end + 1).map(unquote);
		const innerParsed = parseLines(inner);
		for (const b of topLevelBlocks(inner, innerParsed)) {
			if (isBlockFullyDone(innerParsed, b)) continue;
			for (let i = b.start; i <= b.end; i++) removed.add(bodyStart + i);
			returnedLines.push(...stripDateFromUnchecked(dedent(inner.slice(b.start, b.end + 1))));
			returned++;
		}
	}
	if (done.length === 0 && returned === 0) return null;

	const moved: string[] = [];
	for (const b of done) {
		for (let i = b.start; i <= b.end; i++) removed.add(i);
		let blockLines = dedent(content.slice(b.start, b.end + 1));
		if (opts.appendDate) blockLines = appendDateToBlock(blockLines, opts.today);
		moved.push(...blockLines.map(quote));
	}

	if (!callout) {
		const kept = content.filter((_, i) => !removed.has(i));
		const at = lastNonBlank(kept) + 1;
		const block = ["", opts.calloutHeader, ...moved];
		const nextIsText = at < kept.length ? kept[at].trim() !== "" : hasNextLine;
		if (nextIsText) block.push("");
		return { content: [...kept.slice(0, at), ...block, ...kept.slice(at)], moved: done.length, returned };
	}

	// An emptied callout goes away together with the blank line before it.
	let bodyLeft = moved.length > 0;
	for (let i = callout.header + 1; i <= callout.end; i++) {
		if (!removed.has(i) && unquote(content[i]).trim() !== "") bodyLeft = true;
	}
	if (!bodyLeft) {
		for (let i = callout.header; i <= callout.end; i++) removed.add(i);
		if (callout.header > 0 && content[callout.header - 1].trim() === "") removed.add(callout.header - 1);
	}

	// Returned tasks go after the last open task block, else after the last
	// text line before the callout, else to the top of the section.
	const open = blocks.filter((b) => !isBlockFullyDone(parsed, b));
	let anchor = open.length > 0 ? open[open.length - 1].end : -1;
	if (anchor === -1) {
		for (let i = callout.header - 1; i >= 0; i--) {
			if (!removed.has(i) && content[i].trim() !== "") {
				anchor = i;
				break;
			}
		}
	}

	const out: string[] = anchor === -1 ? [...returnedLines] : [];
	content.forEach((line, i) => {
		if (!removed.has(i)) out.push(line);
		if (i === callout.header && bodyLeft) out.push(...moved);
		if (i === anchor) out.push(...returnedLines);
	});
	return { content: out, moved: done.length, returned };
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
