// Pure task-moving logic — no Obsidian imports, fully unit-testable.

import { MoveOptions, MoveResult, TaskBlock } from "./types";
import { dateRegexSource, formatDate } from "./dateTemplate";
import {
	ParsedLine,
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

/** Regex for a completion date written with the template or one of the other known ones. */
function dateRegex(opts: MoveOptions): RegExp {
	return new RegExp([opts.dateTemplate, ...opts.oldDateTemplates].map((t) => `(?:${dateRegexSource(t)})`).join("|"));
}

/** Adds the templated date to closed task lines that do not yet have one. */
function addDateToBlock(blockLines: string[], opts: MoveOptions): string[] {
	const re = dateRegex(opts);
	const stamp = formatDate(opts.dateTemplate, opts.today);
	return blockLines.map((line) => {
		const m = line.match(TASK_RE);
		if (!m) return line;
		if (!opts.closedChars.includes(m[3]) || re.test(line)) return line;
		if (opts.datePosition === "start") {
			const text = (m[4] ?? "").trim();
			return `${m[1]}${m[2]} [${m[3]}] ${stamp}${text ? " " + text : ""}`;
		}
		return line.replace(/\s*$/, "") + " " + stamp;
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

/** True when the block contains at least one unchecked task line. */
function hasUncheckedTask(parsed: ParsedLine[], block: TaskBlock): boolean {
	for (let i = block.start; i <= block.end; i++) {
		if (parsed[i].isTask && !parsed[i].checked) return true;
	}
	return false;
}

/** Removes the templated completion date from open task lines. */
function stripDateFromOpen(blockLines: string[], opts: MoveOptions): string[] {
	const re = new RegExp(`\\s*(?:${dateRegex(opts).source})`);
	return blockLines.map((line) => {
		const m = line.match(TASK_RE);
		if (!m || opts.closedChars.includes(m[3])) return line;
		return line.replace(re, "");
	});
}

/**
 * Processes one section: fully completed top-level tasks go to the top of the
 * section's callout; with `returnUnchecked`, callout blocks that have an
 * unchecked line go back to the end of the list. Returns null when the
 * section stays unchanged. `atFileStart` tells whether the section opens the
 * file, `hasNextLine` whether a heading follows.
 */
function processSection(
	content: string[],
	atFileStart: boolean,
	hasNextLine: boolean,
	type: string,
	opts: MoveOptions
): SectionResult | null {
	const parsed = parseLines(content, opts.closedChars);
	const blocks = topLevelBlocks(content, parsed);
	const done = blocks.filter((b) => isBlockFullyDone(parsed, b));
	const callout = findCallout(content, { contentStart: 0, contentEnd: content.length }, type);

	const removed = new Set<number>();
	const returnedLines: string[] = [];
	let returned = 0;
	if (opts.returnUnchecked && callout) {
		const bodyStart = callout.header + 1;
		const inner = content.slice(bodyStart, callout.end + 1).map(unquote);
		const innerParsed = parseLines(inner, opts.closedChars);
		for (const b of topLevelBlocks(inner, innerParsed)) {
			if (!hasUncheckedTask(innerParsed, b)) continue;
			for (let i = b.start; i <= b.end; i++) removed.add(bodyStart + i);
			returnedLines.push(...stripDateFromOpen(dedent(inner.slice(b.start, b.end + 1)), opts));
			returned++;
		}
	}
	if (done.length === 0 && returned === 0) return null;

	const moved: string[] = [];
	for (const b of done) {
		for (let i = b.start; i <= b.end; i++) removed.add(i);
		// With a blank line (or the section start) above the block, the blank
		// line below it goes too: none is left at the top of the list or doubled.
		// The blank line before the callout stays.
		let above = b.start - 1;
		while (above >= 0 && removed.has(above)) above--;
		const below = b.end + 1;
		if (
			(above < 0 || content[above].trim() === "") &&
			content[below]?.trim() === "" &&
			below + 1 < content.length &&
			content[below + 1].trim() !== "" &&
			below + 1 !== callout?.header
		) {
			removed.add(below);
		}
		let blockLines = dedent(content.slice(b.start, b.end + 1));
		if (opts.appendDate) blockLines = addDateToBlock(blockLines, opts);
		moved.push(...blockLines.map(quote));
	}

	if (!callout) {
		const kept = content.filter((_, i) => !removed.has(i));
		const at = lastNonBlank(kept) + 1;
		const block = at > 0 || !atFileStart ? ["", opts.calloutHeader, ...moved] : [opts.calloutHeader, ...moved];
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
		// A kept callout always has a blank line before it.
		if (i === callout.header && bodyLeft && out.length > 0 && out[out.length - 1].trim() !== "") {
			out.push("");
		}
		if (!removed.has(i)) out.push(line);
		if (i === callout.header && bodyLeft) out.push(...moved);
		if (i === anchor) out.push(...returnedLines);
	});
	return { content: out, moved: done.length, returned };
}

/**
 * The part of `before` that differs from `after`: replacing `before[from, to)`
 * with `insert` gives `after`. Lets the editor change only that part, so the
 * cursor and folds outside of it stay put.
 */
export function changedRange(before: string, after: string): { from: number; to: number; insert: string } {
	const max = Math.min(before.length, after.length);
	let start = 0;
	while (start < max && before[start] === after[start]) start++;
	let tail = 0;
	while (tail < max - start && before[before.length - 1 - tail] === after[after.length - 1 - tail]) tail++;
	return { from: start, to: before.length - tail, insert: after.slice(start, after.length - tail) };
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
			s.contentStart === 0,
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
